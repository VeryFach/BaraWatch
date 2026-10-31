import { supabaseRequest } from "@/lib/supabase/admin";
import { getReportRegionNames } from "./reports";
import { twilioProvider } from "./twilio";
import type { Contact, Region } from "./types";

export async function notifyMpa(
  reportId: string,
  regionId: string | null,
  latitude?: number,
  longitude?: number,
) {
  const regionNames = await getReportRegionNames(regionId);
  const mpas = await supabaseRequest<Contact[]>(
    "contacts?role=eq.mpa&select=id,phone_e164,role,assigned_region_id,last_inbound_at",
  );
  const targets = mpas.filter(
    (mpa) => !regionId || mpa.assigned_region_id === regionId,
  );
  const body =
    `🚨 Laporan baru #${reportId.slice(0, 8)}\n` +
    `Wilayah: ${regionNames.desa}, ${regionNames.kecamatan}, ${regionNames.kabupaten}\n` +
    `Lokasi: ${latitude ?? "-"}, ${longitude ?? "-"}\n` +
    "Status: Belum ditangani.\nBalas *MPA* untuk membuka menu laporan.";
  await Promise.all(
    targets.map(async (mpa) => {
      const sent = await twilioProvider.sendText(mpa.phone_e164, body);
      await supabaseRequest("wa_messages", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          contact_id: mpa.id,
          direction: "out",
          kind: "report_status",
          provider_sid: sent.sid,
          body,
          status: "sent",
          report_id: reportId,
          handed_off_at: new Date().toISOString(),
        }),
      });
    }),
  );
  return targets.length;
}

export async function listReports(status?: string, regionId?: string) {
  const filters = [
    status ? `status=eq.${encodeURIComponent(status)}` : "",
    regionId ? `region_id=eq.${encodeURIComponent(regionId)}` : "",
  ]
    .filter(Boolean)
    .join("&");
  return supabaseRequest<
    Array<{
      id: string;
      status: string;
      created_at: string;
      region_id: string | null;
    }>
  >(
    `reports?select=id,status,created_at,region_id&order=created_at.desc&limit=10${filters ? `&${filters}` : ""}`,
  );
}

export function formatReports(
  reports: Array<{
    id: string;
    status: string;
    created_at: string;
    region_id: string | null;
  }>,
) {
  if (reports.length === 0) return "Tidak ada laporan yang ditemukan.";
  return reports
    .map(
      (report, index) =>
        `${index + 1}. #${report.id.slice(0, 8)} - ${report.status} - ${new Date(report.created_at).toLocaleString("id-ID")}`,
    )
    .join("\n");
}

export async function listRegionChoices(level: Region["level"]) {
  return supabaseRequest<Region[]>(
    `regions?level=eq.${level}&select=id,parent_id,level,code,name&order=code.asc`,
  );
}

export async function findRegionDescendantIds(
  regionId: string,
): Promise<string[]> {
  const regions = await supabaseRequest<Region[]>(
    "regions?select=id,parent_id,level,code,name&limit=10000",
  );
  const ids = new Set([regionId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const region of regions) {
      if (
        region.parent_id &&
        ids.has(region.parent_id) &&
        !ids.has(region.id)
      ) {
        ids.add(region.id);
        changed = true;
      }
    }
  }
  return [...ids];
}
