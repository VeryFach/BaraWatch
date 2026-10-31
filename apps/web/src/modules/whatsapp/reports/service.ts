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

export async function downloadAndAnalyze(
  url: string,
  contentType: string,
  reportId: string,
): Promise<{ path: string; vision: VisionResult | null }> {
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
  }
  return { path, vision };
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
      status: "received",
    }),
  });
  if (!rows[0]) throw new Error("Report creation returned no row");
  return { ...rows[0], regionId: region?.region_id ?? null };
}

export async function finishReport(
  contact: Contact,
  session: Session,
  input: Inbound,
) {
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
