"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Database,
  Flame,
  ScrollText,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { resources, trend7d } from "@/lib/dummy-data";
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

export function PetugasView() {
  const [incidents, setIncidents] = useState<OpsIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadIncidents = useCallback(async () => {
    try {
      const response = await fetch("/api/ops/incidents");
      const result = (await response.json()) as {
        data?: OpsIncident[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error ?? "Gagal memuat insiden.");
      setIncidents(result.data ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat insiden.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);
  const active = incidents.filter(
    (incident) => incident.status !== "extinguished",
  ).length;
  const verified = incidents.filter(
    (incident) => incident.status === "confirmed",
  ).length;
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
          value={String(
            incidents.filter((incident) => incident.status === "in_progress")
              .length,
          )}
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
      <OpsIncidentList
        incidents={incidents}
        loading={loading}
        error={error}
        onUpdated={loadIncidents}
      />
    </>
  );
}

type OpsIncident = {
  id: string;
  region_id: string | null;
  source: "satellite" | "report" | "both";
  status: "confirmed" | "in_progress" | "extinguished";
  needs_review: boolean;
  priority_score: number;
  hotspot_count: number;
  first_detected_at: string;
  last_detected_at: string;
  closed_at: string | null;
  regions: { name: string } | null;
};

function OpsIncidentList({
  incidents,
  loading,
  error,
  onUpdated,
}: {
  incidents: OpsIncident[];
  loading: boolean;
  error: string | null;
  onUpdated: () => Promise<void>;
}) {
  async function transition(incident: OpsIncident) {
    const nextStatus =
      incident.status === "confirmed"
        ? "in_progress"
        : incident.status === "in_progress"
          ? "extinguished"
          : "closed";
    const response = await fetch("/api/ops/incidents", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        incidentId: incident.id,
        status: nextStatus,
        note:
          nextStatus === "in_progress"
            ? "Penanganan dimulai oleh petugas."
            : "Penanganan selesai.",
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      toast.error("Status gagal diperbarui", { description: result.error });
      return;
    }
    toast.success(
      nextStatus === "in_progress"
        ? "Insiden ditandai ditangani."
        : "Insiden ditandai selesai.",
    );
    await onUpdated();
  }

  return (
    <div className={card}>
      <SectionHead
        title="Operasi insiden"
        sub="Status tersimpan ke database dan tercatat di riwayat status."
      />
      {loading && (
        <p className="px-6 pb-6 text-sm text-muted-foreground">
          Memuat insiden...
        </p>
      )}
      {error && <p className="px-6 pb-6 text-sm text-destructive">{error}</p>}
      {!loading && !error && incidents.length === 0 && (
        <p className="px-6 pb-6 text-sm text-muted-foreground">
          Tidak ada insiden aktif di wilayah kerja.
        </p>
      )}
      <ul className="divide-y">
        {incidents.map((incident) => (
          <li
            key={incident.id}
            className="flex flex-wrap items-center gap-4 px-6 py-4"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {incident.regions?.name ?? "Wilayah belum tersedia"}
              </div>
              <div className="text-sm text-muted-foreground">
                {incident.id} · {incident.hotspot_count} hotspot · prioritas{" "}
                {incident.priority_score}
              </div>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
              {incident.status === "confirmed"
                ? "Diterima"
                : incident.status === "in_progress"
                  ? "Ditangani"
                  : "Selesai"}
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() => void transition(incident)}
            >
              {incident.status === "confirmed"
                ? "Mulai tangani"
                : incident.status === "in_progress"
                  ? "Tandai selesai"
                  : "Tutup insiden"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
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

export function AdminView() {
  const { laporan, setLaporanStatus } = useApp();
  const pending = laporan.filter((report) => report.status === "menunggu");
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Administrasi data dan kualitas model
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Selamat sore, admin
          </h1>
        </div>
        <Button asChild className="gap-2">
          <Link href="/admin/users">
            <Users className="h-4 w-4" />
            Kelola Pengguna & Kontak
          </Link>
        </Button>
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

export function HukumView() {
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
