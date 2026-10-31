"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { hotspots, type HotspotStatus } from "@/lib/dummy-data";
import { can as canFn, defaultRole, isRole, type Permission, type Role } from "@/lib/roles";
import { validateOwnershipReview, type OwnershipReviewInput, type OwnershipReviews } from "@/lib/land-ownership";

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
  setRole: (r: Role) => void;
  can: (p: Permission) => boolean;
  statusOf: (id: string) => HotspotStatus;
  setStatus: (id: string, s: HotspotStatus) => void;
  escalated: string[];
  escalate: (id: string) => void;
  laporan: Laporan[];
  addLaporan: (l: Omit<Laporan, "id" | "waktu" | "skorAI" | "status">) => void;
  setLaporanStatus: (id: string, s: Laporan["status"]) => void;
  ownershipReviews: OwnershipReviews;
  reviewOwnership: (parcelId: string, input: OwnershipReviewInput) => string | null;
}

const AppCtx = createContext<Ctx | null>(null);

const initialLaporan: Laporan[] = [
  { id: "LP-221", desa: "Bawan", jenis: "Asap", catatan: "Asap tipis dari arah kebun sawit", waktu: "15:02", skorAI: 0.48, status: "menunggu" },
  { id: "LP-220", desa: "Jabiren", jenis: "Api", catatan: "Api kecil di pinggir kanal", waktu: "13:40", skorAI: 0.91, status: "diterima" },
  { id: "LP-219", desa: "Tangkiling", jenis: "Asap", catatan: "Mungkin bakar sampah", waktu: "11:15", skorAI: 0.32, status: "menunggu" },
];

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(defaultRole);
  const [statuses, setStatuses] = useState<Record<string, HotspotStatus>>({});
  const [escalated, setEscalated] = useState<string[]>([]);
  const [laporan, setLaporan] = useState<Laporan[]>(initialLaporan);
  const [ownershipReviews, setOwnershipReviews] = useState<OwnershipReviews>({});

  useEffect(() => {
    const saved = localStorage.getItem("demo-role");
    if (isRole(saved)) setRoleState(saved);
  }, []);

  const setRole = (r: Role) => {
    setRoleState(r);
    localStorage.setItem("demo-role", r);
  };

  const value: Ctx = {
    role,
    setRole,
    can: (p) => canFn(role, p),
    statusOf: (id) => statuses[id] ?? hotspots.find((h) => h.id === id)?.status ?? "baru",
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
    setLaporanStatus: (id, s) => setLaporan((p) => p.map((l) => (l.id === id ? { ...l, status: s } : l))),
    ownershipReviews,
    reviewOwnership: (parcelId, input) => {
      if (!canFn(role, "verifikasiKepemilikan")) return "Peran ini tidak dapat memverifikasi kepemilikan lahan.";
      const error = validateOwnershipReview(parcelId, input);
      if (error) return error;
      setOwnershipReviews((prev) => ({ ...prev, [parcelId]: { ...input, reference: input.reference.trim(), notes: input.notes.trim(), reviewedAt: new Date().toISOString() } }));
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
