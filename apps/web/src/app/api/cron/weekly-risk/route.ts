import { timingSafeEqual } from "node:crypto";
import { getPipelineEnv } from "@/lib/env";

type HotspotRow = {
  region_id: string | null;
  filter_status:
    | "pending"
    | "kept"
    | "low_confidence"
    | "non_wildfire_zone"
    | "outside_pilot";
  frp: number | null;
};

type RegionRow = { id: string };
type RiskResult = {
  region_id: string;
  risk_score: number | null;
  risk_level: "low" | "moderate" | "high" | "insufficient_data";
  reasons: string[];
};

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  let env: ReturnType<typeof getPipelineEnv>;
  try {
    env = getPipelineEnv();
  } catch {
    return Response.json(
      { error: "Pipeline is not configured" },
      { status: 503 },
    );
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (
    !authorization.startsWith("Bearer ") ||
    !secureEqual(authorization.slice(7), env.cronSecret)
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = async <T>(path: string, init: RequestInit = {}) => {
    const response = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Supabase request failed (${response.status}): ${detail.slice(0, 500)}`,
      );
    }
    if (response.status === 204) return undefined as T;
    const body = await response.text();
    return (body ? JSON.parse(body) : undefined) as T;
  };

  const weekStart = new Date();
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const since = weekStart.toISOString();
  let runId: string | null = null;
  let hotspotCount = 0;

  try {
    const runRows = await supabase<{ id: string }[]>("pipeline_runs", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        job_name: "weekly_risk",
        trigger_type: "schedule",
        status: "running",
      }),
    });
    runId = runRows[0]?.id ?? null;
    if (!runId) throw new Error("Unable to create weekly risk pipeline run");

    const [regions, hotspots] = await Promise.all([
      supabase<RegionRow[]>("regions?select=id&level=eq.desa&limit=10000"),
      supabase<HotspotRow[]>(
        `hotspots?select=region_id,filter_status,frp&region_id=not.is.null&acq_at=gte.${encodeURIComponent(since)}&limit=50000`,
      ),
    ]);
    hotspotCount = hotspots.length;
    const byRegion = new Map<string, HotspotRow[]>();
    for (const hotspot of hotspots) {
      if (!hotspot.region_id) continue;
      const rows = byRegion.get(hotspot.region_id) ?? [];
      rows.push(hotspot);
      byRegion.set(hotspot.region_id, rows);
    }

    const results: RiskResult[] = [];
    for (const region of regions) {
      const rows = byRegion.get(region.id) ?? [];
      const eligible = rows.filter((row) => row.filter_status === "kept");
      const review = rows.filter((row) => row.filter_status !== "kept");
      const frps = rows
        .map((row) => row.frp)
        .filter(
          (value): value is number =>
            typeof value === "number" && Number.isFinite(value),
        );
      const response = await fetch(`${env.aiServiceUrl}/v1/risk/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": env.aiInternalKey,
        },
        body: JSON.stringify({
          region_id: region.id,
          window_hours: 168,
          hotspot_count: rows.length,
          eligible_count: eligible.length,
          review_count: review.length,
          frp_max_mw: frps.length ? Math.max(...frps) : null,
          frp_mean_mw: frps.length
            ? frps.reduce((sum, value) => sum + value, 0) / frps.length
            : null,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`Risk AI returned ${response.status}`);
      results.push((await response.json()) as RiskResult);
    }

    const levelMap = {
      low: "rendah",
      moderate: "sedang",
      high: "tinggi",
      insufficient_data: "rendah",
    } as const;
    await supabase("risk_scores?on_conflict=region_id,week_start,method", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(
        results.map((result) => ({
          region_id: result.region_id,
          week_start: since.slice(0, 10),
          method: "rule_based",
          level: levelMap[result.risk_level],
          score: result.risk_score,
          top_reasons: result.reasons,
          computed_at: new Date().toISOString(),
        })),
      ),
    });
    await supabase(`pipeline_runs?id=eq.${encodeURIComponent(runId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "success",
        records_fetched: hotspotCount,
        finished_at: new Date().toISOString(),
      }),
    });
    return Response.json({
      ok: true,
      run_id: runId,
      week_start: since.slice(0, 10),
      regions: results.length,
      hotspots: hotspots.length,
    });
  } catch (error) {
    if (runId) {
      await supabase(`pipeline_runs?id=eq.${encodeURIComponent(runId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "failed",
          records_fetched: hotspotCount,
          error:
            error instanceof Error
              ? error.message.slice(0, 1000)
              : "Risk calculation failed",
          finished_at: new Date().toISOString(),
        }),
      }).catch(() => undefined);
    }
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Risk calculation failed",
      },
      { status: 502 },
    );
  }
}
