import twilio from "twilio";
import { getServerEnv } from "@/lib/env";
import type { WhatsAppProvider } from "./provider";

function getClient() {
  const env = getServerEnv();
  return twilio(env.twilioAccountSid, env.twilioAuthToken);
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
