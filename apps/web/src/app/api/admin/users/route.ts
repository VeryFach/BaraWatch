import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedRoles = ["petugas", "penegak_hukum", "admin"] as const;

export async function POST(request: Request) {
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
    .single();
  if (profile?.role !== "admin")
    return NextResponse.json(
      { error: "Hanya admin yang dapat membuat akun." },
      { status: 403 },
    );

  const body = (await request.json()) as {
    email?: string;
    password?: string;
    fullName?: string;
    role?: string;
    agency?: string;
  };
  if (
    !body.email ||
    !body.password ||
    !body.fullName ||
    !allowedRoles.includes(body.role as (typeof allowedRoles)[number])
  ) {
    return NextResponse.json(
      { error: "Email, password, nama, dan role wajib diisi." },
      { status: 400 },
    );
  }
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
  });
  if (error || !data.user)
    return NextResponse.json(
      { error: error?.message ?? "Akun gagal dibuat." },
      { status: 400 },
    );
  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    full_name: body.fullName,
    role: body.role,
    agency: body.agency || null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }
  return NextResponse.json({ id: data.user.id });
}
