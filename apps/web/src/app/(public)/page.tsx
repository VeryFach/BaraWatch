"use client";

import {
  AlertTriangle,
  ArrowRight,
  CloudSun,
  Droplets,
  Flame,
  Megaphone,
  Wind,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "@/components/AppState";
import { ClientMap } from "@/components/ClientMap";
import { ReportDialog } from "@/components/ReportDialog";
import { SearchSelect } from "@/components/SearchSelect";
import { RiskDot } from "@/components/StatusBadge";
import type {
  PublicHotspot,
  PublicIncident,
  PublicRegion,
} from "@/lib/public-api";
import { dashboardView, roles } from "@/lib/roles";
import { type Risk, riskLabel, riskVar } from "@/lib/ui-data";

import { cn } from "@/lib/utils";

const card = "rounded-2xl border bg-card";

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <div className={cn(card, "p-6")}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>

        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            tone,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-4 text-3xl font-semibold tracking-tight">{value}</div>

      <div className="mt-1 text-sm text-muted-foreground">{hint}</div>
    </div>
  );
}

function SectionHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-6 pb-3">
      <div>
        <h2 className="font-semibold">{title}</h2>

        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>

      {action}
    </div>
  );
}

type DashboardWeather = {
  location: string;
  observedAt: string | null;
  temperatureC: number;
  humidityPercent: number;
  windSpeedKmh: number;
  source: string;
};

function WeatherRow({
  weather,
  loading,
  error,
}: {
  weather: DashboardWeather | null;
  loading: boolean;
  error: string | null;
}) {
  const value = (number: number | undefined, suffix: string) =>
    loading
      ? "Memuat…"
      : error || number === undefined
        ? "—"
        : `${number.toFixed(1)}${suffix}`;

  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <div>
        <Droplets className="mb-1 h-4 w-4 text-muted-foreground" />
        {value(weather?.humidityPercent, "%")}
        <div className="text-xs text-muted-foreground">Kelembapan</div>
      </div>

      <div>
        <CloudSun className="mb-1 h-4 w-4 text-muted-foreground" />
        {value(weather?.temperatureC, " °C")}
        <div className="text-xs text-muted-foreground">Suhu</div>
      </div>

      <div>
        <Wind className="mb-1 h-4 w-4 text-muted-foreground" />
        {value(weather?.windSpeedKmh, " km/j")}
        <div className="text-xs text-muted-foreground">Kecepatan angin</div>
      </div>
      <div className="col-span-3 text-xs text-muted-foreground">
        {error ??
          (weather?.observedAt
            ? `${weather.location} · diperbarui ${new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(weather.observedAt))} WIB · ${weather.source}`
            : (weather?.location ?? "Cuaca Kalimantan Tengah"))}
      </div>
    </div>
  );
}

function MapPreview({
  hotspots: publicHotspots,
  incidents,
  error,
}: {
  hotspots: PublicHotspot[] | undefined;
  incidents: PublicIncident[];
  error: string | null;
}) {
  return (
    <div className={cn(card, "overflow-hidden")}>
      <SectionHead
        title="Peta sekilas"
        sub={error ?? "Hotspot tersaring dan insiden dari database"}
        action={
          <Link
            href="/peta"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Buka peta
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="h-80">
        <ClientMap
          showRisk={false}
          showHotspots
          hideFalse
          compact
          publicHotspots={publicHotspots}
          publicIncidents={incidents}
        />
      </div>
    </div>
  );
}

type PublicRiskRow = {
  region_id: string;
  region_code: string;
  region_name: string;
  region_level: string;
  week_start: string;
  risk_level: string;
  score: number | null;
  top_reasons: string[];
  method: string;
};

type DashboardRegion = PublicRegion & {
  district: string | null;
  subdistrict: string | null;
};

type TrendPoint = { hari: string; mentah: number; tersaring: number };

function riskValue(value: string): Risk | null {
  return ["rendah", "sedang", "tinggi", "ekstrem"].includes(value)
    ? (value as Risk)
    : null;
}

function RawanCard({
  risks,
  regions,
  error,
}: {
  risks: PublicRiskRow[];
  regions: DashboardRegion[];
  error: string | null;
}) {
  const regionById = new Map(regions.map((region) => [region.id, region]));
  const rawan = risks
    .filter((row) => row.region_level === "desa")
    .map((row) => ({ ...row, risk: riskValue(row.risk_level) }))
    .filter((row) => row.risk === "ekstrem" || row.risk === "tinggi")
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0));

  return (
    <div className={cn(card, "p-6")}>
      <h2 className="font-semibold">Desa paling rawan</h2>

      <p className="text-sm text-muted-foreground">
        Prediksi risiko mingguan dari hasil pipeline
      </p>

      <ul className="mt-4 space-y-4">
        {rawan.slice(0, 4).map((desa) => {
          const region = regionById.get(desa.region_id);
          const subdistrict = region?.parent_id
            ? regionById.get(region.parent_id)
            : undefined;
          const district = subdistrict?.parent_id
            ? regionById.get(subdistrict.parent_id)
            : undefined;
          return (
            <li
              key={desa.region_id}
              className="flex items-start justify-between gap-4"
            >
              <div>
                <div className="font-medium">{desa.region_name}</div>
                <div className="text-sm text-muted-foreground">
                  {desa.top_reasons.join(" · ") ||
                    "Alasan risiko belum tersedia"}
                  {district ? ` · ${district.name}` : ""}
                </div>
              </div>
              {desa.risk && <RiskDot risk={desa.risk} />}
            </li>
          );
        })}
        {error && <li className="text-sm text-destructive">{error}</li>}
        {!error && rawan.length === 0 && (
          <li className="text-sm text-muted-foreground">
            Belum ada desa berisiko tinggi pada data risiko mingguan.
          </li>
        )}
      </ul>
    </div>
  );
}

