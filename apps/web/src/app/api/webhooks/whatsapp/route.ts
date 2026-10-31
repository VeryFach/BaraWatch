import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { supabaseRequest } from "@/lib/supabase/admin";
import { routeInbound } from "@/modules/whatsapp/router";
import { twilioProvider } from "@/modules/whatsapp/twilio";

function validTwilioSignature(
  url: string,
  params: URLSearchParams,
  signature: string | null,
): boolean {
  const secret = getServerEnv().twilioAuthToken;
  if (!signature) return false;
  const payload =
    url +
    [...params.keys()]
      .sort()
      .map((key) => key + params.get(key))
      .join("");
  const expected = createHmac("sha1", secret).update(payload).digest("base64");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

function numberFrom(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function POST(request: Request) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  if (
    !validTwilioSignature(
      request.url,
      params,
      request.headers.get("x-twilio-signature"),
    )
  ) {
    return NextResponse.json(
      { error: "Invalid Twilio signature" },
      { status: 401 },
    );
  }
  const from = params.get("From")?.replace(/^whatsapp:/, "");
  const messageSid = params.get("MessageSid");
  if (!from || !messageSid)
    return NextResponse.json(
      { error: "Missing Twilio message fields" },
      { status: 400 },
    );

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
