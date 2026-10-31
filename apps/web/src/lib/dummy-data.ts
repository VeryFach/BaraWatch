import type {
  DbBurnAreaReport,
  DbConcession,
  DbHotspot,
  DbIncident,
  DbIncidentStatus,
  DbPipelineRun,
  DbRegion,
  DbReport,
  DbResponseTeam,
  DbRiskScore,
  DbWeeklyFeature,
} from "@/lib/data-contracts";

export type Risk = DbRiskScore["level"];
export type HotspotStatus =
  | "baru"
  | "diverifikasi"
  | "ditangani"
  | "selesai"
  | "bukan-api";

export interface Hotspot {
  id: string;
  desa: string;
  kecamatan: string;
  kabupaten: string;
  lat: number;
  lng: number;
  confidence: number;
  confidenceLevel: DbHotspot["confidence_level"];
  gambut: boolean;
  status: HotspotStatus;
  waktu: string;
  waktuIso: string;
  sumber: string;
  satellite: string;
  instrument: string;
  sourceProduct: string | null;
  frp: number | null;
  brightness: number | null;
  daynight: DbHotspot["daynight"];
  luasHa: number | null;
  incidentId: string | null;
  filterStatus: DbHotspot["filter_status"];
}

export interface Desa {
  id: string;
  nama: string;
  kecamatan: string;
  kabupaten: string;
  lat: number;
  lng: number;
  risk: Risk;
  score: number | null;
  alasan: string;
  weekStart: string;
}

export interface LaporanSeed {
  id: string;
  desa: string;
  jenis: "Api" | "Asap";
  catatan: string;
  waktu: string;
  waktuIso: string;
  skorAI: number;
  status: "menunggu" | "diterima" | "ditolak";
  sourceReport: DbReport;
}

export interface Resource {
  id: string;
  nama: string;
  status: "Bertugas" | "Siaga";
  lokasi: string;
  anggota: number | null;
  agency: string | null;
}

