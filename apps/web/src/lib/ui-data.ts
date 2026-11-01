import type {
  PublicHotspot,
  PublicIncident,
  PublicRegion,
  PublicRegionBoundary,
  PublicRisk,
} from "@/lib/public-api";

export type Risk = PublicRisk["risk_level"];
export type HotspotStatus =
  | "baru"
  | "diverifikasi"
  | "ditangani"
  | "selesai"
  | "bukan-api";

export interface Hotspot {
  id: string;
  desa: string;
  kecamatan: string;
  kabupaten: string;
  lat: number;
  lng: number;
  confidence: number;
  confidenceLevel: PublicHotspot["confidenceLevel"];
  gambut: boolean;
  status: HotspotStatus;
  waktu: string;
  waktuIso: string;
  sumber: string;
  satellite: string;
  instrument: string;
  sourceProduct: string | null;
  frp: number | null;
  brightness: number | null;
  daynight: "D" | "N" | null;
  luasHa: number | null;
  incidentId: string | null;
  filterStatus:
    | "pending"
    | "kept"
    | "low_confidence"
    | "non_wildfire_zone"
    | "outside_pilot";
}

export interface Desa {
  id: string;
  nama: string;
  kecamatan: string;
  kabupaten: string;
  lat: number;
  lng: number;
  risk: Risk;
  score: number | null;
  alasan: string;
  weekStart: string;
}

function incidentStatus(
  status: PublicIncident["status"] | undefined,
): HotspotStatus {
  if (status === "false_alarm") return "bukan-api";
  if (status === "confirmed" || status === "escalated") return "diverifikasi";
  if (status === "in_progress" || status === "contained") return "ditangani";
  if (status === "extinguished" || status === "closed") return "selesai";
  return "baru";
}

function confidence(level: PublicHotspot["confidenceLevel"]) {
  return level === "high"
    ? 90
    : level === "nominal"
      ? 65
      : level === "low"
        ? 35
        : 0;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export function hotspotFromPublic(
  hotspot: PublicHotspot,
  incidents: PublicIncident[],
): Hotspot {
  const incident = incidents.find((item) => item.id === hotspot.incidentId);
  return {
    id: hotspot.id,
    desa: hotspot.regionName ?? "Wilayah belum tersedia",
    kecamatan: hotspot.regionDistrict ?? "Wilayah belum tersedia",
    kabupaten: hotspot.regionDistrict ?? "Wilayah belum tersedia",
    lat: hotspot.latitude,
    lng: hotspot.longitude,
    confidence: confidence(hotspot.confidenceLevel),
    confidenceLevel: hotspot.confidenceLevel,
    gambut: hotspot.inPeat,
    status: incidentStatus(incident?.status),
    waktu: formatTime(hotspot.acqAt),
    waktuIso: hotspot.acqAt,
    sumber: `${hotspot.instrument} ${hotspot.satellite}`,
    satellite: hotspot.satellite,
    instrument: hotspot.instrument,
    sourceProduct: null,
    frp: hotspot.frp,
    brightness: null,
    daynight: null,
    luasHa: null,
    incidentId: hotspot.incidentId,
    filterStatus: "kept",
  };
}

export function villagesFromPublic(
  regions: PublicRegion[],
  risks: PublicRisk[],
): Desa[] {
  const byId = new Map(regions.map((region) => [region.id, region]));
  const riskByRegion = new Map(risks.map((risk) => [risk.region_id, risk]));
  return regions
    .filter(
      (
        region,
      ): region is PublicRegion & {
        level: "desa";
      } => region.level === "desa",
    )
    .map((region) => {
      const subdistrict = byId.get(region.parent_id ?? "");
      const district = subdistrict?.parent_id
        ? byId.get(subdistrict.parent_id)
        : undefined;
      const risk = riskByRegion.get(region.id);
      return {
        id: region.id,
        nama: region.name,
        kecamatan: subdistrict?.name ?? "Wilayah belum tersedia",
        kabupaten: district?.name ?? "Wilayah belum tersedia",
        lat: -2.2,
        lng: 113.9,
        risk: (risk?.risk_level ?? "rendah") as Risk,
        score: risk?.score ?? null,
        alasan: risk?.top_reasons?.join(" · ") ?? "Belum ada alasan risiko",
        weekStart: risk?.week_start ?? "",
      };
    });
}

export function regionsToVillages(
  regions: PublicRegionBoundary[],
  risks: PublicRisk[],
) {
  const villages = villagesFromPublic(regions, risks);
  const byId = new Map(regions.map((region) => [region.id, region]));
  return villages.map((village) => {
    const region = byId.get(village.id);
    if (!region?.geometry) return village;
    const points: number[][] | undefined =
      region.geometry.type === "Polygon"
        ? (region.geometry.coordinates[0] as number[][])
        : (region.geometry.coordinates[0]?.[0] as number[][] | undefined);
    if (!points?.length) return village;
    const [longitude, latitude] = points.reduce(
      ([sumLng, sumLat], [lng, lat]) => [sumLng + lng, sumLat + lat],
      [0, 0],
    );
    return {
      ...village,
      lat: latitude / points.length,
      lng: longitude / points.length,
    };
  });
}

export const riskLabel: Record<Risk, string> = {
  rendah: "Rendah",
  sedang: "Sedang",
  tinggi: "Tinggi",
  ekstrem: "Ekstrem",
};

export const riskVar: Record<Risk, string> = {
  rendah: "var(--risk-low)",
  sedang: "var(--risk-medium)",
  tinggi: "var(--risk-high)",
  ekstrem: "var(--risk-extreme)",
};

export const statusLabel: Record<HotspotStatus, string> = {
  baru: "Baru",
  diverifikasi: "Api nyata",
  ditangani: "Ditangani",
  selesai: "Selesai",
  "bukan-api": "Bukan api",
};
