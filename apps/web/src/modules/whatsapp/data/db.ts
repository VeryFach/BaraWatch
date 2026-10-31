import { supabaseRequest } from "@/lib/supabase/admin";
import type { Contact, Inbound, Session } from "../core/types";

export async function queryOne<T>(path: string): Promise<T | null> {
  const rows = await supabaseRequest<T[]>(`${path}&limit=1`);
  return rows[0] ?? null;
}

export async function getOrCreateContact(phone: string): Promise<Contact> {
  const existing = await queryOne<Contact>(
    `contacts?phone_e164=eq.${encodeURIComponent(phone)}&select=id,phone_e164,role,assigned_region_id,last_inbound_at`,
  );
  if (existing) return existing;
  const rows = await supabaseRequest<Contact[]>("contacts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      phone_e164: phone,
      consent_at: new Date().toISOString(),
    }),
  });
  if (!rows[0]) throw new Error("Contact creation returned no row");
  return rows[0];
}

export async function getSession(contactId: string): Promise<Session> {
  const session = await queryOne<Session>(
    `wa_sessions?contact_id=eq.${contactId}&select=state,context`,
  );
  return session ?? { state: "idle", context: {} };
}

export async function setSession(
  contactId: string,
  state: Session["state"],
  context: Record<string, unknown> = {},
) {
  await supabaseRequest("wa_sessions", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ contact_id: contactId, state, context }),
  });
}

export async function logInbound(contactId: string, message: Inbound) {
  await supabaseRequest("wa_messages", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      contact_id: contactId,
      direction: "in",
      kind: "chat",
      provider_sid: message.messageSid,
      body: message.body || null,
      media_path: message.mediaUrl ?? null,
      lat: message.latitude ?? null,
      lng: message.longitude ?? null,
      status: "received",
    }),
  });
  await supabaseRequest(`contacts?id=eq.${contactId}`, {
    method: "PATCH",
    body: JSON.stringify({
      last_inbound_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function inboundMessageExists(
  providerSid: string,
): Promise<boolean> {
  const rows = await supabaseRequest<Array<{ id: string }>>(
    `wa_messages?provider_sid=eq.${encodeURIComponent(providerSid)}&select=id&limit=1`,
  );
  return rows.length > 0;
}