const regions: DbRegion[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    parent_id: null,
    level: "provinsi",
    code: "62",
    name: "Kalimantan Tengah",
    latitude: -2.2,
    longitude: 113.9,
    area_ha: null,
    peat_ratio: null,
    is_pilot: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000010",
    parent_id: "00000000-0000-4000-8000-000000000001",
    level: "kabupaten",
    code: "6271",
    name: "Palangka Raya",
    latitude: -2.21,
    longitude: 113.92,
    area_ha: null,
    peat_ratio: null,
    is_pilot: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000011",
    parent_id: "00000000-0000-4000-8000-000000000001",
    level: "kabupaten",
    code: "6210",
    name: "Pulang Pisau",
    latitude: -2.68,
    longitude: 114.2,
    area_ha: null,
    peat_ratio: null,
    is_pilot: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    parent_id: "00000000-0000-4000-8000-000000000001",
    level: "kabupaten",
    code: "6203",
    name: "Kapuas",
    latitude: -2.25,
    longitude: 114.4,
    area_ha: null,
    peat_ratio: null,
    is_pilot: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000020",
    parent_id: "00000000-0000-4000-8000-000000000010",
    level: "kecamatan",
    code: "627101",
    name: "Sebangau",
    latitude: -2.28,
    longitude: 113.96,
    area_ha: null,
    peat_ratio: null,
    is_pilot: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000021",
    parent_id: "00000000-0000-4000-8000-000000000011",
    level: "kecamatan",
    code: "621001",
    name: "Jabiren Raya",
    latitude: -2.45,
    longitude: 114.12,
    area_ha: null,
    peat_ratio: null,
    is_pilot: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000022",
    parent_id: "00000000-0000-4000-8000-000000000012",
    level: "kecamatan",
    code: "620301",
    name: "Mantangai",
    latitude: -2.7,
    longitude: 114.4,
    area_ha: null,
    peat_ratio: null,
    is_pilot: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000101",
    parent_id: "00000000-0000-4000-8000-000000000020",
    level: "desa",
    code: "627101",
    name: "Kalampangan",
    latitude: -2.285,
    longitude: 114,
    area_ha: 1000,
    peat_ratio: 0.8,
    is_pilot: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    parent_id: "00000000-0000-4000-8000-000000000021",
    level: "desa",
    code: "621001",
    name: "Tumbang Nusa",
    latitude: -2.36,
    longitude: 114.08,
    area_ha: 1200,
    peat_ratio: 0.9,
    is_pilot: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    parent_id: "00000000-0000-4000-8000-000000000021",
    level: "desa",
    code: "621002",
    name: "Jabiren",
    latitude: -2.52,
    longitude: 114.17,
    area_ha: 900,
    peat_ratio: 0.7,
    is_pilot: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000104",
    parent_id: "00000000-0000-4000-8000-000000000022",
    level: "desa",
    code: "620301",
    name: "Mantangai",
    latitude: -2.62,
    longitude: 114.48,
    area_ha: 1100,
    peat_ratio: 0.75,
    is_pilot: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000105",
    parent_id: "00000000-0000-4000-8000-000000000021",
    level: "desa",
    code: "621003",
    name: "Sebangau Kuala",
    latitude: -2.95,
    longitude: 113.85,
    area_ha: 1300,
    peat_ratio: 0.92,
    is_pilot: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000106",
    parent_id: "00000000-0000-4000-8000-000000000022",
    level: "desa",
    code: "620302",
    name: "Basarang",
    latitude: -2.78,
    longitude: 114.25,
    area_ha: 800,
    peat_ratio: 0.6,
    is_pilot: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000107",
    parent_id: "00000000-0000-4000-8000-000000000020",
    level: "desa",
    code: "627102",
    name: "Kereng Bangkirai",
    latitude: -2.27,
    longitude: 113.9,
    area_ha: 700,
    peat_ratio: 0.65,
    is_pilot: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000108",
    parent_id: "00000000-0000-4000-8000-000000000021",
    level: "desa",
    code: "621004",
    name: "Bawan",
    latitude: -1.95,
    longitude: 113.92,
    area_ha: 600,
    peat_ratio: 0.2,
    is_pilot: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000109",
    parent_id: "00000000-0000-4000-8000-000000000010",
    level: "desa",
    code: "627103",
    name: "Tangkiling",
    latitude: -1.98,
    longitude: 113.78,
    area_ha: 500,
    peat_ratio: 0.1,
    is_pilot: true,
  },
];

