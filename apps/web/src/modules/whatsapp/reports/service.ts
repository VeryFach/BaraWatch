import { getServerEnv } from "@/lib/env";
import { supabaseRequest, uploadToSupabaseStorage } from "@/lib/supabase/admin";
import type { Contact, Inbound, Session } from "../core/types";
import { queryOne, setSession } from "../data/db";

const VISION_LABELS = [
  "fire",
  "smoke_general",
  "wildfire_smoke",
  "industrial_smoke",
  "fog",
] as const;

export type VisionResult = {
  labels: string[];
  needsReview: boolean;
  response: Record<string, unknown>;
};

type MatchingResult = {
  decision: "auto_pass" | "uncertain" | "rejected";
  verification_score: number;
  matched_hotspot: {
    hotspot_id: string;
    distance_m: number;
    time_difference_minutes: number;
  } | null;
};

export async function downloadAndAnalyze(
  url: string,
  contentType: string,
  reportId: string,
): Promise<{
  path: string;
  annotatedPath: string | null;
  vision: VisionResult | null;
}> {
  const env = getServerEnv();
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString("base64")}`,
    },
  });
  if (!response.ok)
    throw new Error(`Unable to download WhatsApp media (${response.status})`);
  const body = await response.arrayBuffer();
  const path = `reports/${reportId}/${crypto.randomUUID()}.jpg`;
  await uploadToSupabaseStorage(path, body, contentType);
  let annotatedPath: string | null = null;
  let vision: VisionResult | null = null;
  if (env.aiServiceUrl && env.aiServiceApiKey) {
    const form = new FormData();
    form.append("file", new Blob([body], { type: contentType }), "report.jpg");
    const result = await fetch(`${env.aiServiceUrl}/v1/vision/detect`, {
      method: "POST",
      headers: { "X-API-Key": env.aiServiceApiKey },
      body: form,
    });
    if (!result.ok)
      throw new Error(`Vision analysis failed (${result.status})`);
    const response = (await result.json()) as {
      vision?: { labels?: unknown; needs_review?: unknown };
    };
    const labels = Array.isArray(response.vision?.labels)
      ? response.vision.labels.filter(
          (label): label is string =>
            typeof label === "string" &&
            VISION_LABELS.includes(label as (typeof VISION_LABELS)[number]),
        )
      : [];
    vision = {
      labels,
      needsReview: response.vision?.needs_review === true,
      response: response as Record<string, unknown>,
    };
    const annotatedForm = new FormData();
    annotatedForm.append(
      "file",
      new Blob([body], { type: contentType }),
      "report.jpg",
    );
    const annotatedResponse = await fetch(
      `${env.aiServiceUrl}/v1/vision/detect/annotated`,
      {
        method: "POST",
        headers: { "X-API-Key": env.aiServiceApiKey },
        body: annotatedForm,
      },
    );
    if (!annotatedResponse.ok) {
      throw new Error(
        `Annotated vision analysis failed (${annotatedResponse.status})`,
      );
    }
    const annotatedBody = await annotatedResponse.arrayBuffer();
    annotatedPath = `reports/${reportId}/annotated-${crypto.randomUUID()}.jpg`;
    await uploadToSupabaseStorage(annotatedPath, annotatedBody, "image/jpeg");
  }
  return { path, annotatedPath, vision };
}

async function findRegionForPoint(latitude: number, longitude: number) {
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Report location coordinates are invalid");
  }
  const rows = await supabaseRequest<
    { region_id: string; region_name: string }[]
  >("rpc/region_for_point", {
    method: "POST",
    body: JSON.stringify({ latitude, longitude }),
  });
  return rows[0] ?? null;
}

export async function createReport(contactId: string, input: Inbound) {
  if (input.latitude === undefined || input.longitude === undefined) {
    throw new Error("Report location is required");
  }
  const region = await findRegionForPoint(input.latitude, input.longitude);
  const rows = await supabaseRequest<{ id: string }[]>("reports", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      contact_id: contactId,
      region_id: region?.region_id ?? null,
      geom: { type: "Point", coordinates: [input.longitude, input.latitude] },
      observed_at: new Date().toISOString(),
      description: input.body.trim() || null,
      status: "received",
    }),
  });
  if (!rows[0]) throw new Error("Report creation returned no row");
  const linkedIncident = await supabaseRequest<string | string[]>(
    "rpc/link_report_to_incident",
    {
      method: "POST",
      body: JSON.stringify({
        p_report_id: rows[0].id,
        p_latitude: input.latitude,
        p_longitude: input.longitude,
      }),
    },
  );
  const incidentId =
    typeof linkedIncident === "string"
      ? linkedIncident
      : (linkedIncident?.[0] ?? null);
  return {
    ...rows[0],
    incidentId,
    regionId: region?.region_id ?? null,
  };
}

export async function finishReport(
  contact: Contact,
  session: Session,
  input: Inbound,
) {
  const env = getServerEnv();
  const report = await createReport(contact.id, input);
  const mediaUrl =
    typeof session.context.mediaUrl === "string"
      ? session.context.mediaUrl
      : input.mediaUrl;
  const mediaType =
    typeof session.context.mediaContentType === "string"
      ? session.context.mediaContentType
      : input.mediaContentType;
  if (mediaUrl && mediaType?.startsWith("image/")) {
    const analysis = await downloadAndAnalyze(mediaUrl, mediaType, report.id);
    await supabaseRequest("report_media", {
      method: "POST",
      body: JSON.stringify({
        report_id: report.id,
        storage_path: analysis.path,
        media_type: "image",
        detections: analysis.vision?.response ?? null,
      }),
    });
    if (analysis.annotatedPath) {
      await supabaseRequest("report_media", {
        method: "POST",
        body: JSON.stringify({
          report_id: report.id,
          storage_path: analysis.annotatedPath,
          media_type: "image",
          detections: {
            annotated: true,
            source: analysis.vision?.response ?? null,
          },
        }),
      });
    }
    if (!analysis.vision || analysis.vision.labels.length === 0) {
      await supabaseRequest(`reports?id=eq.${encodeURIComponent(report.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "in_review",
          verification_outcome: "uncertain",
          updated_at: new Date().toISOString(),
        }),
      });
    }
    if (env.aiServiceUrl && env.aiInternalKey) {
      const observedAt = new Date().toISOString();
      const candidates = await supabaseRequest<
        {
          id: string;
          latitude: number;
          longitude: number;
          acq_at: string;
        }[]
      >(
        `hotspots?select=id,latitude,longitude,acq_at&filter_status=eq.kept&acq_at=gte.${encodeURIComponent(
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        )}&acq_at=lte.${encodeURIComponent(observedAt)}&limit=5000`,
      );
      const scores = (
        analysis.vision?.response.vision as
          | {
              scores?: Record<string, unknown>;
              needs_review?: boolean;
            }
          | undefined
      )?.scores;
      const matchingResponse = await fetch(
        `${env.aiServiceUrl}/v1/matching/score`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Key": env.aiInternalKey,
          },
          body: JSON.stringify({
            report: {
              latitude: input.latitude,
              longitude: input.longitude,
              observed_at: observedAt,
              vision: {
                fire: typeof scores?.fire === "number" ? scores.fire : 0,
                smoke_general:
                  typeof scores?.smoke_general === "number"
                    ? scores.smoke_general
                    : 0,
                wildfire_smoke:
                  typeof scores?.wildfire_smoke === "number"
                    ? scores.wildfire_smoke
                    : 0,
                industrial_smoke:
                  typeof scores?.industrial_smoke === "number"
                    ? scores.industrial_smoke
                    : 0,
                needs_review: analysis.vision?.needsReview ?? true,
              },
            },
            hotspots: candidates.map((candidate) => ({
              hotspot_id: candidate.id,
              latitude: candidate.latitude,
              longitude: candidate.longitude,
              acq_at: candidate.acq_at,
            })),
          }),
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!matchingResponse.ok)
        throw new Error(
          `Matching analysis failed (${matchingResponse.status})`,
        );
      const matching = (await matchingResponse.json()) as MatchingResult;
      await supabaseRequest(`reports?id=eq.${encodeURIComponent(report.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: matching.decision === "auto_pass" ? "verified" : "in_review",
          verification_outcome: matching.decision,
          verification_score: matching.verification_score,
          matched_hotspot_id: matching.matched_hotspot?.hotspot_id ?? null,
          match_distance_m: matching.matched_hotspot?.distance_m ?? null,
          match_dt_minutes:
            matching.matched_hotspot?.time_difference_minutes ?? null,
          updated_at: new Date().toISOString(),
        }),
      });
    }
    await setSession(contact.id, "idle");
    return {
      reportId: report.id,
      regionId: report.regionId,
      vision: analysis.vision,
    };
  }
  await setSession(contact.id, "idle");
  return { reportId: report.id, regionId: report.regionId, vision: null };
}

export async function getReportRegionNames(regionId: string | null) {
  if (!regionId)
    return {
      desa: "Tidak diketahui",
      kecamatan: "Tidak diketahui",
      kabupaten: "Tidak diketahui",
    };
  const region = await queryOne<{ name: string; parent_id: string | null }>(
    `regions?id=eq.${regionId}&select=name,parent_id`,
  );
  if (!region)
    return {
      desa: "Tidak diketahui",
      kecamatan: "Tidak diketahui",
      kabupaten: "Tidak diketahui",
    };
  const kecamatan = region.parent_id
    ? await queryOne<{ name: string; parent_id: string | null }>(
        `regions?id=eq.${region.parent_id}&select=name,parent_id`,
      )
    : null;
  const kabupaten = kecamatan?.parent_id
    ? await queryOne<{ name: string }>(
        `regions?id=eq.${kecamatan.parent_id}&select=name`,
      )
    : null;
  return {
    desa: region.name,
    kecamatan: kecamatan?.name ?? "Tidak diketahui",
    kabupaten: kabupaten?.name ?? "Tidak diketahui",
  };
}
