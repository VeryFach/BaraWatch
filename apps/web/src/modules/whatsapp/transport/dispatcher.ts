import { getServerEnv } from "@/lib/env";
import { supabaseRequest } from "@/lib/supabase/admin";
import { enqueueTextMessage, flushOutbox } from "./outbox";

type Subscription = {
  contact_id: string;
  contacts: {
    phone_e164: string;
    last_inbound_at: string | null;
    opted_out_at: string | null;
  } | null;
  regions: { name: string } | null;
};

export async function dispatchNewIncidentAlert(
  incidentId: string,
  regionId: string,
): Promise<number> {
  const subscriptions = await supabaseRequest<Subscription[]>(
    `subscriptions?region_id=eq.${encodeURIComponent(regionId)}&is_active=eq.true&select=contact_id,contacts(phone_e164,last_inbound_at,opted_out_at),regions(name)`,
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
