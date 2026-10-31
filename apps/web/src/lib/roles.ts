export type Role = "warga" | "desa" | "petugas" | "admin" | "hukum";

export type Permission =
  | "lihatTitikApi"
  | "lihatDetailTeknis"
  | "verifikasi"
  | "ubahStatusPemadaman"
  | "eskalasi"
  | "lapor"
  | "lihatTim"
  | "lihatTren"
  | "antreanLaporan"
  | "areaTerbakar"
  | "lihatKonsesi"
  | "verifikasiKepemilikan";

export const roles: Record<Role, { label: string; short: string; sapaan: string; deskripsi: string }> = {
  warga: { label: "Warga / Petani", short: "Warga", sapaan: "Warga", deskripsi: "Pantauan publik tanpa login, peta, dan laporan api atau asap." },
  desa: { label: "Perangkat Desa & MPA", short: "Desa / MPA", sapaan: "Tim Desa", deskripsi: "Informasi publik yang sama; verifikasi dan eskalasi melalui peta." },
  petugas: { label: "Petugas Pemadam", short: "Petugas", sapaan: "Petugas", deskripsi: "Pantau kejadian, atur tim, dan perbarui status pemadaman." },
  admin: { label: "Admin Sistem", short: "Admin", sapaan: "Admin", deskripsi: "Jaga kualitas data, tinjau laporan ragu, dan kelola model." },
  hukum: { label: "Penegak Hukum & Regulator", short: "Penegak Hukum", sapaan: "Penelaah", deskripsi: "Verifikasi pemilik lahan terbakar dan telaah total kepemilikan lahan." },
};

export const permissionLabel: Record<Permission, string> = {
  lihatTitikApi: "Melihat titik api di peta",
  lihatDetailTeknis: "Melihat detail teknis (confidence, sumber satelit)",
  verifikasi: "Menandai \"Api nyata\" atau \"Bukan api\"",
  ubahStatusPemadaman: "Memperbarui status pemadaman",
  eskalasi: "Eskalasi kejadian ke BPBD",
  lapor: "Mengirim laporan api / asap",
  lihatTim: "Melihat posisi tim di lapangan",
  lihatTren: "Melihat tren dan statistik",
  antreanLaporan: "Meninjau antrean laporan ragu",
  areaTerbakar: "Melihat laporan area terbakar",
  lihatKonsesi: "Melihat lapisan batas konsesi",
  verifikasiKepemilikan: "Memverifikasi pemilik dan total kepemilikan lahan",
};

const publicMapPermissions: Permission[] = ["lihatTitikApi", "lihatDetailTeknis", "lihatKonsesi"];

const matrix: Record<Role, Permission[]> = {
  warga: ["lapor"],
  desa: ["lihatTitikApi", "verifikasi", "eskalasi", "lapor", "lihatTim"],
  petugas: ["lihatTitikApi", "lihatDetailTeknis", "verifikasi", "ubahStatusPemadaman", "lihatTim", "lihatTren", "areaTerbakar"],
  admin: ["lihatTitikApi", "lihatDetailTeknis", "verifikasi", "lihatTren", "antreanLaporan"],
  hukum: ["lihatTitikApi", "lihatDetailTeknis", "areaTerbakar", "lihatKonsesi", "lihatTren", "verifikasiKepemilikan"],
};

export const allPermissions = Object.keys(permissionLabel) as Permission[];

export const defaultRole: Role = "warga";

export function dashboardView(role: Role): "publik" | "petugas" | "admin" | "hukum" {
  return role === "warga" || role === "desa" ? "publik" : role;
}

export function isRole(value: string | null): value is Role {
  return value !== null && Object.hasOwn(roles, value);
}

export function can(role: Role, p: Permission) {
  return publicMapPermissions.includes(p) || matrix[role].includes(p);
}
