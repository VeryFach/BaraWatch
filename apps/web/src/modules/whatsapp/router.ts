import { getOrCreateContact, getSession, logInbound, setSession } from "./db";
import { HELP, isMpa, MAIN_MENU, MPA_MENU } from "./menu";
import {
  classifyReport,
  findRegionDescendantIds,
  findReportById,
  formatReportDetails,
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
  if (body === "5") {
    await setSession(contactId, "mpa_lookup_report");
    return "Ketik ID laporan lengkap yang ingin dicari.";
  }
  return null;
}

async function handleMpaReportLookup(contactId: string, body: string) {
  const report = await findReportById(body.trim());
  if (!report) return "ID laporan tidak ditemukan atau format ID tidak valid.";
  const region = report.region_id
    ? (await import("./reports")).getReportRegionNames(report.region_id)
    : Promise.resolve({
        desa: "Tidak diketahui",
        kecamatan: "Tidak diketahui",
        kabupaten: "Tidak diketahui",
      });
  const names = await region;
  await setSession(contactId, "mpa_menu");
  return (
    `${formatReportDetails(report, `${names.desa}, ${names.kecamatan}, ${names.kabupaten}`)}\n\n` +
    `Balas *NILAI ${report.id} 1* jika api nyata atau *NILAI ${report.id} 2* jika bukan api nyata.`
  );
}

async function handleMpaClassification(contactId: string, body: string) {
  const match =
    body.match(/^(?:nilai\s+)?([0-9a-f-]{36})\s+([12])$/i) ??
    body.match(/^(api nyata|bukan api nyata)\s+([0-9a-f-]{36})$/i);
  if (!match) return null;
  const isRealFire =
    match[1].toLowerCase() === "api nyata"
      ? true
      : match[1].toLowerCase() === "bukan api nyata"
        ? false
        : match[2] === "1";
  const reportId =
    match[1].toLowerCase() === "api nyata" ||
    match[1].toLowerCase() === "bukan api nyata"
      ? match[2]
      : match[1];
  const result = await classifyReport(reportId, isRealFire, contactId);
  if (!result) return "ID laporan tidak ditemukan.";
  if (result.alreadyClassified)
    return `Laporan ${reportId} sudah pernah dinilai dengan status ${result.status}.`;
  return isRealFire
    ? `Laporan ${reportId} ditandai sebagai api nyata dan diteruskan untuk penanganan.`
    : `Laporan ${reportId} ditandai bukan api nyata.`;
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
    const classificationResponse = await handleMpaClassification(
      contact.id,
      body,
    );
    if (classificationResponse) return classificationResponse;
    if (session.state === "mpa_lookup_report") {
      return handleMpaReportLookup(contact.id, body);
    }
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
    if (
      session.state === "mpa_menu" &&
      !["1", "2", "3", "4", "5"].includes(body)
    ) {
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