const incidents: DbIncident[] = [
  {
    id: "00000000-0000-4000-9000-000000001042",
    region_id: regions[4].id,
    source: "satellite",
    status: "new",
    needs_review: true,
    priority_score: 78,
    latitude: -2.285,
    longitude: 114,
    hotspot_count: 1,
    first_detected_at: "2026-10-24T16:12:00Z",
    last_detected_at: "2026-10-24T16:12:00Z",
    closed_at: null,
  },
  {
    id: "00000000-0000-4000-9000-000000001041",
    region_id: regions[5].id,
    source: "both",
    status: "confirmed",
    needs_review: false,
    priority_score: 88,
    latitude: -2.36,
    longitude: 114.08,
    hotspot_count: 1,
    first_detected_at: "2026-10-24T15:40:00Z",
    last_detected_at: "2026-10-24T15:40:00Z",
    closed_at: null,
  },
  {
    id: "00000000-0000-4000-9000-000000001040",
    region_id: regions[6].id,
    source: "satellite",
    status: "in_progress",
    needs_review: false,
    priority_score: 81,
    latitude: -2.52,
    longitude: 114.17,
    hotspot_count: 1,
    first_detected_at: "2026-10-24T14:05:00Z",
    last_detected_at: "2026-10-24T14:05:00Z",
    closed_at: null,
  },
  {
    id: "00000000-0000-4000-9000-000000001039",
    region_id: regions[7].id,
    source: "satellite",
    status: "new",
    needs_review: true,
    priority_score: 68,
    latitude: -2.62,
    longitude: 114.48,
    hotspot_count: 1,
    first_detected_at: "2026-10-24T13:52:00Z",
    last_detected_at: "2026-10-24T13:52:00Z",
    closed_at: null,
  },
  {
    id: "00000000-0000-4000-9000-000000001038",
    region_id: regions[11].id,
    source: "satellite",
    status: "false_alarm",
    needs_review: false,
    priority_score: 20,
    latitude: -1.95,
    longitude: 113.92,
    hotspot_count: 1,
    first_detected_at: "2026-10-24T13:20:00Z",
    last_detected_at: "2026-10-24T13:20:00Z",
    closed_at: "2026-10-24T14:00:00Z",
  },
  {
    id: "00000000-0000-4000-9000-000000001037",
    region_id: regions[10].id,
    source: "satellite",
    status: "in_progress",
    needs_review: false,
    priority_score: 75,
    latitude: -2.27,
    longitude: 113.9,
    hotspot_count: 1,
    first_detected_at: "2026-10-24T11:47:00Z",
    last_detected_at: "2026-10-24T11:47:00Z",
    closed_at: null,
  },
  {
    id: "00000000-0000-4000-9000-000000001036",
    region_id: regions[10].id,
    source: "satellite",
    status: "extinguished",
    needs_review: false,
    priority_score: 45,
    latitude: -2.22,
    longitude: 113.95,
    hotspot_count: 1,
    first_detected_at: "2026-10-24T09:30:00Z",
    last_detected_at: "2026-10-24T09:30:00Z",
    closed_at: "2026-10-24T12:00:00Z",
  },
  {
    id: "00000000-0000-4000-9000-000000001035",
    region_id: regions[8].id,
    source: "satellite",
    status: "confirmed",
    needs_review: false,
    priority_score: 90,
    latitude: -2.95,
    longitude: 113.85,
    hotspot_count: 1,
    first_detected_at: "2026-10-24T08:15:00Z",
    last_detected_at: "2026-10-24T08:15:00Z",
    closed_at: null,
  },
  {
    id: "00000000-0000-4000-9000-000000001034",
    region_id: regions[9].id,
    source: "satellite",
    status: "new",
    needs_review: true,
    priority_score: 66,
    latitude: -2.78,
    longitude: 114.25,
    hotspot_count: 1,
    first_detected_at: "2026-10-24T07:58:00Z",
    last_detected_at: "2026-10-24T07:58:00Z",
    closed_at: null,
  },
];

