"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { type HotspotStatus, hotspots } from "@/lib/dummy-data";
import {
  type OwnershipReviewInput,
  type OwnershipReviews,
  validateOwnershipReview,
} from "@/lib/land-ownership";
import { type PublicReport, reportToLaporan } from "@/lib/public-api";
import {
  can as canFn,
  defaultRole,
  isRole,
  type Permission,
  type Role,
} from "@/lib/roles";
import { createClient } from "@/lib/supabase/browser";

export interface Laporan {
  id: string;
  desa: string;
  jenis: "Api" | "Asap";
  catatan: string;
  kabupaten: string;
  waktu: string;
  waktuIso: string;
  skorAI: number;
  imageUrl: string | null;
  status: "menunggu" | "diterima" | "ditolak";
}

interface Ctx {
  role: Role;
  can: (p: Permission) => boolean;
  statusOf: (id: string) => HotspotStatus;
  setStatus: (id: string, s: HotspotStatus) => void;
  escalated: string[];
  escalate: (id: string) => void;
  laporan: Laporan[];
  reportsLoading: boolean;
  reportsError: string | null;
  addLaporan: (
    l: Omit<
      Laporan,
      "id" | "waktu" | "waktuIso" | "skorAI" | "status" | "imageUrl"
    >,
  ) => void;
  setLaporanStatus: (id: string, s: Laporan["status"]) => void;
  ownershipReviews: OwnershipReviews;
  reviewOwnership: (
    parcelId: string,
    input: OwnershipReviewInput,
  ) => string | null;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(defaultRole);
  const [statuses, setStatuses] = useState<Record<string, HotspotStatus>>({});
  const [escalated, setEscalated] = useState<string[]>([]);
  const [laporan, setLaporan] = useState<Laporan[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [ownershipReviews, setOwnershipReviews] = useState<OwnershipReviews>(
    {},
  );

  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
      return;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const role = profile?.role === "penegak_hukum" ? "hukum" : profile?.role;
      if (isRole(role) && role !== "warga" && role !== "desa")
        setRoleState(role);
    })();
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/public/reports")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load reports");
        return (await response.json()) as { data: PublicReport[] };
      })
      .then(({ data }) => {
        if (active) setLaporan(data.map(reportToLaporan));
      })
      .catch(() => {
        if (active) {
          setLaporan([]);
          setReportsError("Laporan belum dapat dimuat.");
        }
      })
      .finally(() => {
        if (active) setReportsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const setRole = (r: Role) => {
    setRoleState(r);
    localStorage.setItem("demo-role", r);
  };

  const value: Ctx = {
    role,
    can: (p) => canFn(role, p),
    statusOf: (id) =>
      statuses[id] ?? hotspots.find((h) => h.id === id)?.status ?? "baru",
    setStatus: (id, s) => setStatuses((prev) => ({ ...prev, [id]: s })),
    escalated,
    escalate: (id) => setEscalated((p) => (p.includes(id) ? p : [...p, id])),
    laporan,
    reportsLoading,
    reportsError,
    addLaporan: (l) => {
      const now = new Date();
      setLaporan((p) => [
        {
          ...l,
          id: `local-${crypto.randomUUID()}`,
          waktu: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
          waktuIso: now.toISOString(),
          skorAI: Math.round((0.4 + Math.random() * 0.55) * 100) / 100,
          status: "menunggu",
          imageUrl: null,
        },
        ...p,
      ]);
    },
    setLaporanStatus: (id, s) =>
      setLaporan((p) => p.map((l) => (l.id === id ? { ...l, status: s } : l))),
    ownershipReviews,
    reviewOwnership: (parcelId, input) => {
      if (!canFn(role, "verifikasiKepemilikan"))
        return "Peran ini tidak dapat memverifikasi kepemilikan lahan.";
      const error = validateOwnershipReview(parcelId, input);
      if (error) return error;
      setOwnershipReviews((prev) => ({
        ...prev,
        [parcelId]: {
          ...input,
          reference: input.reference.trim(),
          notes: input.notes.trim(),
          reviewedAt: new Date().toISOString(),
        },
      }));
      return null;
    },
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be inside AppStateProvider");
  return c;
}
