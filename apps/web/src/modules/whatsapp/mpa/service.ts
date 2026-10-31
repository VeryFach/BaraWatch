import { supabaseRequest } from "@/lib/supabase/admin";
import type { Contact, Region } from "../core/types";
import { setSession } from "../data/db";
import { getReportRegionNames } from "../reports/service";
import { twilioProvider } from "../transport/twilio";

export async function notifyMpa(
  reportId: string,
  regionId: string | null,
  latitude?: number,
  longitude?: number,
  labels: string[] = [],
) {
  const regionNames = await getReportRegionNames(regionId);
  if (!regionId) return 0;

  const regions = await supabaseRequest<Region[]>(
    "regions?select=id,parent_id,level,code,name&limit=10000",
  );
  const regionById = new Map(regions.map((region) => [region.id, region]));
  const coveredRegionIds = new Set<string>();
  let currentRegionId: string | null = regionId;
  while (currentRegionId) {
    coveredRegionIds.add(currentRegionId);
    currentRegionId = regionById.get(currentRegionId)?.parent_id ?? null;
  }

  const mpas = await supabaseRequest<Contact[]>(
    "contacts?role=eq.mpa&opted_out_at=is.null&select=id,phone_e164,role,assigned_region_id,last_inbound_at",
  );
  const targets = mpas.filter(
    (mpa) =>
      mpa.assigned_region_id !== null &&
      coveredRegionIds.has(mpa.assigned_region_id),
  );
  const body =
    `🚨 Laporan baru\nID: ${reportId}\n` +
    `Wilayah: ${regionNames.desa}, ${regionNames.kecamatan}, ${regionNames.kabupaten}\n` +
    `Lokasi: ${latitude ?? "-"}, ${longitude ?? "-"}\n` +
    `Indikasi AI: ${labels.join(", ")}\n` +
    "Status: Menunggu verifikasi lapangan.\n\n" +
    "Balas *1* jika api nyata atau *2* jika bukan api nyata.\n" +
    "Balas *MPA* untuk membuka menu laporan.";
  await Promise.all(
    targets.map(async (mpa) => {
      await setSession(mpa.id, "mpa_pending_verification", {
        reportId,
      });
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
        `${index + 1}. ${report.id} - ${report.status} - ${new Date(report.created_at).toLocaleString("id-ID")}`,
    )
    .join("\n");
}

export async function findReportById(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  ) {
    return null;
  }
  return (
    (
      await supabaseRequest<
        Array<{
          id: string;
          status: string;
          created_at: string;
          region_id: string | null;
          contact_id: string;
          incident_id: string | null;
          verification_outcome: string | null;
        }>
      >(
        `reports?id=eq.${encodeURIComponent(id)}&select=id,status,created_at,region_id,contact_id,incident_id,verification_outcome`,
      )
    )[0] ?? null
  );
}

export async function classifyReport(
  reportId: string,
  isRealFire: boolean,
  mpaContactId: string,
) {
  const report = await findReportById(reportId);
  if (!report) return null;
  if (report.verification_outcome !== null) {
    return { report, status: report.status, alreadyClassified: true };
  }
  const status = isRealFire ? "verified" : "rejected";
  await supabaseRequest(`reports?id=eq.${encodeURIComponent(reportId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      verification_outcome: isRealFire ? "auto_pass" : "rejected",
      updated_at: new Date().toISOString(),
    }),
  });

  if (report.incident_id) {
    await supabaseRequest("assessments", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        incident_id: report.incident_id,
        contact_id: mpaContactId,
        verdict: isRealFire ? "real_fire" : "not_fire",
        is_current: true,
      }),
    });

    if (isRealFire) {
      await supabaseRequest("escalations", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          incident_id: report.incident_id,
          escalated_by: mpaContactId,
          summary: {
            source: "mpa_verification",
            report_id: report.id,
            verdict: "real_fire",
          },
          no_officer_fallback: false,
        }),
      });
    }
  }

  await supabaseRequest("training_labels", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      report_id: report.id,
      label: isRealFire ? "valid" : "not_fire",
      source: "mpa_consensus",
    }),
  });

  return { report, status, alreadyClassified: false, mpaContactId };
}

export function formatReportDetails(
  report: {
    id: string;
    status: string;
    created_at: string;
    region_id: string | null;
    incident_id?: string | null;
    verification_outcome: string | null;
  },
  regionName: string,
) {
  return (
    `ID: ${report.id}\n` +
    `Wilayah: ${regionName}\n` +
    `Status: ${report.status}\n` +
    `Penilaian: ${report.verification_outcome ?? "belum dinilai"}\n` +
    `Dibuat: ${new Date(report.created_at).toLocaleString("id-ID")}`
  );
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
