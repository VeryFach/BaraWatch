import type { Laporan } from "@/components/AppState";
import {
  type Hotspot,
  type HotspotStatus,
  statusLabel,
} from "@/lib/dummy-data";

export type ActivityKind = "laporan" | "kejadian";
export interface ActivityFilters {
  query: string;
  jenis: string;
  status: string;
  kabupaten: string;
  kecamatan: string;
  desa: string;
  urutan: string;
}

export const defaultActivityFilters: ActivityFilters = {
  query: "",
  jenis: "semua",
  status: "all",
  kabupaten: "all",
  kecamatan: "all",
  desa: "all",
  urutan: "terbaru",
};

export const reportStatusLabel: Record<Laporan["status"], string> = {
  menunggu: "Ditinjau",
  diterima: "Diterima",
  ditolak: "Tidak valid",
};

interface ActivityBase {
  id: string;
  desa: string;
  kecamatan: string;
  kabupaten: string;
  waktu: string;
  title: string;
  summary: string;
  escalated: boolean;
}

export type Activity = ActivityBase &
  (
    | { kind: "laporan"; status: Laporan["status"]; report: Laporan }
    | { kind: "kejadian"; status: HotspotStatus; hotspot: Hotspot }
  );

export interface ActivityProgress {
  steps: string[];
  current: number;
  closed: boolean;
  note: string;
}

export function buildActivities(reports: Laporan[]): Activity[] {
  return reports.map(
    (report): Activity => ({
      kind: "laporan",
      id: report.id,
      desa: report.desa,
      kecamatan: report.kecamatan,
      kabupaten: report.kabupaten,
      waktu: report.waktu,
      title: `${report.jenis} di ${report.desa}`,
      summary: report.catatan,
      status: report.status,
      report,
      escalated: false,
    }),
  );
}

export function activityProgress(activity: Activity): ActivityProgress {
  if (activity.kind === "laporan") {
    const closed = activity.status !== "menunggu";
    return {
      steps: [
        "Terkirim",
        "Ditinjau",
        activity.status === "ditolak" ? "Tidak valid" : "Diterima",
      ],
      current: closed ? 2 : 1,
      closed,
      note:
        activity.status === "menunggu"
          ? "Menunggu hasil peninjauan laporan."
          : activity.status === "diterima"
            ? "Laporan diterima. Status ini bukan berarti pemadaman sudah selesai."
            : "Peninjauan selesai; laporan dinyatakan tidak valid.",
    };
  }
  if (activity.status === "bukan-api") {
    return {
      steps: ["Terdeteksi", "Bukan api"],
      current: 1,
      closed: true,
      note: "Titik telah ditandai bukan api; tidak dilanjutkan ke pemadaman.",
    };
  }
  const current = { baru: 0, diverifikasi: 1, ditangani: 2, selesai: 3 }[
    activity.status
  ];
  const notes: Record<Exclude<HotspotStatus, "bukan-api">, string> = {
    baru: "Menunggu verifikasi lapangan.",
    diverifikasi: "Api nyata telah dikonfirmasi; menunggu penanganan.",
    ditangani: "Pemadaman sedang berlangsung.",
    selesai: "Kejadian telah ditandai selesai.",
  };
  return {
    steps: ["Terdeteksi", "Api nyata", "Ditangani", "Selesai"],
    current,
    closed: activity.status === "selesai",
    note: notes[activity.status],
  };
}

export function activityStatusLabel(activity: Activity): string {
  return activity.kind === "laporan"
    ? reportStatusLabel[activity.status]
    : statusLabel[activity.status];
}

export function filterActivities(
  rows: Activity[],
  filters: ActivityFilters,
): Activity[] {
  const query = filters.query.trim().toLocaleLowerCase("id");
  const jenis = filters.jenis || "semua";
  const status = filters.status || "all";
  const kabupaten = filters.kabupaten || "all";
  const kecamatan = filters.kecamatan || "all";
  const desa = filters.desa || "all";
  return rows
    .filter(
      (a) =>
        (jenis === "semua" || a.kind === jenis) &&
        (status === "all" || a.status === status) &&
        (kabupaten === "all" || a.kabupaten === kabupaten) &&
        (kecamatan === "all" || a.kecamatan === kecamatan) &&
        (desa === "all" || a.desa === desa) &&
        `${a.id} ${a.title} ${a.kecamatan} ${a.kabupaten} ${a.summary}`
          .toLocaleLowerCase("id")
          .includes(query),
    )
    .sort((a, b) => {
      const direction = filters.urutan === "terlama" ? 1 : -1;
      return (
        direction * a.waktu.localeCompare(b.waktu) || a.id.localeCompare(b.id)
      );
    });
}
