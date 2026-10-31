import { NextResponse } from "next/server";
import { supabaseRequest } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const data = await supabaseRequest<
      {
        region_id: string;
        region_code: string;
        region_name: string;
        region_level: string;
        week_start: string;
        risk_level: string;
        score: number | null;
        top_reasons: string[];
        method: string;
      }[]
    >("public_risk_v?select=region_id,region_code,region_name,region_level,week_start,risk_level,score,top_reasons,method");
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: "Data risiko sedang tidak tersedia." },
      { status: 503 },
    );
  }
}
