import { connection, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ user: null, profile: null });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,full_name,role,agency")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: "Profil pengguna gagal dimuat." },
      { status: 500 },
    );
  }
  return NextResponse.json({
    user: { id: user.id, email: user.email },
    profile,
  });
}
