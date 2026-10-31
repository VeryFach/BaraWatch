import { connection, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Autentikasi diperlukan." },
      { status: 401 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json(
      { error: "Profil pengguna tidak dapat diverifikasi." },
      { status: 500 },
    );
  }
  if (profile?.role !== "petugas" && profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Akses Petugas diperlukan." },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("response_teams")
    .select("id,name,agency,is_active,regions(name)")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(50);
  if (error) {
    return NextResponse.json(
      { error: "Data tim lapangan belum dapat dimuat." },
      { status: 503 },
    );
  }
  return NextResponse.json({ data: data ?? [] });
}
