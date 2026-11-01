function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getServerEnv() {
  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceRoleKey: required("SUPABASE_SECRET_KEY"),
    twilioAccountSid: required("TWILIO_ACCOUNT_SID"),
    twilioAuthToken: required("TWILIO_AUTH_TOKEN"),
    twilioWhatsappFrom: required("TWILIO_WHATSAPP_FROM"),
    twilioWebhookUrl: process.env.TWILIO_WEBHOOK_URL,
    twilioStatusCallbackUrl:
      process.env.TWILIO_STATUS_CALLBACK_URL ??
      (process.env.TWILIO_WEBHOOK_URL
        ? `${process.env.TWILIO_WEBHOOK_URL}/status`
        : undefined),
    publicAppUrl:
      process.env.PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "https://bara-watch.vercel.app",
    twilioDebug: process.env.TWILIO_DEBUG === "true",
    twilioAlertTemplateSid: process.env.TWILIO_ALERT_TEMPLATE_SID,
    twilioWebhookSecret: process.env.TWILIO_WEBHOOK_SECRET,
    healthcheckKey: process.env.HEALTHCHECK_KEY,
    aiServiceUrl: process.env.AI_SERVICE_URL,
    aiServiceApiKey: process.env.AI_SERVICE_API_KEY,
    aiInternalKey: process.env.AI_INTERNAL_KEY,
    storageBucket: process.env.WHATSAPP_STORAGE_BUCKET ?? "whatsapp-reports",
  };
}

export function getPipelineEnv() {
  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceRoleKey: required("SUPABASE_SECRET_KEY"),
    aiServiceUrl: required("AI_SERVICE_URL"),
    aiInternalKey: required("AI_INTERNAL_KEY"),
    cronSecret: required("CRON_SECRET"),
  };
}
