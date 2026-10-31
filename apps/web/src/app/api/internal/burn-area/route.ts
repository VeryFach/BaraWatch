import { timingSafeEqual } from "node:crypto";
import { getPipelineEnv } from "@/lib/env";
import { supabaseRequest } from "@/lib/supabase/admin";

type BurnAreaInput = {
  incident_id: string;
  latitude: number;
  longitude: number;
  radius_km?: number;
  pre_start: string;
  pre_end: string;
  post_start: string;
  post_end: string;
  dnbr_threshold?: number;
  max_cloud_percent?: number;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  let env: ReturnType<typeof getPipelineEnv>;
  try {
    env = getPipelineEnv();
  } catch {
    return Response.json({ error: "Pipeline is not configured" }, { status: 503 });
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (
    !authorization.startsWith("Bearer ") ||
    !secureEqual(authorization.slice(7), env.cronSecret)
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const input = (await request.json()) as BurnAreaInput;
  if (
    !isUuid(input.incident_id) ||
    !Number.isFinite(input.latitude) ||
    !Number.isFinite(input.longitude) ||
    input.latitude < -90 ||
    input.latitude > 90 ||
    input.longitude < -180 ||
    input.longitude > 180 ||
    !input.pre_start ||
    !input.pre_end ||
    !input.post_start ||
    !input.post_end
  ) {
    return Response.json({ error: "Burn-area request is invalid" }, { status: 400 });
  }

  try {
    const response = await fetch(`${env.aiServiceUrl}/v1/burn-area/estimate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": env.aiInternalKey,
      },
      body: JSON.stringify({
        latitude: input.latitude,
        longitude: input.longitude,
        radius_km: input.radius_km,
        pre_start: input.pre_start,
        pre_end: input.pre_end,
        post_start: input.post_start,
        post_end: input.post_end,
        dnbr_threshold: input.dnbr_threshold,
        max_cloud_percent: input.max_cloud_percent,
        save_geotiff: false,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok) {
      return Response.json(
        { error: "Burn-area estimation unavailable" },
        { status: response.status === 422 ? 422 : 502 },
      );
    }
    const result = (await response.json()) as {
      indicated_area_ha: number;
      pre_scene_ids: string[];
      post_scene_ids: string[];
      valid_coverage_percent: number;
      quality: "adequate" | "limited";
    };
    const rows = await supabaseRequest<{ id: string }[]>("burn_area_reports", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        incident_id: input.incident_id,
        area_ha: result.indicated_area_ha,
        method: "dnbr",
        image_before_date: input.pre_end,
        image_after_date: input.post_end,
        cloud_cover_pct: 100 - result.valid_coverage_percent,
        is_uncertain: result.quality === "limited",
      }),
    });
    return Response.json({
      ok: true,
      burn_area_report_id: rows[0]?.id ?? null,
      result: {
        area_ha: result.indicated_area_ha,
        valid_coverage_percent: result.valid_coverage_percent,
        pre_scene_ids: result.pre_scene_ids,
        post_scene_ids: result.post_scene_ids,
        quality: result.quality,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Burn-area persistence failed" },
      { status: 502 },
    );
  }
}
