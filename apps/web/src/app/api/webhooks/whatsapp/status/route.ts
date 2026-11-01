import twilio from "twilio";
import { getServerEnv } from "@/lib/env";
import { supabaseRequest } from "@/lib/supabase/admin";

const statuses = new Set([
  "queued",
  "accepted",
  "sending",
  "sent",
  "delivered",
  "read",
  "failed",
  "undelivered",
]);

export async function POST(request: Request) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const env = getServerEnv();
  const signature = request.headers.get("x-twilio-signature");
  const url = env.twilioStatusCallbackUrl ?? request.url;
  if (
    !signature ||
    !twilio.validateRequest(
      env.twilioAuthToken,
      signature,
      url,
      Object.fromEntries(params.entries()),
    )
  ) {
    return Response.json(
      { error: "Invalid Twilio signature" },
      { status: 401 },
    );
  }

  const providerSid = params.get("MessageSid");
  const rawStatus = params.get("MessageStatus")?.toLowerCase();
  if (!providerSid || !rawStatus || !statuses.has(rawStatus)) {
    return Response.json(
      { error: "Missing Twilio status fields" },
      { status: 400 },
    );
  }
  const status =
    rawStatus === "undelivered"
      ? "failed"
      : rawStatus === "accepted" || rawStatus === "sending"
        ? "queued"
        : rawStatus;
  const rows = await supabaseRequest<Array<{ attempts: number }>>(
    `wa_messages?provider_sid=eq.${encodeURIComponent(providerSid)}&select=attempts&limit=1`,
  );
  const update: Record<string, string | number | null> = { status };
  const errorCode = params.get("ErrorCode");
  if (errorCode) update.error_code = errorCode.slice(0, 200);
  if (status === "failed") {
    const attempts = rows[0]?.attempts ?? 0;
    update.next_retry_at =
      attempts < 5
        ? new Date(
            Date.now() + Math.min(60 * 60, 30 * 2 ** attempts) * 1000,
          ).toISOString()
        : null;
  }
  if (status === "delivered" || status === "read") {
    update.delivered_at = new Date().toISOString();
  }
  await supabaseRequest(
    `wa_messages?provider_sid=eq.${encodeURIComponent(providerSid)}`,
    { method: "PATCH", body: JSON.stringify(update) },
  );
  return new Response(null, { status: 204 });
}
