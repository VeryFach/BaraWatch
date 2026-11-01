import { getServerEnv } from "@/lib/env";
import { supabaseRequest } from "@/lib/supabase/admin";
import { enqueueTextMessage, flushOutbox } from "./outbox";

type Subscription = {
  contact_id: string;
  region_id: string;
  contacts: {
    phone_e164: string;
    last_inbound_at: string | null;
    opted_out_at: string | null;
  } | null;
  regions: { name: string } | null;
};

type Region = { id: string; parent_id: string | null };

async function dispatchToSubscriptions(
  subscriptions: Subscription[],
  body: string,
  dedupeKey: string,
  incidentId?: string,
  reportId?: string,
) {
  const env = getServerEnv();
  let sentCount = 0;
  const notifiedContacts = new Set<string>();
  for (const subscription of subscriptions) {
    if (notifiedContacts.has(subscription.contact_id)) continue;
    const contact = subscription.contacts;
    if (!contact || contact.opted_out_at) continue;
    const recent = contact.last_inbound_at
      ? Date.now() - Date.parse(contact.last_inbound_at) < 24 * 60 * 60 * 1000
      : false;
    const messageId = await enqueueTextMessage({
      contactId: subscription.contact_id,
      body,
      kind: "alert",
      dedupeKey: `${dedupeKey}:${subscription.contact_id}`,
      incidentId,
      reportId,
      templateName:
        !recent && env.twilioAlertTemplateSid ? "alert_baru" : undefined,
      templateVariables: [subscription.regions?.name ?? "wilayah terkait"],
    });
    if (messageId) {
      notifiedContacts.add(subscription.contact_id);
      sentCount += (await flushOutbox(1, messageId)).sent;
    }
  }
  return sentCount;
}

export async function dispatchNewIncidentAlert(
  incidentId: string,
  regionId: string,
): Promise<number> {
  const subscriptions = await supabaseRequest<Subscription[]>(
    `subscriptions?region_id=eq.${encodeURIComponent(regionId)}&is_active=eq.true&select=contact_id,region_id,contacts(phone_e164,last_inbound_at,opted_out_at),regions(name)`,
  );
  const env = getServerEnv();
  let sentCount = 0;
  for (const subscription of subscriptions) {
    const contact = subscription.contacts;
    const regionName = subscription.regions?.name;
    if (!contact || !regionName) continue;
    // AGENTS.md: kontak dengan opted_out_at tidak dikirimi notifikasi
    if (contact.opted_out_at) continue;
    const dedupeKey = `${incidentId}:${subscription.contact_id}:alert`;
    const recent = contact.last_inbound_at
      ? Date.now() - Date.parse(contact.last_inbound_at) < 24 * 60 * 60 * 1000
      : false;
    const alreadySent = await supabaseRequest<{ id: string }[]>(
      `wa_messages?dedupe_key=eq.${encodeURIComponent(dedupeKey)}&select=id&limit=1`,
    );
    if (alreadySent.length > 0) continue;
    const body = `🚨 Peringatan: Titik api baru terdeteksi di area ${regionName}. Mohon tetap waspada dan hindari area tersebut.`;
    const queuedId = await enqueueTextMessage({
      contactId: subscription.contact_id,
      body,
      kind: "alert",
      dedupeKey,
      incidentId,
      templateName:
        !recent && env.twilioAlertTemplateSid ? "alert_baru" : undefined,
      templateVariables: [regionName],
    });
    if (queuedId) sentCount += (await flushOutbox(1, queuedId)).sent;
  }

  return sentCount;
}

export async function dispatchVerifiedReportAlert(
  reportId: string,
  regionId: string,
  incidentId?: string | null,
): Promise<number> {
  const env = getServerEnv();
  const regions = await supabaseRequest<Region[]>(
    "regions?select=id,parent_id&limit=10000",
  );
  const coveredRegionIds = new Set<string>();
  let currentRegionId: string | null = regionId;
  const regionById = new Map(regions.map((region) => [region.id, region]));
  while (currentRegionId) {
    coveredRegionIds.add(currentRegionId);
    currentRegionId = regionById.get(currentRegionId)?.parent_id ?? null;
  }
  const subscriptions = await supabaseRequest<Subscription[]>(
    "subscriptions?is_active=eq.true&select=contact_id,region_id,contacts(phone_e164,last_inbound_at,opted_out_at),regions(name)",
  );
  const targets = subscriptions.filter((subscription) =>
    coveredRegionIds.has(subscription.region_id),
  );
  const regionName = targets[0]?.regions?.name ?? "wilayah terkait";
  const body =
    `🚨 Peringatan: laporan MPA terverifikasi sebagai api nyata di ${regionName}.\n` +
    "Mohon tetap waspada dan hindari area tersebut.\n" +
    `ID laporan: ${reportId}\n` +
    `Lihat laporan: ${env.publicAppUrl.replace(/\/+$/, "")}/laporan?report_id=${encodeURIComponent(reportId)}`;
  return dispatchToSubscriptions(
    targets,
    body,
    `report:${reportId}:verified`,
    incidentId ?? undefined,
    reportId,
  );
}
