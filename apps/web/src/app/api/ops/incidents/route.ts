import { connection, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const incidentStatuses = [
  "new",
  "confirmed",
  "false_alarm",
  "escalated",
  "in_progress",
  "contained",
  "extinguished",
  "closed",
] as const;

export async function GET() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Autentikasi diperlukan." },
      { status: 401 },
    );

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "petugas" && profile?.role !== "admin")
    return NextResponse.json(
      { error: "Akses Petugas diperlukan." },
      { status: 403 },
    );

  const { data, error } = await supabase
    .from("incidents")
    .select(
      "id,region_id,source,status,needs_review,priority_score,hotspot_count,first_detected_at,last_detected_at,closed_at,regions(name)",
    )
    .in("status", ["confirmed", "in_progress", "extinguished"])
    .order("last_detected_at", { ascending: false })
    .limit(100);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  await connection();
  const body = (await request.json().catch(() => null)) as {
    incidentId?: string;
    status?: string;
    note?: string;
  } | null;
  if (!body?.incidentId || !incidentStatuses.includes(body.status as never))
    return NextResponse.json(
      { error: "Insiden dan status wajib diisi." },
      { status: 400 },
    );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Autentikasi diperlukan." },
      { status: 401 },
    );
  const { data, error } = await supabase.rpc("transition_incident_status", {
    p_incident_id: body.incidentId,
    p_to_status: body.status,
    p_note: body.note ?? null,
  });
  if (error) {
    const status = error.message.includes("forbidden")
      ? 403
      : error.message.includes("not_found")
        ? 404
        : 409;
    return NextResponse.json(
      { error: "Transisi status tidak diizinkan." },
      { status },
    );
  }
  return NextResponse.json({ data });
}
