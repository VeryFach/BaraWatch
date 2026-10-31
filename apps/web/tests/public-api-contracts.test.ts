import assert from "node:assert/strict";
import test from "node:test";
import {
  type PublicReport,
  publicReportFromSanitizedRow,
  reportToLaporan,
} from "../src/lib/public-api";

const report: PublicReport = {
  id: "report-1",
  incident_id: null,
  matched_hotspot_id: null,
  latitude: -2.2,
  longitude: 113.9,
  observed_at: null,
  description: "Asap tebal di dekat sekolah",
  status: "in_review",
  verification_outcome: "uncertain",
  verification_score: null,
  created_at: "2026-10-31T10:00:00.000Z",
  updated_at: "2026-10-31T10:00:00.000Z",
  media: [
    {
      url: "https://example.com/report-1.jpg",
      mediaType: "image",
      annotated: true,
    },
  ],
  region: {
    id: "desa-1",
    name: "Desa Contoh",
    level: "desa",
    parent: { id: "kabupaten-1", name: "Kabupaten Contoh" },
  },
};

test("maps public report data to the frontend report contract", () => {
  assert.deepEqual(reportToLaporan(report), {
    id: "report-1",
    desa: "Desa Contoh",
    kabupaten: "Kabupaten Contoh",
    jenis: "Asap",
    catatan: "Asap tebal di dekat sekolah",
    waktu: "17.00",
    waktuIso: "2026-10-31T10:00:00.000Z",
    skorAI: 0,
    status: "menunggu",
    imageUrl: "https://example.com/report-1.jpg",
  });
});

test("maps verified and rejected reports to UI statuses", () => {
  assert.equal(
    reportToLaporan({ ...report, status: "verified" }).status,
    "diterima",
  );
  assert.equal(
    reportToLaporan({ ...report, status: "rejected" }).status,
    "ditolak",
  );
});

test("public unauthenticated report projection excludes private fields", () => {
  const untrustedRow = {
    id: "report-public",
    incident_id: null,
    status: "in_review" as const,
    created_at: "2026-10-31T10:00:00.000Z",
    latitude: -2.2,
    longitude: 113.9,
    description: "PRIVATE_REPORT_DESCRIPTION",
    storage_path: "reports/private/photo.jpg",
    phone_e164: "+6281234567890",
  };
  const publicReport = publicReportFromSanitizedRow(untrustedRow);

  assert.equal(publicReport.latitude, null);
  assert.equal(publicReport.longitude, null);
  assert.equal(publicReport.description, null);
  assert.equal(publicReport.media.length, 0);
  assert.equal(publicReport.region, null);
  assert.equal(
    JSON.stringify(publicReport).includes("PRIVATE_REPORT_DESCRIPTION"),
    false,
  );
  assert.equal(JSON.stringify(publicReport).includes("photo.jpg"), false);
  assert.equal(JSON.stringify(publicReport).includes("+6281234567890"), false);
});
