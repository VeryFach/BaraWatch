import { NextResponse } from "next/server";
import { supabaseRequest } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const incidentId = new URL(request.url).searchParams.get("incident_id");
  if (!incidentId || !/^[0-9a-f-]{36}$/i.test(incidentId)) {
    return NextResponse.json({ error: "incident_id tidak valid." }, { status: 400 });
  }
  try {
    const data = await supabaseRequest<
      {
        id: string;
        incident_id: string;
        area_ha: number;
        method: "dnbr" | "radar";
        image_before_date: string | null;
        image_after_date: string | null;
        cloud_cover_pct: number | null;
        is_uncertain: boolean;
        computed_at: string;
      }[]
    >(
      `burn_area_reports?select=id,incident_id,area_ha,method,image_before_date,image_after_date,cloud_cover_pct,is_uncertain,computed_at&incident_id=eq.${encodeURIComponent(incidentId)}&order=computed_at.desc`,
    );
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: "Data burn-area sedang tidak tersedia." },
      { status: 503 },
    );
  }
}
