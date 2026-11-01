"use client";

import { ChevronDown, Flame, Megaphone, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ActivityProgress } from "@/components/ActivityProgress";
import { useApp } from "@/components/AppState";
import { ReportDialog } from "@/components/ReportDialog";
import { StatusBadge } from "@/components/StatusBadge";
import {
  type Activity,
  type ActivityFilters,
  buildActivities,
  filterActivities,
} from "@/lib/activity";
import { cn } from "@/lib/utils";

function ReportsPageContent() {
  const { laporan, reportsLoading, reportsError } = useApp();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ActivityFilters>({
    query: "",
    jenis: "semua",
    status: "all",
    kabupaten: "all",
    kecamatan: "all",
    desa: "all",
    urutan: "terbaru",
  });
  const [open, setOpen] = useState<string | null>(null);
  const allActivities = useMemo(() => buildActivities(laporan), [laporan]);
  const linkedReportId = searchParams.get("report_id");
  const activities = useMemo(
    () => filterActivities(allActivities, filters),
    [allActivities, filters],
  );
  useEffect(() => {
    if (
      linkedReportId &&
      allActivities.some((activity) => activity.id === linkedReportId)
    ) {
      setOpen(linkedReportId);
    }
  }, [allActivities, linkedReportId]);
  const districts = [...new Set(allActivities.map((a) => a.kabupaten))];
  const kecamatans = [
    ...new Set(
      allActivities
        .filter(
          (a) =>
            filters.kabupaten === "all" || a.kabupaten === filters.kabupaten,
        )
        .map((a) => a.kecamatan),
    ),
  ].sort();
  const villages = [
    ...new Set(
      allActivities
        .filter(
          (a) =>
            (filters.kabupaten === "all" ||
              a.kabupaten === filters.kabupaten) &&
            (filters.kecamatan === "all" || a.kecamatan === filters.kecamatan),
        )
        .map((a) => a.desa),
    ),
  ].sort();
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Kalimantan Tengah</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Laporan & kejadian
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pantau laporan masyarakat dan progres penanganan titik api.
          </p>
        </div>
        <ReportDialog>
          <button
            type="button"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Buat laporan
          </button>
        </ReportDialog>
      </div>
      <section className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_160px_200px_140px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.query}
            onChange={(e) =>
              setFilters((p) => ({ ...p, query: e.target.value }))
            }
            placeholder="Cari laporan, desa, atau ID"
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm text-black outline-none placeholder:text-gray-500 focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <select
          value={filters.jenis}
          onChange={(e) => setFilters((p) => ({ ...p, jenis: e.target.value }))}
          className="h-10 rounded-md border bg-background px-3 text-sm text-black"
        >
          <option value="semua">Semua jenis</option>
          <option value="laporan">Laporan warga</option>
          <option value="kejadian">Kejadian satelit</option>
        </select>
        <select
          value={filters.kabupaten}
          onChange={(e) =>
            setFilters((p) => ({
              ...p,
              kabupaten: e.target.value,
              kecamatan: "all",
              desa: "all",
            }))
          }
          className="h-10 rounded-md border bg-background px-3 text-sm text-black"
        >
          <option value="all">Semua wilayah</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={filters.kecamatan}
          disabled={filters.kabupaten === "all" || kecamatans.length === 0}
          onChange={(e) =>
            setFilters((p) => ({
              ...p,
              kecamatan: e.target.value,
              desa: "all",
            }))
          }
          className="h-10 rounded-md border bg-background px-3 text-sm text-black"
        >
          <option value="all">Semua kecamatan</option>
          {kecamatans.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          value={filters.desa}
          disabled={filters.kecamatan === "all" || villages.length === 0}
          onChange={(e) => setFilters((p) => ({ ...p, desa: e.target.value }))}
          className="h-10 rounded-md border bg-background px-3 text-sm text-black"
        >
          <option value="all">Semua desa</option>
          {villages.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          value={filters.urutan}
          onChange={(e) =>
            setFilters((p) => ({ ...p, urutan: e.target.value }))
          }
          className="h-10 rounded-md border bg-background px-3 text-sm text-black"
        >
          <option value="terbaru">Terbaru</option>
          <option value="terlama">Terlama</option>
        </select>
      </section>
      <ul className="space-y-3">
        {activities.map((activity) => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            open={open === activity.id}
            onToggle={() => setOpen(open === activity.id ? null : activity.id)}
          />
        ))}
      </ul>
      {reportsLoading && (
        <div className="rounded-2xl border bg-card py-14 text-center text-sm text-muted-foreground">
          Memuat laporan…
        </div>
      )}
      {reportsError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 py-14 text-center text-sm text-destructive">
          {reportsError}
        </div>
      )}
      {!reportsLoading && !reportsError && activities.length === 0 && (
        <div className="rounded-2xl border bg-card py-14 text-center text-sm text-muted-foreground">
          Tidak ada aktivitas yang sesuai.
        </div>
      )}
    </main>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsPageContent />
    </Suspense>
  );
}

function ActivityRow({
  activity,
  open,
  onToggle,
}: {
  activity: Activity;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      className={cn(
        "overflow-hidden rounded-xl border bg-card",
        open && "border-primary/40",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted/50 sm:p-5"
      >
        <span
          className={cn(
            "hidden size-10 shrink-0 items-center justify-center rounded-lg sm:flex",
            activity.kind === "kejadian"
              ? "bg-destructive/10 text-destructive"
              : "bg-forest/10 text-forest",
          )}
        >
          {activity.kind === "kejadian" ? (
            <Flame className="size-5" />
          ) : (
            <Megaphone className="size-5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">
            {activity.id} ·{" "}
            {activity.kind === "laporan"
              ? "Laporan masyarakat"
              : "Kejadian satelit"}{" "}
            · {activity.waktu} WIB
          </span>
          <strong className="mt-1 block">{activity.title}</strong>
          <span className="mt-1 block text-xs text-muted-foreground">
            {activity.kabupaten}
          </span>
        </span>
        {activity.kind === "kejadian" ? (
          <StatusBadge status={activity.status} />
        ) : (
          <span className="rounded-full bg-risk-medium/20 px-2.5 py-0.5 text-xs">
            {activity.status === "menunggu"
              ? "Ditinjau"
              : activity.status === "diterima"
                ? "Diterima"
                : "Tidak valid"}
          </span>
        )}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="grid gap-6 border-t bg-muted/20 p-5 md:grid-cols-2">
          <ActivityProgress activity={activity} />
          <div className="text-sm">
            {activity.kind === "laporan" && activity.report.imageUrl && (
              // biome-ignore lint/performance/noImgElement: signed storage URLs are dynamic.
              <img
                src={activity.report.imageUrl}
                alt={`Bukti foto ${activity.report.id}`}
                className="mb-4 aspect-video w-full rounded-xl object-cover"
              />
            )}
            <h2 className="font-semibold">Detail aktivitas</h2>
            <p className="mt-3 text-muted-foreground">{activity.summary}</p>
            {activity.kind === "kejadian" && (
              <Link
                href={`/peta?id=${encodeURIComponent(activity.id)}`}
                className="mt-4 inline-block text-primary hover:underline"
              >
                Lihat di peta →
              </Link>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
