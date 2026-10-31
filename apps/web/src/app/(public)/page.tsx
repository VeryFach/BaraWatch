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
import { useState } from "react";

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
import { RoleDashboard } from "@/components/RoleDashboard";
import { SearchSelect } from "@/components/SearchSelect";
import { RiskDot, StatusBadge } from "@/components/StatusBadge";
import {
  desaList,
  hotspots,
  riskLabel,
  riskVar,
  trend7d,
  weather,
} from "@/lib/dummy-data";
import { dashboardView } from "@/lib/roles";

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

function WeatherRow() {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <div>
        <Droplets className="mb-1 h-4 w-4 text-muted-foreground" />
        {weather.kelembapan}%
        <div className="text-xs text-muted-foreground">Kelembapan</div>
      </div>

      <div>
        <CloudSun className="mb-1 h-4 w-4 text-muted-foreground" />
        {weather.suhu}°C
        <div className="text-xs text-muted-foreground">Suhu</div>
      </div>

      <div>
        <Wind className="mb-1 h-4 w-4 text-muted-foreground" />
        14 km/j
        <div className="text-xs text-muted-foreground">Angin tenggara</div>
      </div>
    </div>
  );
}

function MapPreview() {
  return (
    <div className={cn(card, "overflow-hidden")}>
      <SectionHead
        title="Peta sekilas"
        sub="Titik api dan zona risiko desa"
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
        <ClientMap showRisk showHotspots hideFalse compact />
      </div>
    </div>
  );
}

function RawanCard() {
  const rawan = desaList.filter(
    (desa) => desa.risk === "ekstrem" || desa.risk === "tinggi",
  );

  return (
    <div className={cn(card, "p-6")}>
      <h2 className="font-semibold">Desa paling rawan</h2>

      <p className="text-sm text-muted-foreground">
        Prediksi risiko minggu ini
      </p>

      <ul className="mt-4 space-y-4">
        {rawan.slice(0, 4).map((desa) => (
          <li
            key={desa.nama}
            className="flex items-start justify-between gap-4"
          >
            <div>
              <div className="font-medium">{desa.nama}</div>

              <div className="text-sm text-muted-foreground">{desa.alasan}</div>
            </div>

            <RiskDot risk={desa.risk} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendCard() {
  return (
    <div className={cn(card, "p-6")}>
      <h2 className="font-semibold">Tren 7 hari</h2>

      <p className="text-sm text-muted-foreground">
        Hotspot mentah vs alert setelah disaring
      </p>

      <div className="mt-6 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend7d} margin={{ left: -20, right: 4 }}>
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
    </div>
  );
}

function AlertList() {
  const { statusOf } = useApp();

  const list = hotspots
    .filter((hotspot) => statusOf(hotspot.id) !== "bukan-api")
    .slice(0, 6);

  return (
    <div className={card}>
      <SectionHead
        title="Kejadian terbaru"
        sub="Kalimantan Tengah · hari ini"
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
        {list.map((hotspot) => {
          const status = statusOf(hotspot.id);

          return (
            <li
              key={hotspot.id}
              className="flex flex-wrap items-center gap-4 px-6 py-4"
            >
              <span className="w-12 text-sm tabular-nums text-muted-foreground">
                {hotspot.waktu}
              </span>

              <Link
                href={`/peta?id=${encodeURIComponent(hotspot.id)}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <div className="truncate font-medium">{hotspot.desa}</div>

                <div className="text-sm text-muted-foreground">
                  {hotspot.kabupaten} · {hotspot.gambut ? "Gambut" : "Mineral"}
                </div>
              </Link>

              <StatusBadge status={status} />
            </li>
          );
        })}
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

  if (view !== "publik") {
    return <RoleDashboard view={view} />;
  }

  return <PublicDashboard />;
}

function PublicDashboard() {
  const { laporan, statusOf } = useApp();

  const [desa, setDesa] = useState("Kalampangan");

  const selectedDesa =
    desaList.find((item) => item.nama === desa) ?? desaList[0];

  if (!selectedDesa) return null;

  const aktif = hotspots.filter((hotspot) =>
    ["baru", "diverifikasi", "ditangani"].includes(statusOf(hotspot.id)),
  ).length;

  const rawan = desaList.filter(
    (item) => item.risk === "tinggi" || item.risk === "ekstrem",
  ).length;

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
          {hotspots.filter((h) => statusOf(h.id) === "baru").length} titik api
          baru
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* STATISTICS */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={Flame}
          label="Titik api aktif"
          value={String(aktif)}
          hint="Di wilayah pantauan"
          tone="bg-destructive/10 text-destructive"
        />

        <Stat
          icon={AlertTriangle}
          label="Desa berisiko tinggi"
          value={String(rawan)}
          hint="Risiko tinggi dan ekstrem"
          tone="bg-risk-medium/20 text-foreground"
        />

        <Stat
          icon={CloudSun}
          label="Hari tanpa hujan"
          value={String(weather.hariTanpaHujan)}
          hint="Rata-rata provinsi"
          tone="bg-forest/10 text-forest"
        />
      </section>

      {/* VILLAGE RISK + REPORT */}
      <section className="grid gap-6 lg:grid-cols-5">
        <div className={cn(card, "p-8 lg:col-span-3")}>
          <div id="desa-label" className="text-sm text-muted-foreground">
            Cek risiko desa
          </div>

          <SearchSelect
            labelledBy="desa-label"
            searchPlaceholder="Cari desa..."
            value={desa}
            onChange={setDesa}
            options={desaList.map((item) => ({
              value: item.nama,
              label: item.nama,
            }))}
            triggerClassName="mt-2 h-12 text-base font-medium"
          />

          <div className="mt-8 flex items-center gap-5">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl"
              style={{
                background: `color-mix(in oklab, ${riskVar[selectedDesa.risk]} 20%, transparent)`,
              }}
            >
              <AlertTriangle
                className="h-9 w-9"
                style={{ color: riskVar[selectedDesa.risk] }}
              />
            </div>

            <div>
              <div className="text-sm text-muted-foreground">
                Risiko minggu ini
              </div>

              <div
                className="text-3xl font-semibold"
                style={{ color: riskVar[selectedDesa.risk] }}
              >
                {riskLabel[selectedDesa.risk]}
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                Karena {selectedDesa.alasan.toLowerCase()}
              </div>
            </div>
          </div>

          <div className="mt-8 border-t pt-6">
            <WeatherRow />
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className={cn(card, "bg-accent p-6")}>
            <Megaphone className="h-6 w-6 text-accent-foreground" />

            <h2 className="mt-3 font-semibold">Lihat api atau asap?</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Laporkan sekarang. Tim desa dan petugas akan menindaklanjuti.
            </p>

            <ReportDialog defaultDesa={desa}>
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
          <MapPreview />
        </div>

        <div className="lg:col-span-2">
          <RawanCard />
        </div>
      </section>

      {/* HOTSPOT TREND */}
      <section>
        <TrendCard />
      </section>

      {/* RECENT INCIDENTS */}
      <AlertList />

      {/* COMMUNITY REPORTS */}
      <section className={card}>
        <SectionHead
          title="Laporan masyarakat"
          sub="Status laporan api dan asap"
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
        </ul>
      </section>
    </main>
  );
}
