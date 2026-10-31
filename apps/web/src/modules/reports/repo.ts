import { randomUUID } from "node:crypto";
import { getServerEnv } from "@/lib/env";
import { supabaseRequest, uploadToSupabaseStorage } from "@/lib/supabase/admin";

export class ReportRegionMismatchError extends Error {}

type VisionSummary = {
  labels: string[];
  smoke_type: string | null;
  scores: Record<string, number>;
  needs_review: boolean;
};

export interface CreatePublicReportInput {
  phone: string;
  regionId: string;
  type: "Api" | "Asap";
  description: string;
  latitude: number;
  longitude: number;
  photo: { bytes: ArrayBuffer } | null;
  publicPhotoConsent: boolean;
}

async function createAnnotatedPhoto(bytes: ArrayBuffer) {
  const { aiServiceUrl, aiServiceApiKey } = getServerEnv();
  if (!aiServiceUrl || !aiServiceApiKey) return null;

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "image/jpeg" }), "report.jpg");
  const response = await fetch(
    `${aiServiceUrl.replace(/\/$/, "")}/v1/vision/detect/annotated?view=combined`,
    {
      method: "POST",
      headers: { "X-API-Key": aiServiceApiKey },
      body: form,
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type")?.split(";")[0];
  if (contentType !== "image/jpeg" && contentType !== "image/png") return null;
  const annotatedBytes = await response.arrayBuffer();
  if (
    !annotatedBytes.byteLength ||
    annotatedBytes.byteLength > 10 * 1024 * 1024
  ) {
    return null;
  }
  let vision: VisionSummary | null = null;
  try {
    const parsed = JSON.parse(
      response.headers.get("x-vision-summary") ?? "null",
    ) as Partial<VisionSummary> | null;
    if (
      parsed &&
      Array.isArray(parsed.labels) &&
      parsed.labels.every((label) => typeof label === "string") &&
      parsed.scores &&
      typeof parsed.scores === "object" &&
      !Array.isArray(parsed.scores)
    ) {
      const scores = Object.fromEntries(
        Object.entries(parsed.scores).filter(
          ([, score]) =>
            typeof score === "number" &&
            Number.isFinite(score) &&
            score >= 0 &&
            score <= 1,
        ),
      );
      vision = {
        labels: parsed.labels,
        smoke_type:
          typeof parsed.smoke_type === "string" ? parsed.smoke_type : null,
        scores,
        needs_review: parsed.needs_review === true,
      };
    }
  } catch {
    // Older AI deployments may return the image without the score header.
  }
  return { bytes: annotatedBytes, contentType, vision };
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
      region_id: input.regionId,
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
    const originalPath = `reports/${report.id}/${randomUUID()}.jpg`;
    try {
      await uploadToSupabaseStorage(
        originalPath,
        input.photo.bytes,
        "image/jpeg",
      );
      await supabaseRequest("report_media", {
        method: "POST",
        body: JSON.stringify({
          report_id: report.id,
          storage_path: originalPath,
          media_type: "image",
        }),
      });
    } catch {
      warnings.push("Laporan tersimpan, tetapi foto asli gagal diunggah.");
    }

    if (input.publicPhotoConsent) {
      try {
        const annotated = await createAnnotatedPhoto(input.photo.bytes);
        if (!annotated) {
          warnings.push(
            "Laporan tersimpan, tetapi anotasi YOLO belum tersedia; foto tidak ditampilkan di peta publik.",
          );
        } else {
          const extension =
            annotated.contentType === "image/png" ? "png" : "jpg";
          const annotatedPath = `reports/${report.id}/annotated-${randomUUID()}.${extension}`;
          await uploadToSupabaseStorage(
            annotatedPath,
            annotated.bytes,
            annotated.contentType,
          );
          await supabaseRequest("report_media", {
            method: "POST",
            body: JSON.stringify({
              report_id: report.id,
              storage_path: annotatedPath,
              media_type: "image",
              fire_score: annotated.vision?.scores.fire ?? null,
              smoke_score:
                annotated.vision?.scores.wildfire_smoke ??
                annotated.vision?.scores.industrial_smoke ??
                annotated.vision?.scores.smoke_general ??
                null,
              detections: {
                annotated: true,
                public_consent: true,
                vision: annotated.vision,
              },
            }),
          });
        }
      } catch {
        warnings.push(
          "Laporan tersimpan, tetapi anotasi YOLO gagal; foto tidak ditampilkan di peta publik.",
        );
      }
    }
  }

  return { reportId: report.id, incidentId, warnings };
}
