import { getServerEnv } from "@/lib/env";
import { supabaseRequest, uploadToSupabaseStorage } from "@/lib/supabase/admin";
import { queryOne, setSession } from "./db";
import type { Contact, Inbound, Session } from "./types";

export async function downloadAndAnalyze(
  url: string,
  contentType: string,
  reportId: string,
) {
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
  }
  return path;
}

async function findRegionForPoint(latitude: number, longitude: number) {
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
    const mediaPath = await downloadAndAnalyze(mediaUrl, mediaType, report.id);
    await supabaseRequest("report_media", {
      method: "POST",
      body: JSON.stringify({
        report_id: report.id,
        storage_path: mediaPath,
        media_type: "image",
      }),
    });
  }
  await setSession(contact.id, "idle");
  return { reportId: report.id, regionId: report.regionId };
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