const dbHotspots: DbHotspot[] = [
  {
    id: "00000000-0000-4000-8100-000000001042",
    ingest_run_id: "00000000-0000-4000-a000-000000000001",
    region_id: regions[4].id,
    incident_id: incidents[0].id,
    heat_zone_id: null,
    latitude: -2.285,
    longitude: 114,
    acq_at: "2026-10-24T16:12:00Z",
    satellite: "NOAA-20",
    instrument: "VIIRS",
    source_product: "VIIRS_NOAA20_NRT",
    confidence_raw: "92",
    confidence_level: "high",
    frp: 14.2,
    brightness: 341.2,
    daynight: "D",
    in_peat: true,
    filter_status: "kept",
  },
  {
    id: "00000000-0000-4000-8100-000000001041",
    ingest_run_id: "00000000-0000-4000-a000-000000000001",
    region_id: regions[5].id,
    incident_id: incidents[1].id,
    heat_zone_id: null,
    latitude: -2.36,
    longitude: 114.08,
    acq_at: "2026-10-24T15:40:00Z",
    satellite: "S-NPP",
    instrument: "VIIRS",
    source_product: "VIIRS_SNPP_NRT",
    confidence_raw: "88",
    confidence_level: "high",
    frp: 30.1,
    brightness: 348.7,
    daynight: "D",
    in_peat: true,
    filter_status: "kept",
  },
  {
    id: "00000000-0000-4000-8100-000000001040",
    ingest_run_id: "00000000-0000-4000-a000-000000000001",
    region_id: regions[6].id,
    incident_id: incidents[2].id,
    heat_zone_id: null,
    latitude: -2.52,
    longitude: 114.17,
    acq_at: "2026-10-24T14:05:00Z",
    satellite: "Aqua",
    instrument: "MODIS",
    source_product: "MODIS_NRT",
    confidence_raw: "81",
    confidence_level: "nominal",
    frp: 21.3,
    brightness: 337.8,
    daynight: "D",
    in_peat: true,
    filter_status: "kept",
  },
  {
    id: "00000000-0000-4000-8100-000000001039",
    ingest_run_id: "00000000-0000-4000-a000-000000000001",
    region_id: regions[7].id,
    incident_id: incidents[3].id,
    heat_zone_id: null,
    latitude: -2.62,
    longitude: 114.48,
    acq_at: "2026-10-24T13:52:00Z",
    satellite: "NOAA-20",
    instrument: "VIIRS",
    source_product: "VIIRS_NOAA20_NRT",
    confidence_raw: "76",
    confidence_level: "nominal",
    frp: 10.4,
    brightness: 333.9,
    daynight: "D",
    in_peat: true,
    filter_status: "kept",
  },
  {
    id: "00000000-0000-4000-8100-000000001038",
    ingest_run_id: "00000000-0000-4000-a000-000000000001",
    region_id: regions[11].id,
    incident_id: incidents[4].id,
    heat_zone_id: null,
    latitude: -1.95,
    longitude: 113.92,
    acq_at: "2026-10-24T13:20:00Z",
    satellite: "Terra",
    instrument: "MODIS",
    source_product: "MODIS_NRT",
    confidence_raw: "64",
    confidence_level: "low",
    frp: 4.1,
    brightness: 321.4,
    daynight: "D",
    in_peat: false,
    filter_status: "kept",
  },
  {
    id: "00000000-0000-4000-8100-000000001037",
    ingest_run_id: "00000000-0000-4000-a000-000000000001",
    region_id: regions[10].id,
    incident_id: incidents[5].id,
    heat_zone_id: null,
    latitude: -2.27,
    longitude: 113.9,
    acq_at: "2026-10-24T11:47:00Z",
    satellite: "S-NPP",
    instrument: "VIIRS",
    source_product: "VIIRS_SNPP_NRT",
    confidence_raw: "85",
    confidence_level: "high",
    frp: 18.5,
    brightness: 345.3,
    daynight: "D",
    in_peat: true,
    filter_status: "kept",
  },
  {
    id: "00000000-0000-4000-8100-000000001036",
    ingest_run_id: "00000000-0000-4000-a000-000000000001",
    region_id: regions[10].id,
    incident_id: incidents[6].id,
    heat_zone_id: null,
    latitude: -2.22,
    longitude: 113.95,
    acq_at: "2026-10-24T09:30:00Z",
    satellite: "NOAA-20",
    instrument: "VIIRS",
    source_product: "VIIRS_NOAA20_NRT",
    confidence_raw: "70",
    confidence_level: "nominal",
    frp: 7.3,
    brightness: 329.8,
    daynight: "D",
    in_peat: false,
    filter_status: "kept",
  },
  {
    id: "00000000-0000-4000-8100-000000001035",
    ingest_run_id: "00000000-0000-4000-a000-000000000001",
    region_id: regions[8].id,
    incident_id: incidents[7].id,
    heat_zone_id: null,
    latitude: -2.95,
    longitude: 113.85,
    acq_at: "2026-10-24T08:15:00Z",
    satellite: "S-NPP",
    instrument: "VIIRS",
    source_product: "VIIRS_SNPP_NRT",
    confidence_raw: "90",
    confidence_level: "high",
    frp: 42.6,
    brightness: 352.1,
    daynight: "N",
    in_peat: true,
    filter_status: "kept",
  },
  {
    id: "00000000-0000-4000-8100-000000001034",
    ingest_run_id: "00000000-0000-4000-a000-000000000001",
    region_id: regions[9].id,
    incident_id: incidents[8].id,
    heat_zone_id: null,
    latitude: -2.78,
    longitude: 114.25,
    acq_at: "2026-10-24T07:58:00Z",
    satellite: "Aqua",
    instrument: "MODIS",
    source_product: "MODIS_NRT",
    confidence_raw: "79",
    confidence_level: "nominal",
    frp: 9.2,
    brightness: 335.1,
    daynight: "N",
    in_peat: true,
    filter_status: "kept",
  },
];

