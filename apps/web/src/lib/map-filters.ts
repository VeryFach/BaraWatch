import { type Desa, type Hotspot } from "@/lib/dummy-data";

export interface MapFilters {
  query: string;
  kabupaten: string;
  status: string;
  lahan: string;
  hideFalse: boolean;
}

export const defaultMapFilters: MapFilters = {
  query: "", kabupaten: "all", status: "all", lahan: "all", hideFalse: true,
};

export function filterHotspots(rows: Hotspot[], filters: MapFilters): Hotspot[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((h) =>
    `${h.id} ${h.desa} ${h.kabupaten}`.toLowerCase().includes(query) &&
    (filters.kabupaten === "all" || h.kabupaten === filters.kabupaten) &&
    (filters.status === "all" || h.status === filters.status) &&
    (filters.lahan === "all" || h.gambut === (filters.lahan === "gambut")) &&
    !(filters.hideFalse && filters.status !== "bukan-api" && h.status === "bukan-api"),
  );
}

export function filterVillages(rows: Desa[], filters: MapFilters): Desa[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((d) =>
    `${d.nama} ${d.kabupaten}`.toLowerCase().includes(query) &&
    (filters.kabupaten === "all" || d.kabupaten === filters.kabupaten),
  );
}