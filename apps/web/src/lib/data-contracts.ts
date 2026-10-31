export type DbIncidentStatus =
  | "new"
  | "confirmed"
  | "false_alarm"
  | "escalated"
  | "in_progress"
  | "contained"
  | "extinguished"
  | "closed";

export type DbHotspotFilterStatus =
  | "pending"
  | "kept"
  | "low_confidence"
  | "non_wildfire_zone"
  | "outside_pilot";

export interface DbRegion {
  id: string;
  parent_id: string | null;
  level: "provinsi" | "kabupaten" | "kecamatan" | "desa";
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  area_ha: number | null;
  peat_ratio: number | null;
  is_pilot: boolean;
}

export interface DbIncident {
  id: string;
  region_id: string | null;
  source: "satellite" | "report" | "both";
  status: DbIncidentStatus;
  needs_review: boolean;
  priority_score: number;
  latitude: number | null;
  longitude: number | null;
  hotspot_count: number;
  first_detected_at: string;
  last_detected_at: string;
  closed_at: string | null;
}

export interface DbHotspot {
  id: string;
  ingest_run_id: string | null;
  region_id: string | null;
  incident_id: string | null;
  heat_zone_id: string | null;
  latitude: number;
  longitude: number;
  acq_at: string;
  satellite: string;
  instrument: string;
  source_product: string | null;
  confidence_raw: string | null;
  confidence_level: "low" | "nominal" | "high" | null;
  frp: number | null;
  brightness: number | null;
  daynight: "D" | "N" | null;
  in_peat: boolean;
  filter_status: DbHotspotFilterStatus;
}

export interface DbRiskScore {
  id: string;
  region_id: string;
  week_start: string;
  method: "rule_based" | "xgboost";
  level: "rendah" | "sedang" | "tinggi" | "ekstrem";
  score: number | null;
  top_reasons: string[];
  model_version_id: string | null;
  computed_at: string;
}

export interface DbWeeklyFeature {
  region_id: string;
  week_start: string;
  rainfall_mm: number | null;
  dry_days: number | null;
  soil_moisture: number | null;
  enso_idx: number | null;
  iod_idx: number | null;
  hotspot_count_7d: number | null;
  radd_area_ha_28d: number | null;
}

export interface DbReport {
  id: string;
  contact_id: string;
  region_id?: string | null;
  incident_id: string | null;
  duplicate_of: string | null;
  matched_hotspot_id: string | null;
  latitude: number | null;
  longitude: number | null;
  observed_at: string | null;
  description: string | null;
  status: "received" | "in_review" | "verified" | "handled" | "rejected";
  verification_outcome: "auto_pass" | "uncertain" | "rejected" | null;
  verification_score: number | null;
  match_distance_m: number | null;
  match_dt_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbBurnAreaReport {
  id: string;
  incident_id: string;
  area_ha: number;
  method: "dnbr" | "radar";
  image_before_date: string | null;
  image_after_date: string | null;
  cloud_cover_pct: number | null;
  is_uncertain: boolean;
  computed_at: string;
}

export interface DbResponseTeam {
  id: string;
  base_region_id: string | null;
  name: string;
  agency: string | null;
  is_active: boolean;
}

export interface DbConcession {
  id: string;
  holder_name: string | null;
  concession_type: string | null;
  latitude: number;
  longitude: number;
}

export interface DbPipelineRun {
  id: string;
  job_name: "firms" | "support_data" | "radd" | "weekly_risk" | "retrain";
  trigger_type: "schedule" | "manual";
  status: "running" | "success" | "partial" | "failed";
  records_fetched: number | null;
  quota_remaining: number | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}
