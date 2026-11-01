"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type OwnershipReviewInput,
  type OwnershipReviews,
  validateOwnershipReview,
} from "@/lib/land-ownership";
import {
  type PublicHotspot,
  type PublicIncident,
  type PublicRegionBoundary,
  type PublicReport,
  type PublicRisk,
  reportToLaporan,
} from "@/lib/public-api";
import {
  can as canFn,
  defaultRole,
  isRole,
  type Permission,
  type Role,
} from "@/lib/roles";
import {
  type Desa,
  type Hotspot,
  type HotspotStatus,
  hotspotFromPublic,
  regionsToVillages,
} from "@/lib/ui-data";

export interface Laporan {
  id: string;
  desa: string;
  jenis: "Api" | "Asap";
  catatan: string;
  kecamatan: string;
  kabupaten: string;
  waktu: string;
  waktuIso: string;
  skorAI: number;
  imageUrl: string | null;
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
  reportsLoading: boolean;
  reportsError: string | null;
  publicReports: PublicReport[];
  refreshReports: () => Promise<void>;
  setLaporanStatus: (id: string, s: Laporan["status"]) => void;
  ownershipReviews: OwnershipReviews;
  reviewOwnership: (
    parcelId: string,
    input: OwnershipReviewInput,
  ) => string | null;
  hotspots: Hotspot[];
  desaList: Desa[];
  publicHotspots: PublicHotspot[];
  publicIncidents: PublicIncident[];
  regions: PublicRegionBoundary[];
  risks: PublicRisk[];
  liveDataLoading: boolean;
  liveDataError: string | null;
  hotspotsLoading: boolean;
  incidentsLoading: boolean;
  regionsLoading: boolean;
  risksLoading: boolean;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(defaultRole);
  const [statuses, setStatuses] = useState<Record<string, HotspotStatus>>({});
  const [escalated, setEscalated] = useState<string[]>([]);
  const [laporan, setLaporan] = useState<Laporan[]>([]);
  const [publicReports, setPublicReports] = useState<PublicReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [ownershipReviews, setOwnershipReviews] = useState<OwnershipReviews>(
    {},
  );
  const [publicHotspots, setPublicHotspots] = useState<PublicHotspot[]>([]);
  const [publicIncidents, setPublicIncidents] = useState<PublicIncident[]>([]);
  const [regions, setRegions] = useState<PublicRegionBoundary[]>([]);
  const [risks, setRisks] = useState<PublicRisk[]>([]);
  const [hotspotsLoading, setHotspotsLoading] = useState(true);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [risksLoading, setRisksLoading] = useState(true);
  const [liveDataError, setLiveDataError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/auth/session")
      .then((response) => response.json())
      .then((result: { profile?: { role?: string } | null }) => {
        const role: string | null =
          result.profile?.role === "penegak_hukum"
            ? "hukum"
            : (result.profile?.role ?? null);
        if (isRole(role)) setRoleState(role);
      });
  }, []);

  useEffect(() => {
    let active = true;
    const load = <T,>(
      url: string,
      setData: (data: T[]) => void,
      setLoading: (loading: boolean) => void,
    ) => {
      void fetch(url)
        .then(async (response) => {
          if (!response.ok) throw new Error(url);
          return (await response.json()) as { data: T[] };
        })
        .then(({ data }) => {
          if (active) setData(data);
        })
        .catch(() => {
          if (active)
            setLiveDataError("Sebagian data pantauan belum dapat dimuat.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    load(
      "/api/public/hotspots?limit=200",
      setPublicHotspots,
      setHotspotsLoading,
    );
    load(
      "/api/public/incidents?limit=200",
      setPublicIncidents,
      setIncidentsLoading,
    );
    load("/api/public/regions", setRegions, setRegionsLoading);
    load("/api/public/risk", setRisks, setRisksLoading);
    return () => {
      active = false;
    };
  }, []);

  const refreshReports = async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const response = await fetch("/api/public/reports");
      if (!response.ok) throw new Error("Unable to load reports");
      const { data } = (await response.json()) as { data: PublicReport[] };
      setPublicReports(data);
      setLaporan(data.map(reportToLaporan));
    } catch {
      setReportsError("Laporan belum dapat dimuat.");
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/public/reports")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load reports");
        return (await response.json()) as { data: PublicReport[] };
      })
      .then(({ data }) => {
        if (active) {
          setPublicReports(data);
          setLaporan(data.map(reportToLaporan));
        }
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

  const value: Ctx = {
    role,
    setRole: setRoleState,
    can: (p) => canFn(role, p),
    statusOf: (id) =>
      statuses[id] ??
      publicHotspots
        .map((hotspot) => hotspotFromPublic(hotspot, publicIncidents))
        .find((hotspot) => hotspot.id === id)?.status ??
      "baru",
    setStatus: (id, s) => setStatuses((prev) => ({ ...prev, [id]: s })),
    escalated,
    escalate: (id) => setEscalated((p) => (p.includes(id) ? p : [...p, id])),
    laporan,
    reportsLoading,
    reportsError,
    publicReports,
    refreshReports,
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
    hotspots: publicHotspots.map((hotspot) =>
      hotspotFromPublic(hotspot, publicIncidents),
    ),
    desaList: regionsToVillages(regions, risks),
    publicHotspots,
    publicIncidents,
    regions,
    risks,
    liveDataLoading:
      hotspotsLoading || incidentsLoading || regionsLoading || risksLoading,
    liveDataError,
    hotspotsLoading,
    incidentsLoading,
    regionsLoading,
    risksLoading,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be inside AppStateProvider");
  return c;
}
