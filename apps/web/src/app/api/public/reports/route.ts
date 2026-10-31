import { NextResponse } from "next/server";
import type { PublicReport } from "@/lib/public-api";
import {
  createSupabaseStorageSignedUrl,
  supabaseRequest,
} from "@/lib/supabase/admin";
import {
  createPublicReport,
  ReportRegionMismatchError,
} from "@/modules/reports/repo";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE_E164 = /^\+[1-9]\d{7,14}$/;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

interface PublicReportRow {
  id: string;
  incident_id: string | null;
  status: PublicReport["status"];
  created_at: string;
  approx_geom: unknown;
}

/** PostgREST returns PostGIS geometry as EWKB hex unless a view casts it. */
function approximateCoordinates(value: unknown): {
  latitude: number;
  longitude: number;
} | null {
  let latitude: number;
  let longitude: number;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const point = value as { type?: unknown; coordinates?: unknown };
    if (point.type !== "Point" || !Array.isArray(point.coordinates))
      return null;
    [longitude, latitude] = point.coordinates as [number, number];
  } else if (typeof value === "string") {
    const hex = value.replace(/^\\x/i, "");
    if (!/^(?:[0-9a-f]{2})+$/i.test(hex) || hex.length < 42) return null;
    const bytePairs = hex.match(/.{2}/g);
    if (!bytePairs) return null;
    const bytes = Uint8Array.from(
      bytePairs.map((byte) => Number.parseInt(byte, 16)),
    );
    const view = new DataView(bytes.buffer);
    const littleEndian = bytes[0] === 1;
    if (!littleEndian && bytes[0] !== 0) return null;
    let type = view.getUint32(1, littleEndian);
    const hasSrid = (type & 0x20000000) !== 0;
    type &= 0x0fffffff;
    if ((type & 0xff) !== 1) return null;
    const sridOffset = hasSrid ? 4 : 0;
    if (hasSrid && view.getUint32(5, littleEndian) !== 4326) return null;
    const coordinateOffset = 5 + sridOffset;
    if (bytes.length < coordinateOffset + 16) return null;
    longitude = view.getFloat64(coordinateOffset, littleEndian);
    latitude = view.getFloat64(coordinateOffset + 8, littleEndian);
  } else {
    return null;
  }
  return Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
    ? { latitude, longitude }
    : null;
}

interface ReportMediaRow {
  report_id: string;
  storage_path: string;
  media_type: "image" | "video";
  detections: unknown;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const regionId = searchParams.get("region_id");
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? 50) || 50, 1),
    100,
  );
  if (
    status &&
    !["received", "in_review", "verified", "handled", "rejected"].includes(
      status,
    )
  ) {
    return NextResponse.json(
      { error: "Parameter pencarian tidak valid." },
      { status: 400 },
    );
  }
  if (regionId) {
    return NextResponse.json(
      { error: "Parameter pencarian tidak valid." },
      { status: 400 },
    );
  }
  const filter = status ? `&status=eq.${encodeURIComponent(status)}` : "";
  const reports = await supabaseRequest<PublicReportRow[]>(
    `public_reports_v?select=id,incident_id,status,created_at,approx_geom&order=created_at.desc&limit=${limit}${filter}`,
  );
  const imageEligibleIds = reports.map((report) => report.id);
  const media = imageEligibleIds.length
    ? await supabaseRequest<ReportMediaRow[]>(
        `report_media?select=report_id,storage_path,media_type,detections&media_type=eq.image&report_id=in.(${imageEligibleIds.join(",")})&order=created_at.asc`,
      )
    : [];
  const mediaByReport = new Map<string, PublicReport["media"]>();
  for (const item of media) {
    const metadata = item.detections;
    if (
      !metadata ||
      typeof metadata !== "object" ||
      Array.isArray(metadata) ||
      (metadata as { annotated?: unknown }).annotated !== true
    ) {
      continue;
    }
    const reportMedia = mediaByReport.get(item.report_id) ?? [];
    reportMedia.push({
      url: await createSupabaseStorageSignedUrl(item.storage_path),
      mediaType: item.media_type,
      annotated: true,
    });
    mediaByReport.set(item.report_id, reportMedia);
  }
  const data: PublicReport[] = reports.map((report) => {
    const coordinates = approximateCoordinates(report.approx_geom);
    return {
      id: report.id,
      incident_id: report.incident_id,
      status: report.status,
      created_at: report.created_at,
      matched_hotspot_id: null,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      observed_at: null,
      description: null,
      verification_outcome: null,
      verification_score: null,
      updated_at: null,
      media: mediaByReport.get(report.id) ?? [],
      region: null,
    };
  });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_PHOTO_BYTES + 256 * 1024) {
    return NextResponse.json(
      { error: "Ukuran request melebihi batas." },
      { status: 413 },
    );
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Form laporan tidak valid." },
      { status: 400 },
    );
  }

  const phone = String(form.get("phone") ?? "").trim();
  const regionId = String(form.get("region_id") ?? "").trim();
  const type = String(form.get("type") ?? "");
  const description = String(form.get("description") ?? "").trim();
  const rawLatitude = String(form.get("latitude") ?? "").trim();
  const rawLongitude = String(form.get("longitude") ?? "").trim();
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  const photoValue = form.get("photo");
  const photo =
    photoValue instanceof File && photoValue.size > 0 ? photoValue : null;
  const publicPhotoConsent = form.get("public_photo_consent") === "true";

  const invalidFields: string[] = [];
  if (!PHONE_E164.test(phone))
    invalidFields.push("Nomor HP harus format +6281234567890.");
  if (!UUID.test(regionId)) invalidFields.push("Pilih desa terlebih dahulu.");
  if (!["Api", "Asap"].includes(type))
    invalidFields.push("Jenis laporan tidak valid.");
  if (
    !rawLatitude ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    invalidFields.push("Latitude wajib diisi antara -90 dan 90.");
  }
  if (
    !rawLongitude ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    invalidFields.push("Longitude wajib diisi antara -180 dan 180.");
  }
  if (description.length > 1000)
    invalidFields.push("Catatan maksimal 1000 karakter.");
  if (photo && !publicPhotoConsent)
    invalidFields.push("Setujui publikasi foto anotasi atau hapus foto.");
  if (invalidFields.length) {
    return NextResponse.json(
      { error: invalidFields.join(" "), fields: invalidFields },
      { status: 400 },
    );
  }

  let photoBytes: ArrayBuffer | null = null;
  if (photo) {
    if (photo.type !== "image/jpeg" || photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { error: "Foto harus JPG/JPEG dan maksimal 5 MB." },
        { status: 400 },
      );
    }
    photoBytes = await photo.arrayBuffer();
    const signature = new Uint8Array(
      photoBytes,
      0,
      Math.min(3, photoBytes.byteLength),
    );
    if (
      signature.length !== 3 ||
      signature[0] !== 0xff ||
      signature[1] !== 0xd8 ||
      signature[2] !== 0xff
    ) {
      return NextResponse.json(
        { error: "Isi file bukan gambar JPEG yang valid." },
        { status: 400 },
      );
    }
  }

  try {
    const result = await createPublicReport({
      phone,
      regionId,
      type: type as "Api" | "Asap",
      description,
      latitude,
      longitude,
      photo: photoBytes ? { bytes: photoBytes } : null,
      publicPhotoConsent,
    });
    return NextResponse.json(
      {
        data: { id: result.reportId, incident_id: result.incidentId },
        warnings: result.warnings,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ReportRegionMismatchError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Laporan gagal disimpan ke server. Coba lagi." },
      { status: 503 },
    );
  }
}
