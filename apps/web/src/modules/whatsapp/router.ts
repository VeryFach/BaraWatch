import { getServerEnv } from "@/lib/env";
import { supabaseRequest, uploadToSupabaseStorage } from "@/lib/supabase/admin";
import type { WhatsAppInbound } from "./provider";

type SessionState =
  | "idle"
  | "choosing_kabupaten"
  | "choosing_kecamatan"
  | "choosing_desa"
  | "awaiting_location";
type Contact = {
  id: string;
  phone_e164: string;
  last_inbound_at: string | null;
};
type Region = {
  id: string;
  parent_id: string | null;
  level: "provinsi" | "kabupaten" | "kecamatan" | "desa";
  code: string;
  name: string;
};
type Session = { state: SessionState; context: Record<string, unknown> };

const HELP =
  "Kirim *Daftar* untuk berlangganan peringatan wilayah, atau *Lapor* untuk melaporkan kejadian.";

async function queryOne<T>(path: string): Promise<T | null> {
  const rows = await supabaseRequest<T[]>(`${path}&limit=1`);
  return rows[0] ?? null;
}

async function getOrCreateContact(phone: string): Promise<Contact> {
  const existing = await queryOne<Contact>(
    `contacts?phone_e164=eq.${encodeURIComponent(phone)}&select=id,phone_e164,last_inbound_at`,
  );
  if (existing) return existing;
  const rows = await supabaseRequest<Contact[]>("contacts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      phone_e164: phone,
      consent_at: new Date().toISOString(),
    }),
  });
  if (!rows[0]) throw new Error("Contact creation returned no row");
  return rows[0];
}

async function getSession(contactId: string): Promise<Session> {
  const session = await queryOne<{
    state: SessionState;
    context: Record<string, unknown>;
  }>(`wa_sessions?contact_id=eq.${contactId}&select=state,context`);
  return session ?? { state: "idle", context: {} };
}

async function setSession(
  contactId: string,
  state: SessionState,
  context: Record<string, unknown> = {},
) {
  await supabaseRequest("wa_sessions", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ contact_id: contactId, state, context }),
  });
}

async function logInbound(contactId: string, message: WhatsAppInbound) {
  await supabaseRequest("wa_messages", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      contact_id: contactId,
      direction: "in",
      kind: "chat",
      provider_sid: message.messageSid,
      body: message.body || null,
      media_path: message.mediaUrl ?? null,
      lat: message.latitude ?? null,
      lng: message.longitude ?? null,
      status: "received",
    }),
  });
  await supabaseRequest(`contacts?id=eq.${contactId}`, {
    method: "PATCH",
    body: JSON.stringify({
      last_inbound_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
}

async function findProvince(): Promise<Region> {
  const province = await queryOne<Region>(
    "regions?level=eq.provinsi&code=eq.62&select=id,parent_id,level,code,name",
  );
  if (!province)
    throw new Error("Kalimantan Tengah region (code 62) was not found");
  return province;
}

async function findChildren(
  parentId: string,
  level: Region["level"],
): Promise<Region[]> {
  return supabaseRequest<Region[]>(
    `regions?parent_id=eq.${encodeURIComponent(parentId)}&level=eq.${level}&select=id,parent_id,level,code,name&order=code.asc`,
  );
}

function chooseRegion(regions: Region[], input: string): Region | null {
  const normalized = input.trim().toLocaleLowerCase("id-ID");
  const exact = regions.filter(
    (region) =>
      region.name.toLocaleLowerCase("id-ID") === normalized ||
      region.code.toLocaleLowerCase("id-ID") === normalized,
  );
  if (exact.length === 1) return exact[0];
  const partial = regions.filter((region) =>
    region.name.toLocaleLowerCase("id-ID").includes(normalized),
  );
  return partial.length === 1 ? partial[0] : null;
}

function regionOptions(regions: Region[], level: Region["level"]): string {
  const label =
    level === "kabupaten"
      ? "kabupaten"
      : level === "kecamatan"
        ? "kecamatan"
        : "desa";
  const options = regions
    .map((region) => `${region.code} - ${region.name}`)
    .join("\n");
  if (options.length > 3500) {
    return `Silakan ketik nama atau kode ${label} Anda. Data wilayah akan dicocokkan dari daftar resmi Kalimantan Tengah.`;
  }
  return `Silakan ketik nama atau kode ${label} Anda:\n${options}`;
}

async function createReport(
  contactId: string,
  input: WhatsAppInbound,
  mediaPath?: string,
) {
  const rows = await supabaseRequest<{ id: string }[]>("reports", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      contact_id: contactId,
      geom: { type: "Point", coordinates: [input.longitude, input.latitude] },
      status: "received",
    }),
  });
  const reportId = rows[0]?.id;
  if (!reportId) throw new Error("Report creation returned no row");
  if (mediaPath) {
    await supabaseRequest("report_media", {
      method: "POST",
      body: JSON.stringify({
        report_id: reportId,
        storage_path: mediaPath,
        media_type: "image",
      }),
    });
  }
  return reportId;
}