const riskScores: DbRiskScore[] = regions
  .filter((region) => region.level === "desa")
  .map((region, index) => ({
    id: `00000000-0000-4000-9100-${String(index + 1).padStart(12, "0")}`,
    region_id: region.id,
    week_start: "2026-10-19",
    method: index < 3 ? "xgboost" : "rule_based",
    level: (
      [
        "ekstrem",
        "ekstrem",
        "tinggi",
        "tinggi",
        "tinggi",
        "sedang",
        "sedang",
        "rendah",
        "rendah",
      ] as Risk[]
    )[index],
    score: [0.94, 0.89, 0.78, 0.74, 0.71, 0.52, 0.48, 0.22, 0.18][index],
    top_reasons: [
      "24 hari tanpa hujan di lahan gambut",
      "Gambut dalam, dekat kanal, riwayat kebakaran 2019",
      "Kelembapan tanah rendah",
      "Pembukaan lahan baru terdeteksi (RADD)",
      "Indeks kekeringan vegetasi tinggi",
      "Curah hujan 30 hari di bawah normal",
      "Dekat jalan dan permukiman",
      "Hujan 3 hari terakhir",
      "Lahan mineral, tutupan baik",
    ][index].split(" · "),
    model_version_id: null,
    computed_at: "2026-10-24T03:00:00Z",
  }));

const weeklyFeatures: DbWeeklyFeature[] = regions
  .filter((region) => region.level === "desa")
  .map((region, index) => ({
    region_id: region.id,
    week_start: "2026-10-19",
    rainfall_mm: [12, 8, 24, 31, 45, 70, 82, 140, 155][index],
    dry_days: [24, 22, 18, 17, 15, 9, 8, 3, 2][index],
    soil_moisture: [0.12, 0.1, 0.18, 0.21, 0.25, 0.39, 0.42, 0.68, 0.73][index],
    enso_idx: 0.8,
    iod_idx: 0.4,
    hotspot_count_7d: dbHotspots.filter(
      (hotspot) => hotspot.region_id === region.id,
    ).length,
    radd_area_ha_28d: index < 5 ? ([42, 55, 18, 22, 13][index] ?? 8) : 3,
  }));

