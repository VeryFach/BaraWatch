import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { testTwilioCredentials } from "@/modules/whatsapp/transport/twilio";

export async function GET() {
  if (!getServerEnv().twilioDebug) {
    return NextResponse.json(
      { error: "Twilio debug is disabled" },
      { status: 404 },
    );
  }
  const result = await testTwilioCredentials();
  return NextResponse.json(
    {
      ...result,
      webhookUrl: getServerEnv().twilioWebhookUrl ?? null,
      note: "The auth token is never returned.",
    },
    { status: result.valid ? 200 : 502 },
  );
}
