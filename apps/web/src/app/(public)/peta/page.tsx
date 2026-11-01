"use client";

import { Camera, Filter, Flame, RotateCcw, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useApp } from "@/components/AppState";
import { ClientMap } from "@/components/ClientMap";
import { HotspotDetails } from "@/components/HotspotDetails";
import { ReportVerificationActions } from "@/components/ReportVerificationActions";
import { SearchSelect } from "@/components/SearchSelect";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  defaultMapFilters,
  filterHotspots,
  filterVillages,
  type MapFilters,
} from "@/lib/map-filters";
import type { PublicRegionBoundary } from "@/lib/public-api";
import { statusLabel } from "@/lib/ui-data";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 3;

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <main className="h-[calc(100dvh-4rem)] animate-pulse bg-muted" />
      }
    >
      <MapContent />
    </Suspense>
  );
}

function MapContent() {
  const {
    desaList,
    hotspots,
    publicHotspots,
    publicIncidents,
    regions,
    hotspotsLoading,
    regionsLoading,
    reportsLoading,
    reportsError,
    publicReports,
    loadRegions,
    can,
    refreshReports,
  } = useApp();
  const router = useRouter();
  const selectedId = useSearchParams().get("id");
  const selectedReportId = useSearchParams().get("report");
  const [filters, setFilters] = useState<MapFilters>(defaultMapFilters);
  const [showRisk, setShowRisk] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleHotspots, setVisibleHotspots] = useState(ITEMS_PER_PAGE);
  const [visibleReports, setVisibleReports] = useState(ITEMS_PER_PAGE);
  const [regionLevels, setRegionLevels] = useState<
    PublicRegionBoundary["level"][]
  >(["kabupaten", "kecamatan", "desa"]);
  const reports = publicReports;
  const list = useMemo(
    () => filterHotspots(hotspots, filters),
    [filters, hotspots],
  );
  const reportList = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return reports.filter((report) => {
      const district = report.region?.parent?.name ?? "";
      const village = report.region?.name ?? "";
      return (
        `${report.id} ${report.description ?? ""} ${village} ${district}`
          .toLowerCase()
          .includes(query) &&
        (filters.kabupaten === "all" || district === filters.kabupaten)
      );
    });
  }, [filters.kabupaten, filters.query, reports]);
  const districts = useMemo(
    () =>
      regions
        .filter((region) => region.level === "kabupaten")
        .map((region) => region.name)
        .sort(),
    [regions],
  );
  const kecamatans = useMemo(
    () =>
      [
        ...new Set(
          regions
            .filter(
              (region) =>
                region.level === "kecamatan" &&
                (filters.kabupaten === "all" ||
                  regions.find((parent) => parent.id === region.parent_id)
                    ?.name === filters.kabupaten),
            )
            .map((region) => region.name),
        ),
      ].sort(),
    [filters.kabupaten, regions],
  );
  const villagesForFilter = useMemo(
    () =>
      [
        ...new Set(
          desaList
            .filter(
              (desa) =>
                (filters.kabupaten === "all" ||
                  desa.kabupaten === filters.kabupaten) &&
                (filters.kecamatan === "all" ||
                  desa.kecamatan === filters.kecamatan),
            )
            .map((desa) => desa.nama),
        ),
      ].sort(),
    [filters.kabupaten, filters.kecamatan, desaList],
  );
  const villages = filterVillages(desaList, filters);
  const selected = list.find((hotspot) => hotspot.id === selectedId);
  const update = <K extends keyof MapFilters>(key: K, value: MapFilters[K]) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setVisibleHotspots(ITEMS_PER_PAGE);
    setVisibleReports(ITEMS_PER_PAGE);
    router.replace("/peta");
  };
  const updateKabupaten = (value: string) => {
    setFilters((previous) => ({
      ...previous,
      kabupaten: value,
      kecamatan: "all",
      desa: "all",
    }));
    setVisibleHotspots(ITEMS_PER_PAGE);
    setVisibleReports(ITEMS_PER_PAGE);
    router.replace("/peta");
  };
  const updateKecamatan = (value: string) => {
    setFilters((previous) => ({
      ...previous,
      kecamatan: value,
      desa: "all",
    }));
    setVisibleHotspots(ITEMS_PER_PAGE);
    setVisibleReports(ITEMS_PER_PAGE);
    router.replace("/peta");
  };
  const reset = () => {
    setFilters(defaultMapFilters);
    setVisibleHotspots(ITEMS_PER_PAGE);
    setVisibleReports(ITEMS_PER_PAGE);
    router.replace("/peta");
  };
  const visibleHotspotList = list.slice(0, visibleHotspots);
  const visibleReportList = reportList.slice(0, visibleReports);
  const active =
    Number(filters.kabupaten !== "all") +
    Number(filters.kecamatan !== "all") +
    Number(filters.desa !== "all") +
    Number(filters.status !== "all") +
    Number(filters.lahan !== "all") +
    Number(!filters.hideFalse);

  return (
    <main className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden md:flex-row">
      <aside
        className="order-2 flex min-h-0 flex-1 flex-col border-t bg-card md:order-1 md:w-[360px] md:flex-none md:border-r md:border-t-0"
        aria-label="Daftar titik api"
      >
        <div className="shrink-0 space-y-4 border-b px-5 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Titik api</h1>
            <span className="text-xs text-muted-foreground">Hari ini</span>
          </div>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Cari desa atau kabupaten"
                value={filters.query}
                onChange={(e) => update("query", e.target.value)}
                placeholder="Cari desa atau kabupaten"
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={active ? "secondary" : "outline"}
                  className="h-10 shrink-0 px-3 text-black"
                  aria-label="Filter titik api"
                >
                  <Filter />
                  <span className="hidden sm:inline">Filter</span>
                  {active > 0 && <span className="text-xs">{active}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="z-[2000] w-72 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Filter titik api</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Reset filter"
                    onClick={reset}
                  >
                    <RotateCcw />
                  </Button>
                </div>
                <SearchSelect
                  ariaLabel="Kabupaten / kota"
                  onOpenChange={(open) => {
                    if (open) void loadRegions("kabupaten");
                  }}
                  value={filters.kabupaten}
                  onChange={updateKabupaten}
                  triggerClassName="text-black"
                  options={[
                    { value: "all", label: "Semua wilayah" },
                    ...districts.map((d) => ({ value: d, label: d })),
                  ]}
                />
                <SearchSelect
                  ariaLabel="Kecamatan"
                  onOpenChange={(open) => {
                    if (open) void loadRegions("kecamatan");
                  }}
                  value={filters.kecamatan}
                  disabled={
                    filters.kabupaten === "all" || kecamatans.length === 0
                  }
                  onChange={updateKecamatan}
                  triggerClassName="text-black"
                  options={[
                    { value: "all", label: "Semua kecamatan" },
                    ...kecamatans.map((kecamatan) => ({
                      value: kecamatan,
                      label: kecamatan,
                    })),
                  ]}
                />
                <SearchSelect
                  ariaLabel="Desa"
                  onOpenChange={(open) => {
                    if (open) void loadRegions("desa");
                  }}
                  value={filters.desa}
                  disabled={
                    filters.kecamatan === "all" ||
                    villagesForFilter.length === 0
                  }
                  onChange={(v) => update("desa", v)}
                  triggerClassName="text-black"
                  options={[
                    { value: "all", label: "Semua desa" },
                    ...villagesForFilter.map((desa) => ({
                      value: desa,
                      label: desa,
                    })),
                  ]}
                />
                <SearchSelect
                  ariaLabel="Status kejadian"
                  value={filters.status}
                  onChange={(v) => update("status", v)}
                  triggerClassName="text-black"
                  options={[
                    { value: "all", label: "Semua status" },
                    ...Object.entries(statusLabel).map(([value, label]) => ({
                      value,
                      label,
                    })),
                  ]}
                />
                <SearchSelect
                  ariaLabel="Jenis lahan"
                  value={filters.lahan}
                  onChange={(v) => update("lahan", v)}
                  triggerClassName="text-black"
                  options={[
                    { value: "all", label: "Semua lahan" },
                    { value: "gambut", label: "Gambut" },
                    { value: "mineral", label: "Mineral" },
                  ]}
                />
                <div className="flex items-center justify-between border-t py-3 text-sm">
                  Sembunyikan &quot;bukan api&quot;
                  <Checkbox
                    checked={filters.hideFalse}
                    onCheckedChange={(v: boolean | "indeterminate") =>
                      update("hideFalse", v === true)
                    }
                  />
                </div>
                <Button
                  className="w-full text-black"
                  onClick={() => setFilterOpen(false)}
                >
                  Tampilkan {list.length} titik api
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-2 px-2 text-xs text-muted-foreground">
            {hotspotsLoading ? "Memuat titik..." : `${list.length} titik`} ·{" "}
            {reportsLoading
              ? "Memuat laporan..."
              : `${reportList.length} laporan`}{" "}
            · {villages.length} desa
          </div>
          <ul className="space-y-2">
            {hotspotsLoading
              ? [
                  "hotspot-a",
                  "hotspot-b",
                  "hotspot-c",
                  "hotspot-d",
                  "hotspot-e",
                ].map((key) => (
                  <li
                    key={key}
                    className="h-20 animate-pulse rounded-xl border bg-muted/40"
                  />
                ))
              : visibleHotspotList.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition hover:bg-muted/60",
                        selectedId === h.id && "border-primary bg-accent",
                      )}
                      onClick={() =>
                        router.replace(`/peta?id=${encodeURIComponent(h.id)}`)
                      }
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                          <Flame className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <strong className="truncate text-sm">
                              {h.desa}
                            </strong>
                            <StatusBadge status={h.status} />
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {h.id} · {h.kabupaten} · {h.waktu}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Confidence {h.confidence}% ·{" "}
                            {h.gambut ? "Gambut" : "Mineral"}
                          </span>
                        </span>
                      </div>
                    </button>
                    {selected?.id === h.id && <HotspotDetails hotspot={h} />}
                  </li>
                ))}
          </ul>
          {!hotspotsLoading && visibleHotspots < list.length && (
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              onClick={() =>
                setVisibleHotspots((count) => count + ITEMS_PER_PAGE)
              }
            >
              Muat lebih banyak titik
            </Button>
          )}
          {regionsLoading && (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Memuat batas wilayah...
            </p>
          )}
          {reportsError && (
            <p className="px-2 py-3 text-xs text-destructive">{reportsError}</p>
          )}
          {reportList.length > 0 && (
            <section className="mt-5 border-t pt-4">
              <h2 className="mb-2 px-2 text-sm font-semibold">Laporan warga</h2>
              <ul className="space-y-2">
                {visibleReportList.map((report) => (
                  <li key={report.id}>
                    <div
                      className={cn(
                        "w-full rounded-xl border p-3 transition hover:bg-muted/60",
                        selectedReportId === report.id &&
                          "border-primary bg-accent",
                      )}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() =>
                          router.replace(
                            `/peta?report=${encodeURIComponent(report.id)}`,
                          )
                        }
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Camera className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate text-sm">
                              {report.region?.name ?? "Wilayah belum tersedia"}
                            </strong>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {report.id} ·{" "}
                              {report.region?.parent?.name ??
                                "Kabupaten belum tersedia"}
                            </span>
                            <span className="mt-1 block truncate text-xs text-muted-foreground">
                              {report.description ?? "Deskripsi belum tersedia"}
                            </span>
                            {report.media.length > 0 && (
                              <span className="mt-1 block text-xs text-primary">
                                {report.media.length} gambar bukti
                              </span>
                            )}
                          </span>
                        </div>
                      </button>
                      {can("verifikasi") && (
                        <div className="mt-2">
                          <ReportVerificationActions
                            reportId={report.id}
                            status={report.status}
                            incidentId={report.incident_id}
                            onUpdated={refreshReports}
                          />
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {!reportsLoading && visibleReports < reportList.length && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() =>
                    setVisibleReports((count) => count + ITEMS_PER_PAGE)
                  }
                >
                  Muat lebih banyak laporan
                </Button>
              )}
            </section>
          )}
          {!hotspotsLoading &&
            !reportsLoading &&
            list.length === 0 &&
            reportList.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada titik atau laporan yang sesuai.
              </p>
            )}
        </div>
      </aside>
      <section className="relative order-1 min-h-[48vh] flex-1 md:order-2">
        <ClientMap
          showRisk={showRisk}
          showHotspots
          showReports={showReports}
          hideFalse={filters.hideFalse}
          selectedId={selectedId}
          selectedReportId={selectedReportId}
          onSelect={(h) =>
            router.replace(`/peta?id=${encodeURIComponent(h.id)}`)
          }
          onSelectReport={(report) =>
            router.replace(`/peta?report=${encodeURIComponent(report.id)}`)
          }
          compact={false}
          hotspotIds={list.map((h) => h.id)}
          villageNames={villages.map((v) => v.nama)}
          reports={reports}
          publicHotspots={publicHotspots}
          publicIncidents={publicIncidents}
          onSelectPublicHotspot={(hotspot) =>
            router.replace(`/peta?id=${encodeURIComponent(hotspot.id)}`)
          }
          regions={regions}
          regionLevels={regionLevels}
        />
        <div className="absolute right-4 top-4 z-[500] rounded-xl border bg-card/95 p-3 shadow-sm">
          <div className="mb-2 text-xs font-semibold">Lapisan peta</div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={showRisk}
                onCheckedChange={(v: boolean | "indeterminate") =>
                  setShowRisk(v === true)
                }
              />
              Risiko desa
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={showReports}
                onCheckedChange={(v: boolean | "indeterminate") =>
                  setShowReports(v === true)
                }
              />
              Laporan warga
            </div>
            {(["kabupaten", "kecamatan", "desa"] as const).map((level) => (
              <div key={level} className="flex items-center gap-2">
                <Checkbox
                  checked={regionLevels.includes(level)}
                  onCheckedChange={(checked) =>
                    setRegionLevels((current) =>
                      checked === true
                        ? [...current, level]
                        : current.filter((item) => item !== level),
                    )
                  }
                />
                Batas {level === "desa" ? "kelurahan/desa" : level}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
