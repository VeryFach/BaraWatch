export type WhatsAppInbound = {
  from: string;
  body: string;
  messageSid: string;
  mediaUrl?: string;
  mediaContentType?: string;
  latitude?: number;
  longitude?: number;
};

export type WhatsAppProvider = {
  sendText(to: string, body: string): Promise<{ sid: string }>;
  sendTemplate(
    to: string,
    templateName: string,
    variables: string[],
  ): Promise<{ sid: string }>;
};
