import { getServerEnv } from "@/lib/env";
import { supabaseRequest } from "@/lib/supabase/admin";
import { twilioProvider } from "./twilio";

type OutboxMessage = {
  id: string;
  contact_id: string;
  template_name: string | null;
  template_variables: string[] | null;
  body: string | null;
  attempts: number;
};

type Contact = { phone_e164: string };

const MAX_ATTEMPTS = 5;

function retryAt(attempt: number) {
  const delaySeconds = Math.min(60 * 60, 30 * 2 ** Math.max(0, attempt - 1));
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

async function sendMessage(message: OutboxMessage, phone: string) {
  if (message.template_name) {
    const templateSid =
      message.template_name === "alert_baru"
        ? getServerEnv().twilioAlertTemplateSid
        : message.template_name;
    if (!templateSid) {
      throw new Error("WhatsApp template SID is not configured");
    }
    return twilioProvider.sendTemplate(
      phone,
      templateSid,
      message.template_variables ?? [],
    );
  }
  if (message.body) return twilioProvider.sendText(phone, message.body);
  throw new Error("Outbound WhatsApp message has no body or template");
}

export async function enqueueTextMessage(input: {
  contactId: string;
  body: string;
  kind:
    | "alert"
    | "update"
    | "risk_weekly"
    | "report_status"
    | "escalation"
    | "chat";
  dedupeKey?: string;
  incidentId?: string;
  reportId?: string;
  templateName?: string;
  templateVariables?: string[];
}) {
  const rows = await supabaseRequest<{ id: string }[]>("wa_messages", {
    method: "POST",
    headers: {
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify({
      contact_id: input.contactId,
      direction: "out",
      kind: input.kind,
      dedupe_key: input.dedupeKey ?? null,
      template_name: input.templateName ?? null,
      template_variables: input.templateVariables ?? null,
      body: input.templateName ? null : input.body,
      status: "queued",
      incident_id: input.incidentId ?? null,
      report_id: input.reportId ?? null,
    }),
  });
  return rows[0]?.id ?? null;
}

export async function flushOutbox(limit = 50, messageId?: string | null) {
  const idFilter = messageId ? `&id=eq.${encodeURIComponent(messageId)}` : "";
  const messages = await supabaseRequest<OutboxMessage[]>(
    `wa_messages?direction=eq.out&status=in.(queued,failed)&or=(next_retry_at.is.null,next_retry_at.lte.${encodeURIComponent(
      new Date().toISOString(),
    )})&attempts=lt.${MAX_ATTEMPTS}${idFilter}&select=id,contact_id,template_name,template_variables,body,attempts&order=created_at.asc&limit=${limit}`,
  );
  let sent = 0;
  let failed = 0;

  for (const message of messages) {
    const contacts = await supabaseRequest<Contact[]>(
      `contacts?id=eq.${encodeURIComponent(message.contact_id)}&select=phone_e164&limit=1`,
    );
    const phone = contacts[0]?.phone_e164;
    if (!phone) {
      failed += 1;
      await supabaseRequest(
        `wa_messages?id=eq.${encodeURIComponent(message.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "failed",
            error_code: "contact_not_found",
            attempts: message.attempts + 1,
            next_retry_at: null,
          }),
        },
      );
      continue;
    }

    try {
      const result = await sendMessage(message, phone);
      await supabaseRequest(
        `wa_messages?id=eq.${encodeURIComponent(message.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            provider_sid: result.sid,
            status: "sent",
            attempts: message.attempts + 1,
            next_retry_at: null,
            handed_off_at: new Date().toISOString(),
          }),
        },
      );
      sent += 1;
    } catch (error) {
      const attempts = message.attempts + 1;
      await supabaseRequest(
        `wa_messages?id=eq.${encodeURIComponent(message.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "failed",
            error_code:
              error instanceof Error
                ? error.message.slice(0, 200)
                : "send_failed",
            attempts,
            next_retry_at: attempts < MAX_ATTEMPTS ? retryAt(attempts) : null,
          }),
        },
      );
      failed += 1;
    }
  }

  return { selected: messages.length, sent, failed, maxAttempts: MAX_ATTEMPTS };
}
