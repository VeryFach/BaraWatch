import type { DbRegion, DbReport } from "@/lib/data-contracts";

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
  | "updated_at"
> & {
  media: {
    url: string;
    mediaType: "image" | "video";
  }[];
  region: {
    id: string;
    name: string;
    level: PublicRegion["level"];
    parent: { id: string; name: string } | null;
  } | null;
};

export function reportToLaporan(report: PublicReport) {
  return {
    id: report.id,
    desa: report.region?.name ?? "Wilayah belum tersedia",
    kabupaten: report.region?.parent?.name ?? "Wilayah belum tersedia",
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
      report.media.find((media) => media.mediaType === "image")?.url ?? null,
  };
}
