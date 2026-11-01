
import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const healthcheckKey = process.env.HEALTHCHECK_KEY;

  if (
    !healthcheckKey ||
    request.headers.get("x-healthcheck-key") !== healthcheckKey
  ) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

    if (!accountSid || !authToken || !whatsappFrom) {
      throw new Error("Missing Twilio environment variables");
    }

    const client = twilio(accountSid, authToken);

    const account = await client.api
      .accounts(accountSid)
      .fetch();

    return NextResponse.json({
      success: account.status === "active",
      service: "twilio",
      checks: {
        credentials: "valid",
        accountStatus: account.status,
        whatsappFromConfigured: Boolean(whatsappFrom),
      },
      message: "Twilio health check completed.",
    });
  } catch (error) {
    console.error("[Twilio Health Check]", error);

    return NextResponse.json(
      {
        success: false,
        service: "twilio",
        checks: {
          credentials: "invalid_or_unreachable",
        },
        message: "Twilio health check failed.",
      },
      { status: 503 }
    );
  }
}