const dbReports: DbReport[] = [
  {
    id: "00000000-0000-4000-9200-000000000221",
    contact_id: "00000000-0000-4000-9300-000000000001",
    incident_id: incidents[4].id,
    duplicate_of: null,
    matched_hotspot_id: dbHotspots[4].id,
    latitude: -1.95,
    longitude: 113.92,
    observed_at: "2026-10-24T15:02:00Z",
    description: "Asap tipis dari arah kebun sawit",
    status: "in_review",
    verification_outcome: "uncertain",
    verification_score: 0.48,
    match_distance_m: 420,
    match_dt_minutes: 102,
    created_at: "2026-10-24T15:02:00Z",
    updated_at: "2026-10-24T15:02:00Z",
  },
  {
    id: "00000000-0000-4000-9200-000000000220",
    contact_id: "00000000-0000-4000-9300-000000000002",
    incident_id: incidents[2].id,
    duplicate_of: null,
    matched_hotspot_id: dbHotspots[2].id,
    latitude: -2.52,
    longitude: 114.17,
    observed_at: "2026-10-24T13:40:00Z",
    description: "Api kecil di pinggir kanal",
    status: "verified",
    verification_outcome: "auto_pass",
    verification_score: 0.91,
    match_distance_m: 180,
    match_dt_minutes: 25,
    created_at: "2026-10-24T13:40:00Z",
    updated_at: "2026-10-24T13:40:00Z",
  },
  {
    id: "00000000-0000-4000-9200-000000000219",
    contact_id: "00000000-0000-4000-9300-000000000003",
    incident_id: null,
    duplicate_of: null,
    matched_hotspot_id: null,
    latitude: -1.98,
    longitude: 113.78,
    observed_at: "2026-10-24T11:15:00Z",
    description: "Mungkin bakar sampah",
    status: "in_review",
    verification_outcome: "uncertain",
    verification_score: 0.32,
    match_distance_m: null,
    match_dt_minutes: null,
    created_at: "2026-10-24T11:15:00Z",
    updated_at: "2026-10-24T11:15:00Z",
  },
];

const burnAreaReports: DbBurnAreaReport[] = incidents
  .filter((incident) => incident.status !== "false_alarm")
  .map((incident, index) => ({
    id: `00000000-0000-4000-9600-${String(index + 1).padStart(12, "0")}`,
    incident_id: incident.id,
    area_ha: [4.2, 12.5, 8.1, 3, 6.4, 1.8, 18.9, 2.6][index] ?? 1,
    method: index % 3 === 2 ? "radar" : "dnbr",
    image_before_date: index % 3 === 2 ? null : "2026-10-10",
    image_after_date: index % 3 === 2 ? null : "2026-10-24",
    cloud_cover_pct: index % 3 === 2 ? null : 8 + index * 2,
    is_uncertain: index % 2 === 0,
    computed_at: "2026-10-24T18:00:00Z",
  }));

const responseTeams: DbResponseTeam[] = [
  {
    id: "00000000-0000-4000-9400-000000000001",
    base_region_id: regions[4].id,
    name: "Manggala Agni Daops Palangka Raya",
    agency: "Manggala Agni",
    is_active: true,
  },
  {
    id: "00000000-0000-4000-9400-000000000002",
    base_region_id: regions[5].id,
    name: "MPA Tumbang Nusa",
    agency: "MPA",
    is_active: true,
  },
  {
    id: "00000000-0000-4000-9400-000000000003",
    base_region_id: regions[5].id,
    name: "BPBD Pulang Pisau",
    agency: "BPBD",
    is_active: true,
  },
  {
    id: "00000000-0000-4000-9400-000000000004",
    base_region_id: regions[7].id,
    name: "TNI Kodim 1011",
    agency: "TNI",
    is_active: true,
  },
];

const pipelineRuns: DbPipelineRun[] = [
  {
    id: "00000000-0000-4000-a000-000000000001",
    job_name: "firms",
    trigger_type: "schedule",
    status: "success",
    records_fetched: 93,
    quota_remaining: 850,
    error: null,
    started_at: "2026-10-24T16:15:00Z",
    finished_at: "2026-10-24T16:16:00Z",
  },
  {
    id: "00000000-0000-4000-a000-000000000002",
    job_name: "radd",
    trigger_type: "schedule",
    status: "success",
    records_fetched: 37,
    quota_remaining: null,
    error: null,
    started_at: "2026-10-24T06:00:00Z",
    finished_at: "2026-10-24T06:02:00Z",
  },
  {
    id: "00000000-0000-4000-a000-000000000003",
    job_name: "support_data",
    trigger_type: "schedule",
    status: "success",
    records_fetched: 12,
    quota_remaining: null,
    error: null,
    started_at: "2026-10-24T15:00:00Z",
    finished_at: "2026-10-24T15:01:00Z",
  },
  {
    id: "00000000-0000-4000-a000-000000000004",
    job_name: "weekly_risk",
    trigger_type: "schedule",
    status: "failed",
    records_fetched: null,
    quota_remaining: null,
    error: "Model input belum tersedia",
    started_at: "2026-10-24T03:00:00Z",
    finished_at: "2026-10-24T03:01:00Z",
  },
];

