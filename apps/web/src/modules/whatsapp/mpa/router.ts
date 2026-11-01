import { MPA_MENU } from "../core/menu";
import type { Contact, Session } from "../core/types";
import { setSession } from "../data/db";
import { getReportRegionNames } from "../reports/service";
import {
  classifyReport,
  findRegionDescendantIds,
  findReportById,
  formatReportDetails,
  formatReports,
  listRegionChoices,
  listReports,
} from "./service";

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

async function handleReportLookup(contactId: string, body: string) {
  const report = await findReportById(body.trim());
  if (!report) return "ID laporan tidak ditemukan atau format ID tidak valid.";

  const names = report.region_id
    ? await getReportRegionNames(report.region_id)
    : {
        desa: "Tidak diketahui",
        kecamatan: "Tidak diketahui",
        kabupaten: "Tidak diketahui",
      };
  await setSession(contactId, "mpa_pending_verification", {
    reportId: report.id,
  });
  return (
    `${formatReportDetails(report, `${names.desa}, ${names.kecamatan}, ${names.kabupaten}`)}\n\n` +
    "Balas *1* jika api nyata atau *2* jika bukan api nyata."
  );
}

function classificationMessage(reportId: string, isRealFire: boolean) {
  return isRealFire
    ? `Laporan ${reportId} ditandai sebagai api nyata dan diteruskan untuk penanganan.`
    : `Laporan ${reportId} ditandai bukan api nyata.`;
}

async function classifyPendingReport(
  contactId: string,
  session: Session,
  body: string,
) {
  if (
    session.state !== "mpa_pending_verification" ||
    (body !== "1" && body !== "2")
  ) {
    return null;
  }

  const reportId = session.context.reportId;
  if (typeof reportId !== "string") {
    throw new Error("Missing pending MPA report ID");
  }
  const isRealFire = body === "1";
  const result = await classifyReport(reportId, isRealFire, contactId);
  if (!result) return "Laporan tidak ditemukan.";
  await setSession(contactId, "mpa_menu");
  if (result.conflictDetected) {
    return `Penilaian ${reportId} dicatat. Verdict MPA berbeda, sehingga insiden ditandai perlu ditinjau admin.`;
  }
  if (result.alreadyClassified) {
    return `Laporan ${reportId} sudah pernah dinilai dengan status ${result.status}.`;
  }
  return classificationMessage(reportId, isRealFire);
}

async function classifyReportCommand(contactId: string, body: string) {
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
  if (result.conflictDetected) {
    return `Penilaian ${reportId} dicatat. Verdict MPA berbeda, sehingga insiden ditandai perlu ditinjau admin.`;
  }
  if (result.alreadyClassified) {
    return `Laporan ${reportId} sudah pernah dinilai dengan status ${result.status}.`;
  }
  return classificationMessage(reportId, isRealFire);
}

async function handleRegionFilter(
  contactId: string,
  session: Session,
  body: string,
) {
  if (session.state === "mpa_filter_region_level") {
    const levels = ["kabupaten", "kecamatan", "desa"] as const;
    const levelIndex = Number(body) - 1;
    const level = Number.isInteger(levelIndex) ? levels[levelIndex] : undefined;
    if (!level) {
      return "Pilihan tidak valid. Balas 1 untuk kabupaten, 2 untuk kecamatan, atau 3 untuk desa/kelurahan.";
    }
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
    if (!region) {
      return "Wilayah tidak ditemukan. Balas dengan nomor atau nama wilayah.";
    }
    const ids = await findRegionDescendantIds(region.id);
    const reports = [];
    for (const id of ids) reports.push(...(await listReports(undefined, id)));
    await setSession(contactId, "mpa_menu");
    return `Laporan di ${region.name}:\n\n${formatReports(reports.slice(0, 10))}`;
  }
  return null;
}

export async function handleMpaMessage(
  contact: Contact,
  session: Session,
  body: string,
): Promise<string | null> {
  const pendingResponse = await classifyPendingReport(
    contact.id,
    session,
    body,
  );
  if (pendingResponse) return pendingResponse;

  const commandResponse = await classifyReportCommand(contact.id, body);
  if (commandResponse) return commandResponse;

  if (session.state === "mpa_lookup_report") {
    return handleReportLookup(contact.id, body);
  }

  const regionResponse =
    session.state === "mpa_filter_region_level" ||
    session.state === "mpa_filter_region"
      ? await handleRegionFilter(contact.id, session, body)
      : null;
  if (regionResponse) return regionResponse;

  if (
    session.state === "mpa_menu" &&
    !["1", "2", "3", "4", "5"].includes(body)
  ) {
    return MPA_MENU;
  }
  return handleMpaCommand(contact.id, body);
}
