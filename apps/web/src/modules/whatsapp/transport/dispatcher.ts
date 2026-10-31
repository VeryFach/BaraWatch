import { getServerEnv } from "@/lib/env";
import { supabaseRequest } from "@/lib/supabase/admin";
import { twilioProvider } from "./twilio";

type Subscription = {
  contact_id: string;
  contacts: { phone_e164: string; last_inbound_at: string | null } | null;
  regions: { name: string } | null;
};

export async function dispatchNewIncidentAlert(
  incidentId: string,
  regionId: string,
): Promise<number> {
  const subscriptions = await supabaseRequest<Subscription[]>(
    `subscriptions?region_id=eq.${encodeURIComponent(regionId)}&is_active=eq.true&select=contact_id,contacts(phone_e164,last_inbound_at),regions(name)`,
  );
  const env = getServerEnv();
  let sentCount = 0;
  for (const subscription of subscriptions) {
    const contact = subscription.contacts;
    const regionName = subscription.regions?.name;
    if (!contact || !regionName) continue;
    const dedupeKey = `${incidentId}:${subscription.contact_id}:alert`;
    const recent = contact.last_inbound_at
      ? Date.now() - Date.parse(contact.last_inbound_at) < 24 * 60 * 60 * 1000
      : false;
    const alreadySent = await supabaseRequest<{ id: string }[]>(
      `wa_messages?dedupe_key=eq.${encodeURIComponent(dedupeKey)}&select=id&limit=1`,
    );
    if (alreadySent.length > 0) continue;
    const body = `🚨 Peringatan: Titik api baru terdeteksi di area ${regionName}. Mohon tetap waspada dan hindari area tersebut.`;
    const message =
      !recent && env.twilioAlertTemplateSid
        ? await twilioProvider.sendTemplate(
            contact.phone_e164,
            env.twilioAlertTemplateSid,
            [regionName],
          )
        : await twilioProvider.sendText(contact.phone_e164, body);
    await supabaseRequest("wa_messages", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        contact_id: subscription.contact_id,
        direction: "out",
        kind: "alert",
        provider_sid: message.sid,
        dedupe_key: dedupeKey,
        template_name:
          !recent && env.twilioAlertTemplateSid ? "alert_baru" : null,
        body: !recent && env.twilioAlertTemplateSid ? null : body,
        status: "sent",
        handed_off_at: new Date().toISOString(),
        incident_id: incidentId,
      }),
    });
    sentCount++;
  }
  return sentCount;
}
