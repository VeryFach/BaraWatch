import { HELP, isMpa, MAIN_MENU, MPA_MENU } from "./core/menu";
import type { Inbound } from "./core/types";
import {
  getOrCreateContact,
  getSession,
  logInbound,
  setSession,
} from "./data/db";
import { handleMpaMessage } from "./mpa/router";
import { notifyMpa } from "./mpa/service";
import { handleRegionSelection, startRegionSelection } from "./regions/service";
import { finishReport } from "./reports/service";

function isMenuCommand(body: string) {
  return body === "0" || body === "menu" || body === "mulai";
}

export async function routeInbound(message: Inbound): Promise<string> {
  const contact = await getOrCreateContact(message.from);
  await logInbound(contact.id, message);
  const session = await getSession(contact.id);
  const body = message.body.trim().toLowerCase();

  if (isMenuCommand(body)) {
    await setSession(contact.id, isMpa(contact) ? "mpa_menu" : "idle");
    return isMpa(contact) ? MPA_MENU : MAIN_MENU;
  }
  if (isMpa(contact)) {
    const mpaResponse = await handleMpaMessage(contact, session, body);
    if (mpaResponse) return mpaResponse;
  }
  if (body === "3" || body === "bantuan" || body === "help") return HELP;

  if (
    ["choosing_kabupaten", "choosing_kecamatan", "choosing_desa"].includes(
      session.state,
    )
  ) {
    return handleRegionSelection(contact, session, message.body);
  }
  if (
    session.state === "awaiting_photo" &&
    message.mediaUrl &&
    message.mediaContentType?.startsWith("image/")
  ) {
    await setSession(contact.id, "awaiting_location", {
      mediaUrl: message.mediaUrl,
      mediaContentType: message.mediaContentType,
    });
    return "Foto diterima. Sekarang mohon bagikan Lokasi Terkini (*Share Location*) Anda.";
  }
  if (
    session.state === "awaiting_location" &&
    message.latitude !== undefined &&
    message.longitude !== undefined
  ) {
    const result = await finishReport(contact, session, message);
    if (result.vision?.labels.length) {
      await notifyMpa(
        result.reportId,
        result.regionId,
        message.latitude,
        message.longitude,
        result.vision.labels,
      );
    }
    return result.vision?.labels.length
      ? "Laporan diterima. Tim MPA akan memverifikasi kondisi di lapangan. Terima kasih."
      : "Laporan diterima dan masuk antrean evaluasi admin karena AI belum menemukan indikasi pada gambar. Terima kasih.";
  }
  if (body === "1" || body === "daftar" || body === "info")
    return startRegionSelection(contact);
  if (body === "2" || body === "lapor") {
    await setSession(contact.id, "awaiting_photo");
    return "Silakan kirim foto kejadian kebakaran terlebih dahulu. Setelah itu, bot akan meminta Lokasi Terkini (*Share Location*) Anda.";
  }
  if (message.mediaUrl) {
    await setSession(contact.id, "awaiting_location", {
      mediaUrl: message.mediaUrl,
      mediaContentType: message.mediaContentType,
    });
    return "Foto diterima. Sekarang mohon bagikan Lokasi Terkini (*Share Location*) Anda.";
  }
  return HELP;
}
