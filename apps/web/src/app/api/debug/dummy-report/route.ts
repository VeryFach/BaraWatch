import { timingSafeEqual } from "node:crypto";
import { supabaseRequest } from "@/lib/supabase/admin";
import { createPublicReport } from "@/modules/reports/repo";
import { notifyMpa } from "@/modules/whatsapp/mpa/service";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE_E164 = /^\+[1-9]\d{7,14}$/;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function findTestPoint(regionId: string) {
  const rows = await supabaseRequest<
    Array<{ latitude: number; longitude: number }>
  >("rpc/region_test_point", {
    method: "POST",
    body: JSON.stringify({ p_region_id: regionId }),
  });
  return rows[0] ?? null;
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (
    !cronSecret ||
    !authorization.startsWith("Bearer ") ||
    !secureEqual(authorization.slice(7), cronSecret)
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const regionId = String(form.get("region_id") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const description = String(
    form.get("description") ?? "Dummy test laporan kebakaran",
  ).trim();
  const photo = form.get("photo");
  if (!UUID.test(regionId) || !PHONE_E164.test(phone)) {
    return Response.json(
      { error: "region_id UUID dan phone E.164 wajib diisi" },
      { status: 400 },
    );
  }
  if (!(photo instanceof File) || photo.size === 0) {
    return Response.json(
      { error: "photo JPG wajib diunggah" },
      { status: 400 },
    );
  }
  if (photo.type !== "image/jpeg" || photo.size > MAX_PHOTO_BYTES) {
    return Response.json(
      { error: "photo harus JPG/JPEG dan maksimal 5 MB" },
      { status: 400 },
    );
  }
  const point = await findTestPoint(regionId);
  if (!point) {
    return Response.json(
      { error: "Desa tidak ditemukan atau belum memiliki geometri" },
      { status: 400 },
    );
  }

  try {
    const result = await createPublicReport({
      phone,
      regionId,
      type: "Api",
      description,
      latitude: point.latitude,
      longitude: point.longitude,
      photo: { bytes: await photo.arrayBuffer() },
      publicPhotoConsent: true,
    });
    const notifiedMpa = await notifyMpa(
      result.reportId,
      regionId,
      point.latitude,
      point.longitude,
      ["fire"],
    );
    return Response.json(
      {
        ok: true,
        report_id: result.reportId,
        incident_id: result.incidentId,
        region_id: regionId,
        notified_mpa: notifiedMpa,
        warnings: result.warnings,
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Dummy report creation failed",
      },
      { status: 502 },
    );
  }
}