async function downloadAndAnalyze(
  url: string,
  contentType: string,
  reportId: string,
): Promise<string> {
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
    const aiResponse = await fetch(`${env.aiServiceUrl}/v1/vision/detect`, {
      method: "POST",
      headers: { "X-API-Key": env.aiServiceApiKey },
      body: form,
    });
    if (!aiResponse.ok)
      throw new Error(`Vision analysis failed (${aiResponse.status})`);
  }
  return path;
}

export async function routeInbound(message: WhatsAppInbound): Promise<string> {
  const contact = await getOrCreateContact(message.from);
  await logInbound(contact.id, message);
  const session = await getSession(contact.id);
  const body = message.body.trim().toLowerCase();

  if (
    session.state === "choosing_kabupaten" ||
    session.state === "choosing_kecamatan" ||
    session.state === "choosing_desa"
  ) {
    const level =
      session.state === "choosing_kabupaten"
        ? "kabupaten"
        : session.state === "choosing_kecamatan"
          ? "kecamatan"
          : "desa";
    const parentId =
      typeof session.context.parentId === "string"
        ? session.context.parentId
        : (await findProvince()).id;
    const regions = await findChildren(parentId, level);
    const region = chooseRegion(regions, message.body);
    if (!region) {
      return `Pilihan tidak ditemukan atau belum spesifik.\n${regionOptions(regions, level)}`;
    }
    if (level === "kabupaten") {
      const kecamatan = await findChildren(region.id, "kecamatan");
      await setSession(contact.id, "choosing_kecamatan", {
        kabupatenId: region.id,
        kabupatenName: region.name,
        parentId: region.id,
      });
      return `Kabupaten ${region.name} dipilih.\n${regionOptions(kecamatan, "kecamatan")}`;
    }
    if (level === "kecamatan") {
      const desa = await findChildren(region.id, "desa");
      await setSession(contact.id, "choosing_desa", {
        kabupatenId: session.context.kabupatenId,
        kabupatenName: session.context.kabupatenName,
        kecamatanId: region.id,
        kecamatanName: region.name,
        parentId: region.id,
      });
      return `Kecamatan ${region.name} dipilih.\n${regionOptions(desa, "desa")}`;
    }
    await supabaseRequest("subscriptions", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        contact_id: contact.id,
        region_id: region.id,
        is_active: true,
      }),
    });
    await setSession(contact.id, "idle");
    return `Berhasil! Anda kini akan menerima peringatan dini Karhutla untuk desa ${region.name}.`;
  }

  if (
    session.state === "awaiting_location" &&
    message.latitude !== undefined &&
    message.longitude !== undefined
  ) {
    const reportId = await createReport(contact.id, message);
    let mediaPath: string | undefined;
    const mediaUrl =
      typeof session.context.mediaUrl === "string"
        ? session.context.mediaUrl
        : message.mediaUrl;
    const mediaType =
      typeof session.context.mediaContentType === "string"
        ? session.context.mediaContentType
        : message.mediaContentType;
    if (mediaUrl && mediaType?.startsWith("image/")) {
      mediaPath = await downloadAndAnalyze(mediaUrl, mediaType, reportId);
      await supabaseRequest(`report_media?report_id=eq.${reportId}`, {
        method: "PATCH",
        body: JSON.stringify({ storage_path: mediaPath }),
      });
    }
    await setSession(contact.id, "idle");
    return "Laporan diterima. Tim MPA sedang meninjau lokasi Anda. Terima kasih.";
  }

  if (body === "daftar" || body === "info") {
    const province = await findProvince();
    const kabupaten = await findChildren(province.id, "kabupaten");
    await setSession(contact.id, "choosing_kabupaten", {
      provinceId: province.id,
      provinceName: province.name,
      parentId: province.id,
    });
    return `Wilayah ${province.name}.\n${regionOptions(kabupaten, "kabupaten")}`;
  }
  if (body === "lapor" || message.mediaUrl) {
    await setSession(contact.id, "awaiting_location", {
      mediaUrl: message.mediaUrl,
      mediaContentType: message.mediaContentType,
    });
    return "Mohon bagikan Lokasi Terkini (*Share Location*) Anda menggunakan menu lampiran WhatsApp.";
  }
  return HELP;
}
