"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { type HotspotStatus, hotspots, laporanSeeds } from "@/lib/dummy-data";
import {
  type OwnershipReviewInput,
  type OwnershipReviews,
  validateOwnershipReview,
} from "@/lib/land-ownership";
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
  waktu: string;
  skorAI: number;
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
  addLaporan: (l: Omit<Laporan, "id" | "waktu" | "skorAI" | "status">) => void;
  setLaporanStatus: (id: string, s: Laporan["status"]) => void;
  ownershipReviews: OwnershipReviews;
  reviewOwnership: (
    parcelId: string,
    input: OwnershipReviewInput,
  ) => string | null;
}

const AppCtx = createContext<Ctx | null>(null);

const initialLaporan: Laporan[] = laporanSeeds.map(
  ({ sourceReport: _sourceReport, ...report }) => report,
);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(defaultRole);
  const [statuses, setStatuses] = useState<Record<string, HotspotStatus>>({});
  const [escalated, setEscalated] = useState<string[]>([]);
  const [laporan, setLaporan] = useState<Laporan[]>(initialLaporan);
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

  const value: Ctx = {
    role,
    can: (p) => canFn(role, p),
    statusOf: (id) =>
      statuses[id] ?? hotspots.find((h) => h.id === id)?.status ?? "baru",
    setStatus: (id, s) => setStatuses((prev) => ({ ...prev, [id]: s })),
    escalated,
    escalate: (id) => setEscalated((p) => (p.includes(id) ? p : [...p, id])),
    laporan,
    addLaporan: (l) => {
      const now = new Date();
      setLaporan((p) => [
        {
          ...l,
          id: `LP-${222 + p.length - initialLaporan.length}`,
          waktu: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
          skorAI: Math.round((0.4 + Math.random() * 0.55) * 100) / 100,
          status: "menunggu",
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
