import { randomUUID } from "node:crypto";
import { supabaseRequest, uploadToSupabaseStorage } from "@/lib/supabase/admin";

export class ReportRegionMismatchError extends Error {}

export interface CreatePublicReportInput {
  phone: string;
  regionId: string;
  type: "Api" | "Asap";
  description: string;
  latitude: number;
  longitude: number;
  photo: { bytes: ArrayBuffer } | null;
}

export async function createPublicReport(input: CreatePublicReportInput) {
  const matchedRegions = await supabaseRequest<
    { region_id: string; region_name: string }[]
  >("rpc/region_for_point", {
    method: "POST",
    body: JSON.stringify({
      latitude: input.latitude,
      longitude: input.longitude,
    }),
  });
  const matchedRegion = matchedRegions[0];
  if (!matchedRegion) {
    throw new ReportRegionMismatchError(
      "Koordinat tidak berada di wilayah desa yang tercakup BaraWatch. Periksa kembali titik kejadian.",
    );
  }
  if (matchedRegion.region_id !== input.regionId) {
    throw new ReportRegionMismatchError(
      `Koordinat terdeteksi di ${matchedRegion.region_name}. Pilih desa tersebut atau koreksi koordinat.`,
    );
  }

  const newContacts = await supabaseRequest<{ id: string }[]>(
    "contacts?on_conflict=phone_e164",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=ignore-duplicates,return=representation",
      },
      body: JSON.stringify({ phone_e164: input.phone }),
    },
  );
  const existingContacts = newContacts.length
    ? newContacts
    : await supabaseRequest<{ id: string }[]>(
        `contacts?select=id&phone_e164=eq.${encodeURIComponent(input.phone)}&limit=1`,
      );
  const contactId = existingContacts[0]?.id;
  if (!contactId) throw new Error("Unable to resolve report contact");

  const reportRows = await supabaseRequest<
    { id: string; created_at: string }[]
  >("reports", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      contact_id: contactId,
      geom: {
        type: "Point",
        coordinates: [input.longitude, input.latitude],
      },
      observed_at: new Date().toISOString(),
      description: `${input.type}${input.description ? `: ${input.description}` : ""}`,
      status: "received",
    }),
  });
  const report = reportRows[0];
  if (!report) throw new Error("Report was not created");

  const warnings: string[] = [];
  let incidentId: string | null = null;
  try {
    const linked = await supabaseRequest<string | string[]>(
      "rpc/link_report_to_incident",
      {
        method: "POST",
        body: JSON.stringify({
          p_report_id: report.id,
          p_latitude: input.latitude,
          p_longitude: input.longitude,
        }),
      },
    );
    incidentId = typeof linked === "string" ? linked : (linked[0] ?? null);
  } catch {
    warnings.push("Laporan tersimpan, tetapi belum tertaut ke insiden.");
  }

  if (input.photo) {
    const storagePath = `reports/${report.id}/${randomUUID()}.jpg`;
    try {
      await uploadToSupabaseStorage(
        storagePath,
        input.photo.bytes,
        "image/jpeg",
      );
      await supabaseRequest("report_media", {
        method: "POST",
        body: JSON.stringify({
          report_id: report.id,
          storage_path: storagePath,
          media_type: "image",
        }),
      });
    } catch {
      warnings.push("Laporan tersimpan, tetapi foto gagal diunggah.");
    }
  }

  return { reportId: report.id, incidentId, warnings };
}
