import { type Hotspot, type HotspotStatus, hotspots } from "@/lib/dummy-data";

export type OwnershipStatus =
  | "belum-diverifikasi"
  | "terverifikasi"
  | "perlu-penelusuran";
export interface LandOwner {
  id: string;
  name: string;
  type: "Perorangan" | "Perusahaan";
}
export interface LandParcel {
  id: string;
  village: string;
  areaHa: number;
  ownerId: string | null;
  document: string;
  hotspotId?: string;
}
export interface OwnershipReview {
  ownerId: string | null;
  status: Exclude<OwnershipStatus, "belum-diverifikasi">;
  reference: string;
  notes: string;
  reviewedAt: string;
}
export type OwnershipReviews = Record<string, OwnershipReview>;
export type OwnershipReviewInput = Omit<OwnershipReview, "reviewedAt">;

export const landOwners: LandOwner[] = [];
export const landParcels: LandParcel[] = [];
export const ownershipStatusLabels: Record<OwnershipStatus, string> = {
  "belum-diverifikasi": "Belum diverifikasi",
  terverifikasi: "Terverifikasi",
  "perlu-penelusuran": "Perlu penelusuran",
};
export function parcelOwnerId(parcel: LandParcel, reviews: OwnershipReviews) {
  const review = reviews[parcel.id];
  return review ? review.ownerId : parcel.ownerId;
}
export function ownerHoldings(
  ownerId: string,
  reviews: OwnershipReviews,
  statusOf: (id: string) => HotspotStatus,
) {
  const parcels = landParcels.filter(
    (p) => parcelOwnerId(p, reviews) === ownerId,
  );
  const incidents = parcels.flatMap((p) => {
    const h = hotspots.find((row) => row.id === p.hotspotId);
    return h && statusOf(h.id) !== "bukan-api" ? [h] : [];
  });
  return {
    parcels,
    totalHa: parcels.reduce((sum, p) => sum + p.areaHa, 0),
    burnedHa: incidents.reduce((sum, h) => sum + (h.luasHa ?? 0), 0),
  };
}
export interface LandCase {
  parcel: LandParcel;
  hotspot: Hotspot;
  owner: LandOwner | undefined;
  status: OwnershipStatus;
}
export function buildLandCases(
  reviews: OwnershipReviews,
  statusOf: (id: string) => HotspotStatus,
): LandCase[] {
  return landParcels
    .flatMap<LandCase>((parcel) => {
      const hotspot = hotspots.find((h) => h.id === parcel.hotspotId);
      if (
        !hotspot ||
        statusOf(hotspot.id) === "bukan-api" ||
        hotspot.luasHa === null
      )
        return [];
      return [
        {
          parcel,
          hotspot,
          owner: landOwners.find(
            (o) => o.id === parcelOwnerId(parcel, reviews),
          ),
          status: reviews[parcel.id]?.status ?? "belum-diverifikasi",
        },
      ];
    })
    .sort((a, b) => (b.hotspot.luasHa ?? 0) - (a.hotspot.luasHa ?? 0));
}
export function validateOwnershipReview(
  parcelId: string,
  input: OwnershipReviewInput,
): string | null {
  if (!landParcels.some((p) => p.id === parcelId))
    return "Bidang lahan tidak ditemukan.";
  if (input.status !== "terverifikasi" && input.status !== "perlu-penelusuran")
    return "Pilih hasil verifikasi yang valid.";
  if (input.ownerId !== null && !landOwners.some((o) => o.id === input.ownerId))
    return "Pemilik tidak ditemukan.";
  if (input.status === "terverifikasi" && !input.ownerId)
    return "Pilih pemilik sebelum mengonfirmasi kepemilikan.";
  if (input.status === "terverifikasi" && !input.reference.trim())
    return "Isi referensi dokumen atau pemeriksaan lapangan.";
  if (!input.notes.trim()) return "Isi catatan hasil pemeriksaan.";
  return null;
}
export function formatHa(value: number) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}
