import type { WhatsAppInbound } from "./provider";

export type SessionState =
  | "idle"
  | "choosing_kabupaten"
  | "choosing_kecamatan"
  | "choosing_desa"
  | "awaiting_photo"
  | "awaiting_location"
  | "mpa_menu"
  | "mpa_pending_verification"
  | "mpa_filter_status"
  | "mpa_filter_region_level"
  | "mpa_filter_region"
  | "mpa_lookup_report";

export type Contact = {
  id: string;
  phone_e164: string;
  role: "warga" | "mpa";
  assigned_region_id: string | null;
  last_inbound_at: string | null;
};

export type Region = {
  id: string;
  parent_id: string | null;
  level: "provinsi" | "kabupaten" | "kecamatan" | "desa";
  code: string;
  name: string;
};

export type Session = {
  state: SessionState;
  context: Record<string, unknown>;
};

export type Report = {
  id: string;
  status: "received" | "in_review" | "verified" | "handled" | "rejected";
  created_at: string;
  description: string | null;
  region_name: string | null;
  kecamatan_name: string | null;
  kabupaten_name: string | null;
};

export type Inbound = WhatsAppInbound;
