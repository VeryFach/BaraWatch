import type { DbRegion, DbReport } from "@/lib/data-contracts";

export interface PublicHotspot {
  id: string;
  latitude: number;
  longitude: number;
  acqAt: string;
  satellite: string;
  instrument: string;
  confidenceLevel: "low" | "nominal" | "high" | null;
  frp: number | null;
  inPeat: boolean;
  regionId: string | null;
  regionCode: string | null;
  regionName: string | null;
  regionDistrict: string | null;
  incidentId: string | null;
}

export interface PublicIncident {
  id: string;
  regionId: string | null;
  regionCode: string | null;
  regionName: string | null;
  source: "satellite" | "report" | "both";
  status:
    | "new"
    | "confirmed"
    | "false_alarm"
    | "escalated"
    | "in_progress"
    | "contained"
    | "extinguished"
    | "closed";
  hotspotCount: number;
  latitude: number | null;
  longitude: number | null;
  firstDetectedAt: string;
  lastDetectedAt: string;
  closedAt: string | null;
}

export interface PublicRisk {
  region_id: string;
  region_code: string;
  region_name: string;
  region_level: string;
  week_start: string;
  risk_level: "rendah" | "sedang" | "tinggi" | "ekstrem";
  score: number | null;
  top_reasons: string[];
  method: string;
}

export interface PublicHotspotRow {
  id: string;
  latitude: number;
  longitude: number;
  acq_at: string;
  satellite: string;
  instrument: string;
  confidence_level: PublicHotspot["confidenceLevel"];
  frp: number | null;
  in_peat: boolean;
  region_id: string | null;
  region_code: string | null;
  region_name: string | null;
  region_district: string | null;
  incident_id: string | null;
}

export function publicHotspotFromRow(row: PublicHotspotRow): PublicHotspot {
  return {
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    acqAt: row.acq_at,
    satellite: row.satellite,
    instrument: row.instrument,
    confidenceLevel: row.confidence_level,
    frp: row.frp,
    inPeat: row.in_peat,
    regionId: row.region_id,
    regionCode: row.region_code,
    regionName: row.region_name,
    regionDistrict: row.region_district,
    incidentId: row.incident_id,
  };
}

export function pointCoordinates(value: unknown): {
  latitude: number;
  longitude: number;
} | null {
  if (!value || typeof value !== "object") return null;
  const point = value as { type?: unknown; coordinates?: unknown };
  if (point.type !== "Point" || !Array.isArray(point.coordinates)) return null;
  const [longitude, latitude] = point.coordinates;
  return typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

export type PublicRegion = Pick<
  DbRegion,
  "id" | "parent_id" | "level" | "code" | "name"
>;

export type PublicRegionBoundary = PublicRegion & {
  geometry: {
    type: "MultiPolygon" | "Polygon";
    coordinates: number[][][][] | number[][][];
  } | null;
};

export type PublicReport = Pick<
  DbReport,
  | "id"
  | "incident_id"
  | "matched_hotspot_id"
  | "latitude"
  | "longitude"
  | "observed_at"
  | "description"
  | "status"
  | "verification_outcome"
  | "verification_score"
  | "created_at"
> & {
  updated_at: string | null;
  media: {
    url: string;
    mediaType: "image" | "video";
    annotated: boolean;
  }[];
  region: {
    id: string;
    name: string;
    level: PublicRegion["level"];
    parent: { id: string; name: string; level?: PublicRegion["level"] } | null;
    district?: { id: string; name: string } | null;
  } | null;
};

export type PublicReportRow = Pick<
  DbReport,
  "id" | "incident_id" | "status" | "created_at"
>;

export function publicReportFromSanitizedRow(
  report: PublicReportRow,
): PublicReport {
  return {
    id: report.id,
    incident_id: report.incident_id,
    status: report.status,
    created_at: report.created_at,
    matched_hotspot_id: null,
    latitude: null,
    longitude: null,
    observed_at: null,
    description: null,
    verification_outcome: null,
    verification_score: null,
    updated_at: null,
    media: [],
    region: null,
  };
}

export function reportToLaporan(report: PublicReport) {
  return {
    id: report.id,
    desa: report.region?.name ?? "Wilayah belum tersedia",
    kecamatan:
      report.region?.parent?.level === "kecamatan"
        ? report.region.parent.name
        : "Wilayah belum tersedia",
    kabupaten: report.region?.district?.name ?? "Wilayah belum tersedia",
    jenis: report.description?.toLowerCase().includes("asap")
      ? ("Asap" as const)
      : ("Api" as const),
    catatan: report.description ?? "Deskripsi belum tersedia",
    waktu: new Date(report.created_at).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }),
    waktuIso: report.created_at,
    skorAI: report.verification_score ?? 0,
    status:
      report.status === "verified"
        ? ("diterima" as const)
        : report.status === "rejected"
          ? ("ditolak" as const)
          : ("menunggu" as const),
    imageUrl:
      report.media.find(
        (media) => media.mediaType === "image" && media.annotated,
      )?.url ?? null,
  };
}
