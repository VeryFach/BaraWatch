"use client";

import { Filter, Flame, RotateCcw, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useApp } from "@/components/AppState";
import { ClientMap } from "@/components/ClientMap";
import { HotspotDetails } from "@/components/HotspotDetails";
import { SearchSelect } from "@/components/SearchSelect";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { desaList, hotspots, statusLabel } from "@/lib/dummy-data";
import {
  defaultMapFilters,
  filterHotspots,
  filterVillages,
  type MapFilters,
} from "@/lib/map-filters";
import { cn } from "@/lib/utils";

const districts = [...new Set(hotspots.map((h) => h.kabupaten))];

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
  const router = useRouter();
  const selectedId = useSearchParams().get("id");
  const { statusOf } = useApp();
  const [filters, setFilters] = useState<MapFilters>(defaultMapFilters);
  const [showRisk, setShowRisk] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showKonsesi, setShowKonsesi] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const rows = useMemo(
    () => hotspots.map((h) => ({ ...h, status: statusOf(h.id) })),
    [statusOf],
  );
  const list = filterHotspots(rows, filters);
  const villages = filterVillages(desaList, filters);
  const selected = list.find((hotspot) => hotspot.id === selectedId);
  const update = <K extends keyof MapFilters>(key: K, value: MapFilters[K]) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    router.replace("/peta");
  };
  const reset = () => {
    setFilters(defaultMapFilters);
    router.replace("/peta");
  };
  const active =
    Number(filters.kabupaten !== "all") +
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
                  className="h-10 shrink-0 px-3"
                  aria-label="Filter titik api"
                >
                  <Filter />
                  <span className="hidden sm:inline">Filter</span>
                  {active > 0 && <span className="text-xs">{active}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="z-[1100] w-72 space-y-4">
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
                  value={filters.kabupaten}
                  onChange={(v) => update("kabupaten", v)}
                  options={[
                    { value: "all", label: "Semua wilayah" },
                    ...districts.map((d) => ({ value: d, label: d })),
                  ]}
                />
                <SearchSelect
                  ariaLabel="Status kejadian"
                  value={filters.status}
                  onChange={(v) => update("status", v)}
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
                <Button className="w-full" onClick={() => setFilterOpen(false)}>
                  Tampilkan {list.length} titik api
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-2 px-2 text-xs text-muted-foreground">
            {list.length} titik · {villages.length} desa dipantau
          </div>
          <ul className="space-y-2">
            {list.map((h) => (
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
                        <strong className="truncate text-sm">{h.desa}</strong>
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
          {list.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Tidak ada titik yang sesuai.
            </p>
          )}
        </div>
      </aside>
      <section className="relative order-1 min-h-[48vh] flex-1 md:order-2">
        <ClientMap
          showRisk={showRisk}
          showHotspots={showHotspots}
          hideFalse={filters.hideFalse}
          selectedId={selectedId}
          onSelect={(h) =>
            router.replace(`/peta?id=${encodeURIComponent(h.id)}`)
          }
          compact={false}
          showKonsesi={showKonsesi}
          hotspotIds={list.map((h) => h.id)}
          villageNames={villages.map((v) => v.nama)}
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
                checked={showHotspots}
                onCheckedChange={(v: boolean | "indeterminate") =>
                  setShowHotspots(v === true)
                }
              />
              Titik api
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={showKonsesi}
                onCheckedChange={(v: boolean | "indeterminate") =>
                  setShowKonsesi(v === true)
                }
              />
              Batas konsesi
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
