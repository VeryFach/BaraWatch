export type Risk = "rendah" | "sedang" | "tinggi" | "ekstrem";
export type HotspotStatus = "baru" | "diverifikasi" | "ditangani" | "selesai" | "bukan-api";

export interface Hotspot {
  id: string;
  desa: string;
  kabupaten: string;
  lat: number;
  lng: number;
  confidence: number;
  gambut: boolean;
  status: HotspotStatus;
  waktu: string;
  sumber: string;
  luasHa: number;
}

export interface Desa {
  nama: string;
  kabupaten: string;
  lat: number;
  lng: number;
  risk: Risk;
  alasan: string;
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

export const hotspots: Hotspot[] = [
  { id: "HS-1042", desa: "Kalampangan", kabupaten: "Palangka Raya", lat: -2.285, lng: 114.0, confidence: 92, gambut: true, status: "baru", waktu: "16:12", sumber: "VIIRS NOAA-20", luasHa: 4.2 },
  { id: "HS-1041", desa: "Tumbang Nusa", kabupaten: "Pulang Pisau", lat: -2.36, lng: 114.08, confidence: 88, gambut: true, status: "diverifikasi", waktu: "15:40", sumber: "VIIRS S-NPP", luasHa: 12.5 },
  { id: "HS-1040", desa: "Jabiren", kabupaten: "Pulang Pisau", lat: -2.52, lng: 114.17, confidence: 81, gambut: true, status: "ditangani", waktu: "14:05", sumber: "MODIS Aqua", luasHa: 8.1 },
  { id: "HS-1039", desa: "Mantangai", kabupaten: "Kapuas", lat: -2.62, lng: 114.48, confidence: 76, gambut: true, status: "baru", waktu: "13:52", sumber: "VIIRS NOAA-20", luasHa: 3.0 },
  { id: "HS-1038", desa: "Bawan", kabupaten: "Pulang Pisau", lat: -1.95, lng: 113.92, confidence: 64, gambut: false, status: "bukan-api", waktu: "13:20", sumber: "MODIS Terra", luasHa: 0 },
  { id: "HS-1037", desa: "Kereng Bangkirai", kabupaten: "Palangka Raya", lat: -2.27, lng: 113.9, confidence: 85, gambut: true, status: "ditangani", waktu: "11:47", sumber: "VIIRS S-NPP", luasHa: 6.4 },
  { id: "HS-1036", desa: "Pahandut Seberang", kabupaten: "Palangka Raya", lat: -2.22, lng: 113.95, confidence: 70, gambut: false, status: "selesai", waktu: "09:30", sumber: "VIIRS NOAA-20", luasHa: 1.8 },
  { id: "HS-1035", desa: "Sebangau Kuala", kabupaten: "Pulang Pisau", lat: -2.95, lng: 113.85, confidence: 90, gambut: true, status: "diverifikasi", waktu: "08:15", sumber: "VIIRS S-NPP", luasHa: 18.9 },
  { id: "HS-1034", desa: "Basarang", kabupaten: "Kapuas", lat: -2.78, lng: 114.25, confidence: 79, gambut: true, status: "baru", waktu: "07:58", sumber: "MODIS Aqua", luasHa: 2.6 },
];

export const desaList: Desa[] = [
  { nama: "Kalampangan", kabupaten: "Palangka Raya", lat: -2.29, lng: 114.02, risk: "ekstrem", alasan: "24 hari tanpa hujan di lahan gambut" },
  { nama: "Tumbang Nusa", kabupaten: "Pulang Pisau", lat: -2.37, lng: 114.1, risk: "ekstrem", alasan: "Gambut dalam, dekat kanal, riwayat kebakaran 2019" },
  { nama: "Jabiren", kabupaten: "Pulang Pisau", lat: -2.5, lng: 114.2, risk: "tinggi", alasan: "Kelembapan tanah rendah" },
  { nama: "Mantangai", kabupaten: "Kapuas", lat: -2.6, lng: 114.45, risk: "tinggi", alasan: "Pembukaan lahan baru terdeteksi (RADD)" },
  { nama: "Sebangau Kuala", kabupaten: "Pulang Pisau", lat: -2.93, lng: 113.88, risk: "tinggi", alasan: "Indeks kekeringan vegetasi tinggi" },
  { nama: "Basarang", kabupaten: "Kapuas", lat: -2.8, lng: 114.22, risk: "sedang", alasan: "Curah hujan 30 hari di bawah normal" },
  { nama: "Kereng Bangkirai", kabupaten: "Palangka Raya", lat: -2.26, lng: 113.88, risk: "sedang", alasan: "Dekat jalan dan permukiman" },
  { nama: "Bawan", kabupaten: "Pulang Pisau", lat: -1.96, lng: 113.95, risk: "rendah", alasan: "Hujan 3 hari terakhir" },
  { nama: "Tangkiling", kabupaten: "Palangka Raya", lat: -1.98, lng: 113.78, risk: "rendah", alasan: "Lahan mineral, tutupan baik" },
];

export const trend7d = [
  { hari: "Sab", mentah: 48, tersaring: 14 },
  { hari: "Min", mentah: 55, tersaring: 17 },
  { hari: "Sen", mentah: 61, tersaring: 21 },
  { hari: "Sel", mentah: 72, tersaring: 26 },
  { hari: "Rab", mentah: 66, tersaring: 22 },
  { hari: "Kam", mentah: 84, tersaring: 31 },
  { hari: "Jum", mentah: 93, tersaring: 35 },
];

export const resources = [
  { nama: "Manggala Agni Daops Palangka Raya", status: "Bertugas", lokasi: "Kalampangan", anggota: 15 },
  { nama: "MPA Tumbang Nusa", status: "Bertugas", lokasi: "Tumbang Nusa", anggota: 12 },
  { nama: "BPBD Pulang Pisau", status: "Siaga", lokasi: "Posko Pulang Pisau", anggota: 20 },
  { nama: "TNI Kodim 1011", status: "Siaga", lokasi: "Kuala Kapuas", anggota: 30 },
];

export const weather = { suhu: 34, kelembapan: 52, angin: "Tenggara 14 km/j", hariTanpaHujan: 24 };
