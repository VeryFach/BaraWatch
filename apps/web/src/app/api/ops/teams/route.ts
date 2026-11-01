import { connection, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    .from("response_teams")
    .select("id,name,agency,is_active,regions(name)")
    .order("name");
  if (error)
    return NextResponse.json(
      { error: "Data tim belum dapat dimuat." },
      { status: 500 },
    );

  return NextResponse.json({
    data: (data ?? []).map((team) => {
      const region = (
        team as unknown as {
          regions?: { name: string } | { name: string }[] | null;
        }
      ).regions;
      return {
        id: team.id,
        name: team.name,
        agency: team.agency,
        is_active: team.is_active,
        region: region && !Array.isArray(region) ? region.name : null,
      };
    }),
  });
}
