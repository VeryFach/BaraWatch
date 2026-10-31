import { timingSafeEqual, randomUUID } from "node:crypto";
import { getPipelineEnv } from "@/lib/env";

export const maxDuration = 300;

type Rpc = <T>(name: string, args?: Record<string, unknown>) => Promise<T>;

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
    return Response.json({ error: "Pipeline is not configured" }, { status: 503 });
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ") || !secureEqual(authorization.slice(7), env.cronSecret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = `${env.supabaseUrl}/rest/v1`;
  const supabase = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${base}/${path}`, {
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
      throw new Error(`Supabase ${path.split("?")[0]} failed (${response.status}): ${detail.slice(0, 500)}`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  };
  const rpc: Rpc = (name, args = {}) => supabase(`rpc/${name}`, { method: "POST", body: JSON.stringify(args) });

  const owner = randomUUID();
  let runId: string | undefined;
  let fetched = 0;
  const errors: string[] = [];
  try {
    const claim = await rpc<{ acquired: boolean; run_id: string }[]>("claim_firms_pipeline", { p_owner: owner, p_lease_seconds: 900 });
    if (!claim[0]?.acquired) return Response.json({ ok: true, skipped: "already_running" });
    runId = claim[0].run_id;

    const settingsRows = await supabase<{ key: string; value: unknown }[]>("system_settings?select=key,value&key=in.(firms_products,firms_pilot_bbox,dbscan_eps_km,dbscan_min_samples,cluster_window_hours)");
    const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value])) as Record<string, unknown>;
    const sources = Array.isArray(settings.firms_products)
      ? settings.firms_products.filter((value): value is string => typeof value === "string")
      : ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"];
    const allowedSources = new Set(["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"]);
    if (!sources.length || sources.length > 4 || sources.some((source) => !allowedSources.has(source)) || new Set(sources).size !== sources.length) {
      throw new Error("Invalid firms_products setting");
    }
    const configuredBbox = settings.firms_pilot_bbox;
    const bbox =
      Array.isArray(configuredBbox) &&
      configuredBbox.length === 4 &&
      configuredBbox.every((value) => typeof value === "number" && Number.isFinite(value))
        ? configuredBbox
        : await rpc<number[]>("get_firms_pilot_bbox");
    if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some((coordinate) => !Number.isFinite(coordinate)) ||
      !(bbox[0] < bbox[2] && bbox[1] < bbox[3] && bbox[0] >= -180 && bbox[2] <= 180 && bbox[1] >= -90 && bbox[3] <= 90)) {
      throw new Error("Pilot boundary is not configured");
    }

    for (const source of sources) {
      const renewed = await rpc<boolean>("renew_firms_pipeline", { p_owner: owner, p_run: runId, p_lease_seconds: 900 });
      if (!renewed) throw new Error("Pipeline lease lost");
      try {
        const response = await fetch(`${env.aiServiceUrl}/v1/firms/fetch-parse`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Internal-Key": env.aiInternalKey },
          body: JSON.stringify({ source, bbox, days: 1 }),
          signal: AbortSignal.timeout(50_000),
        });
        if (!response.ok) throw new Error(`FIRMS adapter returned ${response.status}`);
        const result = await response.json() as { hotspots: Record<string, unknown>[] };
        if (!Array.isArray(result.hotspots) || result.hotspots.length > 20_000) throw new Error("Invalid FIRMS adapter response");
        const rows = result.hotspots.map((hotspot) => ({ ...hotspot, source }));
        const stored = await rpc<unknown[]>("upsert_firms_hotspots", { p_owner: owner, p_run: runId, p_rows: rows });
        fetched += stored.length;
      } catch (error) {
        errors.push(`${source}: ${error instanceof Error ? error.message : "request failed"}`);
      }
    }
    if (errors.length === sources.length) {
      throw new Error(`All FIRMS products failed: ${errors.join("; ")}`);
    }

    await rpc("annotate_hotspots", { p_run_id: runId });
    const input = await rpc<{ hotspots: Record<string, unknown>[]; open_incidents: Record<string, unknown>[] }>("get_firms_cluster_inputs", { p_run: runId });
    if (input.hotspots.length > 20_000) throw new Error("Eligible hotspot count exceeds AI clustering limit");
    const value = (key: string, fallback: number) => {
      const raw = settings[key];
      const parsed = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const clusterResponse = await fetch(`${env.aiServiceUrl}/v1/cluster`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": env.aiInternalKey },
      body: JSON.stringify({
        ...input,
        eps_km: value("dbscan_eps_km", 1),
        min_samples: value("dbscan_min_samples", 2),
        max_time_gap_hours: value("cluster_window_hours", 24),
        minimum_confidence: "all",
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!clusterResponse.ok) throw new Error(`AI clustering returned ${clusterResponse.status}`);
    const clustered = await clusterResponse.json() as { clusters: unknown[] };
    const reconciled = await rpc<number>("reconcile_firms_incidents", { p_owner: owner, p_run: runId, p_clusters: clustered.clusters });
    const status = errors.length ? "partial" : "success";
    const finished = await rpc<boolean>("finish_firms_pipeline", { p_owner: owner, p_run: runId, p_status: status, p_count: fetched, p_error: errors.length ? errors.join("; ") : null });
    if (!finished) throw new Error("Pipeline lease lost before completion");
    return Response.json({ ok: true, run_id: runId, fetched, clusters_reconciled: reconciled, status, source_errors: errors });
  } catch (error) {
    if (runId) {
      await rpc("finish_firms_pipeline", {
        p_owner: owner, p_run: runId, p_status: "failed", p_count: fetched,
        p_error: error instanceof Error ? error.message : "pipeline failed",
      }).catch(() => undefined);
    }
    return Response.json({ ok: false, run_id: runId, error: error instanceof Error ? error.message : "Pipeline failed" }, { status: 502 });
  }
}
