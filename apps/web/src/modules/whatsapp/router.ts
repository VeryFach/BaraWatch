import { getOrCreateContact, getSession, logInbound, setSession } from "./db";
import { HELP, isMpa, MAIN_MENU, MPA_MENU } from "./menu";
import {
  findRegionDescendantIds,
  formatReports,
  listRegionChoices,
  listReports,
  notifyMpa,
} from "./mpa";
import { handleRegionSelection, startRegionSelection } from "./regions";
import { finishReport } from "./reports";
import type { Inbound } from "./types";

function isMenuCommand(body: string) {
  return body === "0" || body === "menu" || body === "mulai";
}

async function handleMpaCommand(contactId: string, body: string) {
  if (body === "mpa") {
    await setSession(contactId, "mpa_menu");
    return MPA_MENU;
  }
  if (body === "1") {
    const reports = await listReports("received");
    return `Laporan belum ditangani:\n\n${formatReports(reports)}`;
  }
  if (body === "2") {
    const reports = await listReports("in_review");
    return `Laporan sedang ditangani:\n\n${formatReports(reports)}`;
  }
  if (body === "3") {
    const reports = await listReports("handled");
    return `Laporan selesai:\n\n${formatReports(reports)}`;
  }
  if (body === "4") {
    await setSession(contactId, "mpa_filter_region_level");
    return "Pilih tingkat wilayah:\n1. Kabupaten\n2. Kecamatan\n3. Desa/Kelurahan";
  }
  return null;
}

async function handleMpaRegionFilter(
  contactId: string,
  session: import("./types").Session,
  body: string,
) {
  if (session.state === "mpa_filter_region_level") {
    const levels = ["kabupaten", "kecamatan", "desa"] as const;
    const levelIndex = Number(body) - 1;
    const level = Number.isInteger(levelIndex) ? levels[levelIndex] : undefined;
    if (!level)
      return "Pilihan tidak valid. Balas 1 untuk kabupaten, 2 untuk kecamatan, atau 3 untuk desa/kelurahan.";
    await setSession(contactId, "mpa_filter_region", { level });
    const regions = await listRegionChoices(level);
    return `Pilih ${level}:\n${regions.map((region, index) => `${index + 1}. ${region.name}`).join("\n")}`;
  }
  if (session.state === "mpa_filter_region") {
    const level = session.context.level;
    if (level !== "kabupaten" && level !== "kecamatan" && level !== "desa") {
      throw new Error("Invalid MPA region filter state");
    }
    const regions = await listRegionChoices(level);
    const number = Number(body);
    const region =
      /^\d+$/.test(body) && number >= 1
        ? regions[number - 1]
        : regions.find((item) => item.name.toLocaleLowerCase("id-ID") === body);
    if (!region)
      return "Wilayah tidak ditemukan. Balas dengan nomor atau nama wilayah.";
    const ids = await findRegionDescendantIds(region.id);
    const reports = [];
    for (const id of ids) reports.push(...(await listReports(undefined, id)));
    await setSession(contactId, "mpa_menu");
    return `Laporan di ${region.name}:\n\n${formatReports(reports.slice(0, 10))}`;
  }
  return null;
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
    if (
      session.state === "mpa_filter_region_level" ||
      session.state === "mpa_filter_region"
    ) {
      const regionResponse = await handleMpaRegionFilter(
        contact.id,
        session,
        body,
      );
      if (regionResponse) return regionResponse;
    }
    if (session.state === "mpa_menu" && !["1", "2", "3", "4"].includes(body)) {
      return MPA_MENU;
    }
    const mpaResponse = await handleMpaCommand(contact.id, body);
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
    await notifyMpa(
      result.reportId,
      result.regionId,
      message.latitude,
      message.longitude,
    );
    return "Laporan diterima. Tim MPA sedang meninjau lokasi Anda. Terima kasih.";
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
