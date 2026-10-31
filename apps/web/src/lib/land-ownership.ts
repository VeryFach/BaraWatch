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

// Every identity, parcel and document below is fictional prototype data, not a registry.
export const landOwners: LandOwner[] = [
  { id: "OWN-01", name: "Budi Santoso", type: "Perorangan" },
  { id: "OWN-02", name: "Siti Rahmawati", type: "Perorangan" },
  { id: "OWN-03", name: "PT Sawit Lestari", type: "Perusahaan" },
  { id: "OWN-04", name: "PT Hutan Raya", type: "Perusahaan" },
];
export const landParcels: LandParcel[] = [
  {
    id: "BD-001",
    village: "Kalampangan",
    areaHa: 10,
    ownerId: "OWN-01",
    document: "SHM contoh 001",
    hotspotId: "HS-1042",
  },
  {
    id: "BD-002",
    village: "Tumbang Nusa",
    areaHa: 20,
    ownerId: "OWN-02",
    document: "SHM contoh 002",
    hotspotId: "HS-1041",
  },
  {
    id: "BD-003",
    village: "Jabiren",
    areaHa: 120,
    ownerId: "OWN-03",
    document: "HGU contoh 003",
    hotspotId: "HS-1040",
  },
  {
    id: "BD-004",
    village: "Mantangai",
    areaHa: 8,
    ownerId: "OWN-01",
    document: "SHM contoh 004",
    hotspotId: "HS-1039",
  },
  {
    id: "BD-005",
    village: "Kereng Bangkirai",
    areaHa: 15,
    ownerId: "OWN-02",
    document: "SHM contoh 005",
    hotspotId: "HS-1037",
  },
  {
    id: "BD-006",
    village: "Pahandut Seberang",
    areaHa: 5,
    ownerId: "OWN-01",
    document: "SHM contoh 006",
    hotspotId: "HS-1036",
  },
  {
    id: "BD-007",
    village: "Sebangau Kuala",
    areaHa: 200,
    ownerId: "OWN-04",
    document: "HGU contoh 007",
    hotspotId: "HS-1035",
  },
  {
    id: "BD-008",
    village: "Basarang",
    areaHa: 12,
    ownerId: null,
    document: "Dokumen belum tersedia",
    hotspotId: "HS-1034",
  },
  {
    id: "BD-009",
    village: "Tangkiling",
    areaHa: 7,
    ownerId: "OWN-01",
    document: "SHM contoh 009",
  },
  {
    id: "BD-010",
    village: "Bawan",
    areaHa: 10,
    ownerId: "OWN-02",
    document: "SHM contoh 010",
  },
  {
    id: "BD-011",
    village: "Jabiren",
    areaHa: 180,
    ownerId: "OWN-03",
    document: "HGU contoh 011",
  },
  {
    id: "BD-012",
    village: "Sebangau Kuala",
    areaHa: 300,
    ownerId: "OWN-04",
    document: "HGU contoh 012",
  },
];
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
