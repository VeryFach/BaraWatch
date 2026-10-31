import twilio from "twilio";
import { getServerEnv } from "@/lib/env";
import type { WhatsAppProvider } from "../core/provider";

function getClient() {
  const env = getServerEnv();
  return twilio(env.twilioAccountSid, env.twilioAuthToken);
}

function mask(value: string): string {
  if (value.length < 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function verifyTwilioCredentials(): Promise<void> {
  const env = getServerEnv();
  console.log("[Twilio] credential config", {
    accountSid: mask(env.twilioAccountSid),
    authTokenConfigured: Boolean(env.twilioAuthToken),
    authTokenLength: env.twilioAuthToken.length,
    whatsappFrom: mask(env.twilioWhatsappFrom),
    webhookUrlConfigured: Boolean(env.twilioWebhookUrl),
  });

  try {
    const account = await getClient()
      .api.v2010.accounts(env.twilioAccountSid)
      .fetch();
    console.log("[Twilio] credentials valid", {
      accountSid: mask(account.sid),
      accountStatus: account.status,
      accountType: account.type,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Twilio error";
    console.error("[Twilio] credentials invalid", {
      accountSid: mask(env.twilioAccountSid),
      error: message,
    });
    throw new Error("Twilio credentials are invalid", { cause: error });
  }
}

export async function testTwilioCredentials(): Promise<{
  valid: boolean;
  accountSid: string;
  accountStatus?: string;
  error?: string;
}> {
  const env = getServerEnv();
  const accountSid = mask(env.twilioAccountSid);
  try {
    const account = await getClient()
      .api.v2010.accounts(env.twilioAccountSid)
      .fetch();
    return { valid: true, accountSid, accountStatus: account.status };
  } catch (error) {
    return {
      valid: false,
      accountSid,
      error: error instanceof Error ? error.message : "Unknown Twilio error",
    };
  }
}

function whatsappAddress(value: string): string {
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
}

export const twilioProvider: WhatsAppProvider = {
  async sendText(to, body) {
    const env = getServerEnv();
    const message = await getClient().messages.create({
      from: whatsappAddress(env.twilioWhatsappFrom),
      to: whatsappAddress(to),
      body,
    });
    return { sid: message.sid };
  },
  async sendTemplate(to, templateName, variables) {
    const env = getServerEnv();
    const message = await getClient().messages.create({
      from: whatsappAddress(env.twilioWhatsappFrom),
      to: whatsappAddress(to),
      contentSid: templateName,
      contentVariables: JSON.stringify(
        Object.fromEntries(
          variables.map((value, index) => [String(index + 1), value]),
        ),
      ),
    });
    return { sid: message.sid };
  },
};