const concessions: DbConcession[] = [
  {
    id: "00000000-0000-4000-9500-000000000001",
    holder_name: "PT Sawit Lestari",
    concession_type: "HGU",
    latitude: -2.55,
    longitude: 114.2,
  },
  {
    id: "00000000-0000-4000-9500-000000000002",
    holder_name: "PT Hutan Raya",
    concession_type: "IUPHHK",
    latitude: -2.95,
    longitude: 113.85,
  },
];

const regionById = new Map(regions.map((region) => [region.id, region]));
const incidentById = new Map(
  incidents.map((incident) => [incident.id, incident]),
);
const riskByRegion = new Map(riskScores.map((risk) => [risk.region_id, risk]));
const burnAreaByIncident = new Map(
  burnAreaReports.map((report) => [report.incident_id, report]),
);

function toUiStatus(status: DbIncidentStatus | null): HotspotStatus {
  if (status === "false_alarm") return "bukan-api";
  if (status === "confirmed" || status === "escalated") return "diverifikasi";
  if (status === "in_progress" || status === "contained") return "ditangani";
  if (status === "extinguished" || status === "closed") return "selesai";
  return "baru";
}

function toConfidence(hotspot: DbHotspot) {
  const numeric = Number(hotspot.confidence_raw);
  if (Number.isFinite(numeric)) return numeric;
  return hotspot.confidence_level === "high"
    ? 90
    : hotspot.confidence_level === "nominal"
      ? 70
      : 40;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export const hotspots: Hotspot[] = dbHotspots.map((hotspot) => {
  const village = regionById.get(hotspot.region_id ?? "");
  const district = village
    ? regionById.get(regionById.get(village.parent_id ?? "")?.parent_id ?? "")
    : undefined;
  const subdistrict = village
    ? regionById.get(village.parent_id ?? "")
    : undefined;
  const incident = incidentById.get(hotspot.incident_id ?? "");
  return {
    id: `HS-${hotspot.id.slice(-4)}`,
    desa: village?.name ?? "Wilayah belum tersedia",
    kecamatan: subdistrict?.name ?? "Wilayah belum tersedia",
    kabupaten: district?.name ?? "Wilayah belum tersedia",
    lat: hotspot.latitude,
    lng: hotspot.longitude,
    confidence: toConfidence(hotspot),
    confidenceLevel: hotspot.confidence_level,
    gambut: hotspot.in_peat,
    status: toUiStatus(incident?.status ?? null),
    waktu: formatTime(hotspot.acq_at),
    waktuIso: hotspot.acq_at,
    sumber: `${hotspot.instrument} ${hotspot.satellite}`,
    satellite: hotspot.satellite,
    instrument: hotspot.instrument,
    sourceProduct: hotspot.source_product,
    frp: hotspot.frp,
    brightness: hotspot.brightness,
    daynight: hotspot.daynight,
    luasHa: burnAreaByIncident.get(hotspot.incident_id ?? "")?.area_ha ?? null,
    incidentId: hotspot.incident_id,
    filterStatus: hotspot.filter_status,
  };
});

export const desaList: Desa[] = regions
  .filter((region) => region.level === "desa")
  .map((region) => {
    const risk = riskByRegion.get(region.id);
    return {
      id: region.id,
      nama: region.name,
      kecamatan:
        regionById.get(region.parent_id ?? "")?.name ??
        "Wilayah belum tersedia",
      kabupaten:
        regionById.get(regionById.get(region.parent_id ?? "")?.parent_id ?? "")
          ?.name ?? "Wilayah belum tersedia",
      lat: region.latitude,
      lng: region.longitude,
      risk: risk?.level ?? "rendah",
      score: risk?.score ?? null,
      alasan: risk?.top_reasons.join(" · ") ?? "Belum ada alasan risiko",
      weekStart: risk?.week_start ?? "",
    };
  });

export const riskLabel: Record<Risk, string> = {
  rendah: "Rendah",
  sedang: "Sedang",
  tinggi: "Tinggi",
  ekstrem: "Ekstrem",
};
export const riskVar: Record<Risk, string> = {
  rendah: "var(--risk-low)",
  sedang: "var(--risk-medium)",
  tinggi: "var(--risk-high)",
  ekstrem: "var(--risk-extreme)",
};
export const statusLabel: Record<HotspotStatus, string> = {
  baru: "Baru",
  diverifikasi: "Api nyata",
  ditangani: "Ditangani",
  selesai: "Selesai",
  "bukan-api": "Bukan api",
};

export const trend7d = [
  "2026-10-18",
  "2026-10-19",
  "2026-10-20",
  "2026-10-21",
  "2026-10-22",
  "2026-10-23",
  "2026-10-24",
].map((day) => {
  const dayHotspots = dbHotspots.filter((hotspot) =>
    hotspot.acq_at.startsWith(day),
  );
  return {
    hari: new Intl.DateTimeFormat("id-ID", {
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(`${day}T00:00:00Z`)),
    mentah: dayHotspots.length,
    tersaring: dayHotspots.filter((hotspot) => hotspot.filter_status === "kept")
      .length,
  };
});
export const resources: Resource[] = responseTeams.map((team) => ({
  id: team.id,
  nama: team.name,
  status: team.is_active ? "Bertugas" : "Siaga",
  lokasi:
    regionById.get(team.base_region_id ?? "")?.name ?? "Wilayah belum tersedia",
  anggota: null,
  agency: team.agency,
}));
export const weather = {
  suhu: null as number | null,
  kelembapan: null as number | null,
  angin: null as string | null,
  hariTanpaHujan:
    weeklyFeatures.find((feature) => feature.region_id === regions[4].id)
      ?.dry_days ?? 0,
};

export const laporanSeeds: LaporanSeed[] = dbReports.map((report) => {
  const hotspot = dbHotspots.find(
    (row) => row.id === report.matched_hotspot_id,
  );
  const village = regionById.get(hotspot?.region_id ?? "");
  return {
    id: `LP-${report.id.slice(-3)}`,
    desa: village?.name ?? "Wilayah belum tersedia",
    kecamatan:
      regionById.get(village?.parent_id ?? "")?.name ??
      "Wilayah belum tersedia",
    kabupaten:
      regionById.get(
        regionById.get(village?.parent_id ?? "")?.parent_id ?? "",
      )?.name ?? "Wilayah belum tersedia",
    jenis: report.description?.toLowerCase().includes("asap") ? "Asap" : "Api",
    catatan: report.description ?? "Deskripsi belum tersedia",
    waktu: formatTime(report.created_at),
    waktuIso: report.created_at,
    skorAI: report.verification_score ?? 0,
    status:
      report.status === "verified"
        ? "diterima"
        : report.status === "rejected"
          ? "ditolak"
          : "menunggu",
    sourceReport: report,
  };
});

export const supportData = {
  regions,
  riskScores,
  weeklyFeatures,
  responseTeams,
  pipelineRuns,
  concessions,
};
export const dbFixtures = {
  regions,
  incidents,
  hotspots: dbHotspots,
  riskScores,
  weeklyFeatures,
  reports: dbReports,
  burnAreaReports,
  responseTeams,
  pipelineRuns,
  concessions,
};
