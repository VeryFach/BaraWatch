import type { Laporan } from "@/components/AppState";
import {
  type Hotspot,
  type HotspotStatus,
  hotspots,
  statusLabel,
} from "@/lib/dummy-data";

export type ActivityKind = "laporan" | "kejadian";
export interface ActivityFilters {
  query: string;
  jenis: string;
  status: string;
  kabupaten: string;
  urutan: string;
}

export const defaultActivityFilters: ActivityFilters = {
  query: "",
  jenis: "semua",
  status: "all",
  kabupaten: "all",
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

export function buildActivities(
  reports: Laporan[],
  statusOf: (id: string) => HotspotStatus,
  escalated: string[] = [],
): Activity[] {
  return [
    ...reports.map(
      (report): Activity => ({
        kind: "laporan",
        id: report.id,
        desa: report.desa,
        kabupaten: report.kabupaten,
        waktu: report.waktu,
        title: `${report.jenis} di ${report.desa}`,
        summary: report.catatan,
        status: report.status,
        report,
        escalated: false,
      }),
    ),
    ...hotspots.map(
      (hotspot): Activity => ({
        kind: "kejadian",
        id: hotspot.id,
        desa: hotspot.desa,
        kabupaten: hotspot.kabupaten,
        waktu: hotspot.waktu,
        title: `Titik api di ${hotspot.desa}`,
        summary: `${hotspot.sumber} · ${hotspot.gambut ? "Gambut" : "Mineral"}`,
        status: statusOf(hotspot.id),
        hotspot,
        escalated: escalated.includes(hotspot.id),
      }),
    ),
  ];
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
  return rows
    .filter(
      (a) =>
        (filters.jenis === "semua" || a.kind === filters.jenis) &&
        (filters.status === "all" || a.status === filters.status) &&
        (filters.kabupaten === "all" || a.kabupaten === filters.kabupaten) &&
        `${a.id} ${a.title} ${a.kabupaten} ${a.summary}`
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