function TrendCard({
  data,
  loading,
  error,
}: {
  data: TrendPoint[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className={cn(card, "p-6")}>
      <h2 className="font-semibold">Tren 7 hari</h2>

      <p className="text-sm text-muted-foreground">
        Hotspot mentah vs alert setelah disaring
      </p>

      <div className="mt-6 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -20, right: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />

            <XAxis
              dataKey="hari"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              stroke="var(--muted-foreground)"
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={12}
              stroke="var(--muted-foreground)"
            />

            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            />

            <Area
              type="monotone"
              dataKey="mentah"
              name="Mentah"
              stroke="var(--muted-foreground)"
              fill="var(--muted)"
              strokeWidth={2}
            />

            <Area
              type="monotone"
              dataKey="tersaring"
              name="Tersaring"
              stroke="var(--chart-1)"
              fill="var(--chart-1)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {loading && <p className="text-xs text-muted-foreground">Memuat tren…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function AlertList({
  incidents,
  error,
}: {
  incidents: PublicIncident[];
  error: string | null;
}) {
  return (
    <div className={card}>
      <SectionHead
        title="Kejadian terbaru"
        sub={error ?? "Insiden terbaru dari database"}
        action={
          <Link
            href="/kejadian?jenis=kejadian"
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Lihat semua
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <ul className="divide-y">
        {incidents.slice(0, 6).map((incident) => {
          return (
            <li
              key={incident.id}
              className="flex flex-wrap items-center gap-4 px-6 py-4"
            >
              <span className="w-12 text-sm tabular-nums text-muted-foreground">
                {new Intl.DateTimeFormat("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Jakarta",
                }).format(new Date(incident.lastDetectedAt))}
              </span>

              <Link
                href={`/peta?id=${encodeURIComponent(incident.id)}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <div className="truncate font-medium">
                  {incident.regionName ?? "Lokasi belum tersedia"}
                </div>

                <div className="text-sm text-muted-foreground">
                  {incident.source === "both"
                    ? "Satelit dan laporan"
                    : incident.source === "satellite"
                      ? "Satelit"
                      : "Laporan warga"}{" "}
                  · {incident.hotspotCount} hotspot
                </div>
              </Link>

              <span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize text-muted-foreground">
                {incident.status.replaceAll("_", " ")}
              </span>
            </li>
          );
        })}
        {error && (
          <li className="px-6 py-6 text-sm text-destructive">{error}</li>
        )}
        {!error && incidents.length === 0 && (
          <li className="px-6 py-6 text-sm text-muted-foreground">
            Belum ada insiden untuk ditampilkan.
          </li>
        )}
      </ul>
    </div>
  );
}

function LaporanBadge({
  status,
}: {
  status: "menunggu" | "diterima" | "ditolak";
}) {
  const styles = {
    menunggu: "bg-risk-medium/20 text-foreground",
    diterima: "bg-forest/10 text-forest",
    ditolak: "bg-muted text-muted-foreground",
  };

  const labels = {
    menunggu: "Ditinjau",
    diterima: "Diterima",
    ditolak: "Tidak valid",
  };

  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status],
      )}
    >
      {labels[status]}
    </span>
  );
}

export default function DashboardPage() {
  const { role } = useApp();
  const view = dashboardView(role);

  return (
    <>
      {view !== "publik" && (
        <div className="border-b bg-primary/10 px-4 py-2.5 text-center text-sm">
          <span className="text-muted-foreground">
            Anda masuk sebagai {roles[role]?.label}.{" "}
          </span>
          <Link
            href={
              view === "admin"
                ? "/admin"
                : view === "petugas"
                  ? "/petugas"
                  : "/penegak-hukum"
            }
            className="font-medium text-primary underline underline-offset-4 hover:opacity-80"
          >
            Buka Dashboard {roles[role]?.short} &rarr;
          </Link>
        </div>
      )}
      <PublicDashboard />
    </>
  );
}

function PublicDashboard() {
  const { laporan, reportsLoading, reportsError } = useApp();
  const [hotspots, setHotspots] = useState<PublicHotspot[]>([]);
  const [incidents, setIncidents] = useState<PublicIncident[]>([]);
  const [risks, setRisks] = useState<PublicRiskRow[]>([]);
  const [regions, setRegions] = useState<DashboardRegion[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [weather, setWeather] = useState<DashboardWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [hotspotError, setHotspotError] = useState<string | null>(null);
  const [incidentError, setIncidentError] = useState<string | null>(null);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [kabupaten, setKabupaten] = useState("all");
  const [kecamatan, setKecamatan] = useState("all");
  const [desa, setDesa] = useState("all");
  const defaultLocationInitialized = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const endpoints = [
        ["hotspots", "/api/public/hotspots?limit=200"],
        ["incidents", "/api/public/incidents?limit=200"],
        ["risks", "/api/public/risk"],
        ["regions", "/api/public/regions?include_geometry=false"],
        ["trend", "/api/public/hotspot-trend"],
        ["weather", "/api/public/weather"],
      ] as const;
      const results = await Promise.allSettled(
        endpoints.map(async ([key, url]) => {
          const response = await fetch(url, {
            signal: controller.signal,
            cache: "no-store",
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error ?? `${key} unavailable`);
          return [key, body.data] as const;
        }),
      );
      if (controller.signal.aborted) return;
      for (const [index, result] of results.entries()) {
        if (result.status === "rejected") {
          const key = endpoints[index][0];
          const message = "Data sedang tidak tersedia.";
          if (key === "hotspots") setHotspotError(message);
          if (key === "incidents") setIncidentError(message);
          if (key === "risks") setRiskError(message);
          if (key === "regions") setRegionError(message);
          if (key === "trend") setTrendError(message);
          if (key === "weather") {
            setWeatherError(message);
            setWeatherLoading(false);
          }
          continue;
        }
        const [key, data] = result.value;
        if (key === "hotspots") setHotspots(data as PublicHotspot[]);
        if (key === "incidents") setIncidents(data as PublicIncident[]);
        if (key === "risks") setRisks(data as PublicRiskRow[]);
        if (key === "trend") setTrend(data as TrendPoint[]);
        if (key === "weather") {
          setWeather(data as DashboardWeather);
          setWeatherLoading(false);
        }
        if (key === "regions") {
          const rows = data as PublicRegion[];
          setRegions(
            rows.map((region) => ({
              ...region,
              district: null,
              subdistrict: null,
            })),
          );
          if (!defaultLocationInitialized.current) {
            const byId = new Map(rows.map((region) => [region.id, region]));
            const defaultVillage =
              rows.find(
                (region) =>
                  region.level === "desa" &&
                  region.name.toLowerCase() === "kalampangan",
              ) ?? rows.find((region) => region.level === "desa");
            const subdistrict = defaultVillage?.parent_id
              ? byId.get(defaultVillage.parent_id)
              : undefined;
            const district = subdistrict?.parent_id
              ? byId.get(subdistrict.parent_id)
              : undefined;
            if (defaultVillage) {
              setKabupaten(district?.id ?? "all");
              setKecamatan(subdistrict?.id ?? "all");
              setDesa(defaultVillage.id);
            }
            defaultLocationInitialized.current = true;
          }
        }
      }
      setLoading(false);
    };
    void load();
    return () => controller.abort();
  }, []);

  const regionById = useMemo(
    () => new Map(regions.map((region) => [region.id, region])),
    [regions],
  );
  const kabupatenOptions = useMemo(
    () => regions.filter((region) => region.level === "kabupaten"),
    [regions],
  );
  const kecamatanOptions = useMemo(
    () =>
      regions.filter(
        (region) =>
          region.level === "kecamatan" &&
          (kabupaten === "all" || region.parent_id === kabupaten),
      ),
    [regions, kabupaten],
  );
  const desaOptions = useMemo(
    () =>
      regions.filter(
        (region) =>
          region.level === "desa" &&
          (kecamatan !== "all"
            ? region.parent_id === kecamatan
            : kabupaten === "all" ||
              (region.parent_id !== null &&
                regionById.get(region.parent_id)?.parent_id === kabupaten)),
      ),
    [regions, regionById, kabupaten, kecamatan],
  );
  const selectedDesa = desaOptions.find((region) => region.id === desa);
  const selectedRisk = selectedDesa
    ? risks.find((risk) => risk.region_id === selectedDesa.id)
    : undefined;
  const selectedRiskLevel = selectedRisk
    ? riskValue(selectedRisk.risk_level)
    : null;
  const rawan = risks.filter(
    (row) =>
      row.region_level === "desa" &&
      ["tinggi", "ekstrem"].includes(row.risk_level),
  ).length;
  const hotspotsToday = trend.at(-1)?.tersaring ?? 0;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      {/* PAGE HEADER */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Kalimantan Tengah</p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Pantauan karhutla
          </h1>
        </div>

        <Link
          href="/peta"
          className="flex items-center gap-2 rounded-full bg-destructive/10 px-5 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/15"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
          {loading
            ? "Memuat hotspot…"
            : (hotspotError ?? `${hotspotsToday} hotspot tersaring hari ini`)}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* STATISTICS */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={Flame}
          label="Hotspot tersaring 7 hari"
          value={
            trendError
              ? "—"
              : String(trend.reduce((sum, point) => sum + point.tersaring, 0))
          }
          hint={trendError ?? "Jumlah berdasarkan waktu observasi"}
          tone="bg-destructive/10 text-destructive"
        />

        <Stat
          icon={AlertTriangle}
          label="Desa berisiko tinggi"
          value={riskError ? "—" : String(rawan)}
          hint={riskError ?? "Desa dengan risiko tinggi atau ekstrem"}
          tone="bg-risk-medium/20 text-foreground"
        />

        <Stat
          icon={CloudSun}
          label="Suhu Kalimantan Tengah"
          value={
            weatherError
              ? "—"
              : weather
                ? `${weather.temperatureC.toFixed(1)} °C`
                : "Memuat…"
          }
          hint={weatherError ?? "Data terkini dari Open-Meteo"}
          tone="bg-forest/10 text-forest"
        />
      </section>

      {/* VILLAGE RISK + REPORT */}
      <section className="grid gap-6 lg:grid-cols-5">
        <div className={cn(card, "p-8 lg:col-span-3")}>
          <div id="desa-label" className="text-sm text-muted-foreground">
            Cek risiko desa
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <SearchSelect
              ariaLabel="Pilih kabupaten"
              value={kabupaten}
              onChange={(value) => {
                setKabupaten(value);
                setKecamatan("all");
                setDesa("all");
              }}
              options={[
                { value: "all", label: "Semua kabupaten" },
                ...kabupatenOptions.map((region) => ({
                  value: region.id,
                  label: region.name,
                })),
              ]}
              triggerClassName="text-foreground"
            />
            <SearchSelect
              ariaLabel="Pilih kecamatan"
              value={kecamatan}
              onChange={(value) => {
                setKecamatan(value);
                setDesa("all");
              }}
              options={[
                { value: "all", label: "Semua kecamatan" },
                ...kecamatanOptions.map((region) => ({
                  value: region.id,
                  label: region.name,
                })),
              ]}
              triggerClassName="text-foreground"
            />
            <SearchSelect
              labelledBy="desa-label"
              searchPlaceholder="Cari desa..."
              value={desa}
              onChange={setDesa}
              options={[
                { value: "all", label: "Semua desa" },
                ...desaOptions.map((region) => ({
                  value: region.id,
                  label: region.name,
                })),
              ]}
              triggerClassName="text-foreground"
            />
          </div>

          <div className="mt-8 flex items-center gap-5">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl"
              style={{
                background: selectedRiskLevel
                  ? `color-mix(in oklab, ${riskVar[selectedRiskLevel]} 20%, transparent)`
                  : "var(--muted)",
              }}
            >
              <AlertTriangle
                className="h-9 w-9"
                style={{
                  color: selectedRiskLevel
                    ? riskVar[selectedRiskLevel]
                    : "var(--muted-foreground)",
                }}
              />
            </div>

            <div>
              <div className="text-sm text-muted-foreground">
                Risiko minggu ini
              </div>

              <div
                className="text-3xl font-semibold"
                style={{
                  color: selectedRiskLevel
                    ? riskVar[selectedRiskLevel]
                    : undefined,
                }}
              >
                {loading
                  ? "Memuat…"
                  : riskError
                    ? "Tidak tersedia"
                    : selectedRiskLevel
                      ? riskLabel[selectedRiskLevel]
                      : "Belum tersedia"}
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                {riskError || regionError
                  ? (riskError ?? regionError)
                  : selectedRisk
                    ? selectedRisk.top_reasons.join(" · ") ||
                      "Alasan belum tersedia"
                    : selectedDesa
                      ? `Belum ada skor untuk ${selectedDesa.name}`
                      : "Pilih desa untuk melihat skor risiko"}
              </div>
            </div>
          </div>

          <div className="mt-8 border-t pt-6">
            <WeatherRow
              weather={weather}
              loading={weatherLoading}
              error={weatherError}
            />
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className={cn(card, "bg-accent p-6")}>
            <Megaphone className="h-6 w-6 text-accent-foreground" />

            <h2 className="mt-3 font-semibold">Lihat api atau asap?</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Laporkan sekarang. Tim desa dan petugas akan menindaklanjuti.
            </p>

            <ReportDialog defaultDesa={selectedDesa?.name ?? ""}>
              <button
                type="button"
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Megaphone className="h-4 w-4" />
                Laporkan sekarang
              </button>
            </ReportDialog>
          </div>

          <div className={cn(card, "p-6")}>
            <h2 className="font-semibold">Yang perlu dilakukan</h2>

            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>• Jangan membuka lahan dengan cara membakar.</li>
              <li>• Siapkan air di sekitar rumah dan kebun.</li>
              <li>• Hubungi MPA desa melalui kontak resmi.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* MAP + HIGH RISK VILLAGES */}
      <section className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <MapPreview
            hotspots={hotspots}
            incidents={incidents}
            error={hotspotError ?? incidentError}
          />
        </div>

        <div className="lg:col-span-2">
          <RawanCard risks={risks} regions={regions} error={riskError} />
        </div>
      </section>

      {/* HOTSPOT TREND */}
      <section>
        <TrendCard data={trend} loading={loading} error={trendError} />
      </section>

      {/* RECENT INCIDENTS */}
      <AlertList incidents={incidents} error={incidentError} />

      {/* COMMUNITY REPORTS */}
      <section className={card}>
        <SectionHead
          title="Laporan masyarakat"
          sub={reportsError ?? "Status laporan api dan asap"}
          action={
            <Link
              href="/kejadian?jenis=laporan"
              className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Lihat semua
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />

        <ul className="divide-y">
          {laporan.slice(0, 3).map((item) => (
            <li key={item.id} className="flex items-center gap-4 px-6 py-4">
              <span className="w-12 text-sm text-muted-foreground">
                {item.waktu}
              </span>

              <div className="flex-1">
                <div className="font-medium">
                  {item.jenis} di {item.desa}
                </div>

                <div className="text-sm text-muted-foreground">
                  {item.catatan}
                </div>
              </div>

              <LaporanBadge status={item.status} />
            </li>
          ))}
          {!reportsLoading && laporan.length === 0 && (
            <li className="px-6 py-6 text-sm text-muted-foreground">
              {reportsError ?? "Belum ada laporan masyarakat."}
            </li>
          )}
          {reportsLoading && (
            <li className="px-6 py-6 text-sm text-muted-foreground">
              Memuat laporan…
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
