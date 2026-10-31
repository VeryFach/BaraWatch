import { connection, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Autentikasi diperlukan.", status: 401 as const };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin")
    return {
      error: "Hanya admin yang dapat mengelola kontak.",
      status: 403 as const,
    };
  return { admin: createAdminClient() };
}

export async function GET() {
  await connection();
  const access = await requireAdmin();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const { data, error } = await access.admin
    .from("contacts")
    .select(
      "id,phone_e164,display_name,role,assigned_region_id,consent_at,opted_out_at,last_inbound_at,created_at,regions(id,name,level)",
    )
    .order("created_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  await connection();
  const access = await requireAdmin();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const body = (await request.json().catch(() => null)) as {
    phone?: string;
    displayName?: string;
    role?: string;
    regionId?: string;
  } | null;
  const phone = body?.phone?.trim();
  const role = body?.role === "mpa" ? "mpa" : "warga";
  if (!phone || !/^\+[1-9][0-9]{7,14}$/.test(phone))
    return NextResponse.json(
      { error: "Nomor harus format E.164, contoh +628123456789." },
      { status: 400 },
    );
  if (role === "mpa" && !body?.regionId)
    return NextResponse.json(
      { error: "MPA wajib memiliki wilayah assignment." },
      { status: 400 },
    );
  const { data, error } = await access.admin
    .from("contacts")
    .upsert(
      {
        phone_e164: phone,
        display_name: body?.displayName?.trim() || null,
        role,
        assigned_region_id: role === "mpa" ? body?.regionId : null,
      },
      { onConflict: "phone_e164" },
    )
    .select("id,phone_e164,display_name,role,assigned_region_id")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(request: Request) {
  await connection();
  const access = await requireAdmin();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    displayName?: string;
    role?: string;
    regionId?: string | null;
  } | null;
  if (!body?.id)
    return NextResponse.json(
      { error: "ID kontak wajib diisi." },
      { status: 400 },
    );
  if (body.role === "mpa" && !body.regionId)
    return NextResponse.json(
      { error: "MPA wajib memiliki wilayah assignment." },
      { status: 400 },
    );
  const { data, error } = await access.admin
    .from("contacts")
    .update({
      display_name: body.displayName?.trim() || null,
      role: body.role === "mpa" ? "mpa" : "warga",
      assigned_region_id: body.role === "mpa" ? body.regionId : null,
    })
    .eq("id", body.id)
    .select("id,phone_e164,display_name,role,assigned_region_id")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
