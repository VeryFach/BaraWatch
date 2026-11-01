import { connection, NextResponse } from "next/server";
import { supabaseRequest } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { dispatchVerifiedReportAlert } from "@/modules/whatsapp/transport/dispatcher";

const verdicts = ["real_fire", "not_fire"] as const;

async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      supabase,
      response: NextResponse.json(
        { error: "Autentikasi diperlukan." },
        { status: 401 },
      ),
    };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "petugas" && profile?.role !== "admin") {
    return {
      supabase,
      response: NextResponse.json(
        { error: "Akses Petugas diperlukan." },
        { status: 403 },
      ),
    };
  }
  return { supabase, response: null };
}

export async function GET() {
  await connection();
  const { response } = await requireOperator();
  if (response) return response;
  const data = await supabaseRequest<
    Array<{
      id: string;
      status: string;
      verification_outcome: string | null;
      description: string | null;
      created_at: string;
      incident_id: string | null;
      region_id: string | null;
      regions: { name: string } | null;
    }>
  >(
    "reports?select=id,status,verification_outcome,description,created_at,incident_id,region_id,regions(name)&order=created_at.desc&limit=100",
  );
  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  await connection();
  const body = (await request.json().catch(() => null)) as {
    reportId?: string;
    verdict?: string;
    action?: string;
  } | null;
  if (
    !body?.reportId ||
    (!body.action && !verdicts.includes(body.verdict as never))
  ) {
    return NextResponse.json(
      { error: "Laporan dan verdict wajib diisi." },
      { status: 400 },
    );
  }
  const { supabase, response } = await requireOperator();
  if (response) return response;
  if (body.action === "follow_up") {
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("id,incident_id,status")
      .eq("id", body.reportId)
      .maybeSingle();
    if (reportError || !report) {
      return NextResponse.json(
        { error: "Laporan tidak ditemukan." },
        { status: 404 },
      );
    }
    if (report.status !== "verified" || !report.incident_id) {
      return NextResponse.json(
        { error: "Laporan harus berstatus api nyata dan terkait insiden." },
        { status: 409 },
      );
    }
    const { error: transitionError } = await supabase.rpc(
      "transition_incident_status",
      {
        p_incident_id: report.incident_id,
        p_to_status: "in_progress",
        p_note: "Tindak lanjut petugas pada laporan warga.",
      },
    );
    if (transitionError) {
      return NextResponse.json(
        { error: "Insiden belum dapat ditindaklanjuti dari status saat ini." },
        { status: 409 },
      );
    }
    const { error: updateError } = await supabase
      .from("reports")
      .update({ status: "handled", updated_at: new Date().toISOString() })
      .eq("id", body.reportId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ data: { id: report.id, status: "handled" } });
  }
  const isRealFire = body.verdict === "real_fire";
  const { data: verdict, error: verdictError } = await supabase.rpc(
    "record_operator_report_verdict",
    {
      p_report_id: body.reportId,
      p_verdict: body.verdict,
    },
  );
  if (verdictError) {
    const status = verdictError.message.includes("not_found")
      ? 404
      : verdictError.message.includes("forbidden")
        ? 403
        : 409;
    return NextResponse.json(
      { error: "Verdict laporan gagal disimpan." },
      { status },
    );
  }
  const result = Array.isArray(verdict) ? verdict[0] : verdict;
  if (!result) {
    return NextResponse.json(
      { error: "Verdict laporan tidak dikembalikan." },
      { status: 500 },
    );
  }
  let alertWarning: string | null = null;
  if (isRealFire && result.region_id) {
    try {
      await dispatchVerifiedReportAlert(
        result.report_id,
        result.region_id,
        result.incident_id,
      );
    } catch {
      alertWarning =
        "Verdict tersimpan, tetapi peringatan subscriber gagal dikirim.";
    }
  }
  return NextResponse.json({
    data: {
      id: result.report_id,
      status: result.report_status,
      verification_outcome: result.verification_outcome,
      incident_status: result.incident_status,
      warning: alertWarning,
    },
  });
}
