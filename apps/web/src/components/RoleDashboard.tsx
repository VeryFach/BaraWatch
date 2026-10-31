"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Database,
  Flame,
  ScrollText,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useApp } from "@/components/AppState";
import { ClientMap } from "@/components/ClientMap";
import { LawDashboard } from "@/components/LawDashboard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { hotspots, resources, trend7d } from "@/lib/dummy-data";
import type { dashboardView } from "@/lib/roles";
import { cn } from "@/lib/utils";

type DashboardView = ReturnType<typeof dashboardView>;
const card = "rounded-2xl border bg-card";

export function RoleDashboard({
  view,
}: {
  view: Exclude<DashboardView, "publik">;
}) {
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      {view === "petugas" && <PetugasView />}
      {view === "admin" && <AdminView />}
      {view === "hukum" && <HukumView />}
    </main>
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

function TrendCard() {
  return (
    <div className={cn(card, "p-6")}>
      <h2 className="font-semibold">Tren 7 hari</h2>
      <p className="text-sm text-muted-foreground">
        Hotspot mentah vs alert setelah disaring
      </p>
      <div className="mt-6 h-56">
        <ResponsiveContainer>
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

function MapPreview({ showKonsesi = false }: { showKonsesi?: boolean }) {
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
            Buka peta <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
      <div className="h-80">
        <ClientMap
          showRisk
          showHotspots
          hideFalse
          compact
          showKonsesi={showKonsesi}
        />
      </div>
    </div>
  );
}

function AlertList() {
  const { can, statusOf, setStatus, escalate, escalated } = useApp();
  const list = hotspots
    .filter((h) => statusOf(h.id) !== "bukan-api")
    .slice(0, 6);
  return (
    <div className={card}>
      <SectionHead
        title="Kejadian terbaru"
        sub="Klik nama untuk membuka detail dan memperbarui status"
        action={
          <Button asChild variant="link" className="h-auto p-0 text-sm">
            <Link href="/laporan">
              Lihat semua <ArrowRight />
            </Link>
          </Button>
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
              {can("verifikasi") && status === "baru" ? (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setStatus(hotspot.id, "diverifikasi");
                      toast.success(`${hotspot.desa}: ditandai api nyata`);
                    }}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  >
                    Api nyata
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus(hotspot.id, "bukan-api");
                      toast(`${hotspot.desa}: ditandai bukan api`);
                    }}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                  >
                    Bukan
                  </button>
                </div>
              ) : can("eskalasi") && status === "diverifikasi" ? (
                escalated.includes(hotspot.id) ? (
                  <span className="text-xs font-medium text-forest">
                    ✓ Dieskalasi ke BPBD
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      escalate(hotspot.id);
                      toast.success(`Eskalasi ${hotspot.desa} dikirim ke BPBD`);
                    }}
                    className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" /> Eskalasi
                  </button>
                )
              ) : (
                <StatusBadge status={status} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PetugasView() {
  const active = hotspots.filter((h) => h.status !== "bukan-api").length;
  const verified = hotspots.filter((h) => h.status === "diverifikasi").length;
  return (
    <>
      <header>
        <p className="text-sm text-muted-foreground">
          Operasional lapangan · Kalimantan Tengah
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Selamat sore, petugas
        </h1>
      </header>
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={Flame}
          label="Titik aktif"
          value={String(active)}
          hint="Perlu dipantau"
          tone="bg-destructive/10 text-destructive"
        />
        <Stat
          icon={Check}
          label="Terverifikasi"
          value={String(verified)}
          hint="Api nyata"
          tone="bg-forest/10 text-forest"
        />
        <Stat
          icon={ArrowUpRight}
          label="Dapat dieskalasi"
          value={String(Math.max(0, verified - 1))}
          hint="Ke BPBD"
          tone="bg-risk-medium/20 text-foreground"
        />
      </section>
      <section className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <MapPreview />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <TeamCard />
          <TrendCard />
        </div>
      </section>
      <AlertList />
    </>
  );
}

function TeamCard() {
  return (
    <div className={cn(card, "p-6")}>
      <h2 className="font-semibold">Tim di lapangan</h2>
      <ul className="mt-4 space-y-3">
        {resources.map((resource) => (
          <li
            key={resource.nama}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <div>
              <div className="font-medium">{resource.nama}</div>
              <div className="text-muted-foreground">
                {resource.lokasi} ·{" "}
                {resource.anggota === null
                  ? "Jumlah belum tersedia"
                  : `${resource.anggota} orang`}
              </div>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
              {resource.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminView() {
  const { laporan, setLaporanStatus } = useApp();
  const pending = laporan.filter((report) => report.status === "menunggu");
  return (
    <>
      <header>
        <p className="text-sm text-muted-foreground">
          Administrasi data dan kualitas model
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Selamat sore, admin
        </h1>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={ScrollText}
          label="Laporan ragu"
          value={String(pending.length)}
          hint="Menunggu ditinjau"
          tone="bg-risk-medium/20 text-foreground"
        />
        <Stat
          icon={Check}
          label="Label terkumpul"
          value="1.284"
          hint="+37 minggu ini"
          tone="bg-forest/10 text-forest"
        />
        <Stat
          icon={ShieldCheck}
          label="Presisi filter"
          value="81%"
          hint="Versi aturan v0.3"
          tone="bg-primary/10 text-accent-foreground"
        />
        <Stat
          icon={Database}
          label="Sumber data"
          value="4/5"
          hint="1 perlu perhatian"
          tone="bg-destructive/10 text-destructive"
        />
      </section>
      <section className="grid gap-6 lg:grid-cols-5">
        <div className={cn(card, "lg:col-span-3")}>
          <SectionHead
            title="Antrean laporan ragu"
            sub="Skor AI deteksi asap hanya terlihat oleh admin"
            action={
              <Button asChild variant="link" className="h-auto p-0 text-sm">
                <Link href="/laporan">
                  Lihat semua <ArrowRight />
                </Link>
              </Button>
            }
          />
          {pending.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Semua laporan sudah ditinjau.
            </p>
          ) : (
            <ul className="divide-y">
              {pending.map((report) => (
                <li
                  key={report.id}
                  className="flex flex-wrap items-center gap-4 px-6 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {report.jenis} di {report.desa}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        · {report.id} · {report.waktu}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {report.catatan}
                    </div>
                  </div>
                  <div className="w-24 text-xs text-muted-foreground">
                    Skor AI {Math.round(report.skorAI * 100)}%
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${report.skorAI * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setLaporanStatus(report.id, "diterima");
                        toast.success(`${report.id} diterima`);
                      }}
                      className="rounded-lg bg-primary p-2 text-primary-foreground"
                      aria-label="Terima"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLaporanStatus(report.id, "ditolak");
                        toast(`${report.id} ditolak`);
                      }}
                      className="rounded-lg border p-2"
                      aria-label="Tolak"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={cn(card, "p-6 lg:col-span-2")}>
          <h2 className="font-semibold">Status sumber data</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              "NASA FIRMS (titik panas)",
              "RADD (pembukaan lahan)",
              "Cuaca & curah hujan",
              "Peta gambut & batas wilayah",
              "Model risiko mingguan",
            ].map((source, index) => (
              <li
                key={source}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      index === 4 ? "bg-destructive" : "bg-forest",
                    )}
                  />
                  {source}
                </span>
                <span
                  className={
                    index === 4 ? "text-destructive" : "text-muted-foreground"
                  }
                >
                  {index === 4 ? "Gagal 03:00" : "OK"}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => toast.success("Pelatihan ulang dimulai")}
            className="mt-6 w-full rounded-xl border py-2.5 text-sm font-medium"
          >
            Latih ulang model
          </button>
        </div>
      </section>
      <TrendCard />
    </>
  );
}

function HukumView() {
  return (
    <>
      <header>
        <p className="text-sm text-muted-foreground">
          Analisis kepemilikan dan dampak lahan
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Verifikasi kepemilikan lahan
        </h1>
      </header>
      <LawDashboard />
      <MapPreview showKonsesi />
    </>
  );
}
