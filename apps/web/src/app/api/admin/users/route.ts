import { connection, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedRoles = ["petugas", "penegak_hukum", "admin"] as const;

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
      error: "Hanya admin yang dapat mengelola akun pengguna.",
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

  const { data: profiles, error } = await access.admin
    .from("profiles")
    .select("id,full_name,role,agency,is_active,created_at")
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: authData, error: authError } =
    await access.admin.auth.admin.listUsers();
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const emailMap = new Map(authData.users.map((u) => [u.id, u.email ?? "-"]));

  const users = profiles.map((p) => ({
    id: p.id,
    fullName: p.full_name,
    role: p.role,
    agency: p.agency,
    isActive: p.is_active,
    createdAt: p.created_at,
    email: emailMap.get(p.id) ?? "-",
  }));

  return NextResponse.json({ data: users });
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
    email?: string;
    password?: string;
    fullName?: string;
    role?: string;
    agency?: string;
  } | null;

  if (
    !body?.email ||
    !body.password ||
    !body.fullName ||
    !allowedRoles.includes(body.role as (typeof allowedRoles)[number])
  ) {
    return NextResponse.json(
      { error: "Email, password, nama, dan role wajib diisi." },
      { status: 400 },
    );
  }

  const { data, error } = await access.admin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
  });

  if (error || !data.user)
    return NextResponse.json(
      { error: error?.message ?? "Akun gagal dibuat." },
      { status: 400 },
    );

  const { error: profileError } = await access.admin.from("profiles").insert({
    id: data.user.id,
    full_name: body.fullName,
    role: body.role,
    agency: body.agency || null,
  });

  if (profileError) {
    await access.admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.user.id }, { status: 201 });
}
