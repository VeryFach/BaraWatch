import { NextResponse } from "next/server";
import twilio from "twilio";
import { getServerEnv } from "@/lib/env";
import { supabaseRequest } from "@/lib/supabase/admin";
import { inboundMessageExists } from "@/modules/whatsapp/data/db";
import { routeInbound } from "@/modules/whatsapp/router";
import { twilioProvider } from "@/modules/whatsapp/transport/twilio";

function validTwilioSignature(
  url: string,
  params: URLSearchParams,
  signature: string | null,
): boolean {
  const secret = getServerEnv().twilioAuthToken;
  if (!signature) return false;
  return twilio.validateRequest(
    secret,
    signature,
    url,
    Object.fromEntries(params.entries()),
  );
}

function numberFrom(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function POST(request: Request) {
  let body: string;
  try {
    body = await request.text();
  } catch (error) {
    if (
      request.signal.aborted ||
      (error instanceof Error &&
        (error.name === "AbortError" ||
          (error as NodeJS.ErrnoException).code === "ECONNRESET"))
    ) {
      console.warn("[WhatsApp webhook] request body was aborted");
      return new NextResponse(null, { status: 204 });
    }
    throw error;
  }
  const params = new URLSearchParams(body);
  const env = getServerEnv();
  const signature = request.headers.get("x-twilio-signature");
  const signatureUrl = env.twilioWebhookUrl ?? request.url;
  const publicSignatureValid = validTwilioSignature(
    signatureUrl,
    params,
    signature,
  );
  const localSignatureValid = validTwilioSignature(
    request.url,
    params,
    signature,
  );
  console.log("[WhatsApp webhook] request received", {
    requestUrl: request.url,
    signatureUrl,
    signaturePresent: Boolean(signature),
    parameterNames: [...params.keys()].sort(),
    publicSignatureValid,
    localSignatureValid,
  });
  if (!publicSignatureValid) {
    console.error("[WhatsApp webhook] rejected: invalid Twilio signature", {
      hint: "requestUrl localhost is expected behind ngrok; TWILIO_WEBHOOK_URL must exactly match the public URL saved in Twilio Sandbox",
    });
    return NextResponse.json(
      { error: "Invalid Twilio signature" },
      { status: 401 },
    );
  }
  const from = params.get("From")?.replace(/^whatsapp:/, "");
  const messageSid = params.get("MessageSid");
  console.log("[WhatsApp webhook] message parsed", {
    messageSidPresent: Boolean(messageSid),
    fromPresent: Boolean(from),
    bodyPresent: Boolean(params.get("Body")),
    mediaCount: params.get("NumMedia") ?? "0",
  });
  if (!from || !messageSid)
    return NextResponse.json(
      { error: "Missing Twilio message fields" },
      { status: 400 },
    );
  if (await inboundMessageExists(messageSid)) {
    console.log("[WhatsApp webhook] duplicate message ignored", {
      messageSidPresent: true,
    });
    return new NextResponse(null, { status: 204 });
  }

  const reply = await routeInbound({
    from,
    body: params.get("Body") ?? "",
    messageSid,
    mediaUrl: params.get("MediaUrl0") ?? undefined,
    mediaContentType: params.get("MediaContentType0") ?? undefined,
    latitude: numberFrom(params.get("Latitude")),
    longitude: numberFrom(params.get("Longitude")),
  });
  const sent = await twilioProvider.sendText(from, reply);
  const contacts = await supabaseRequest<{ id: string }[]>(
    `contacts?phone_e164=eq.${encodeURIComponent(from)}&select=id&limit=1`,
  );
  if (contacts[0]) {
    await supabaseRequest("wa_messages", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        contact_id: contacts[0].id,
        direction: "out",
        kind: "chat",
        provider_sid: sent.sid,
        body: reply,
        status: "sent",
        handed_off_at: new Date().toISOString(),
      }),
    });
  }
  return new NextResponse(null, { status: 204 });
}
