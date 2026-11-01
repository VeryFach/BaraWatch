import { NextResponse } from "next/server";
import { supabaseRequest } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const regionIds = searchParams.get("region_id")?.split(",").filter(Boolean);
    const bboxKeys = ["west", "south", "east", "north"] as const;
    const hasBbox = bboxKeys.every((key) => searchParams.has(key));
    const bbox = bboxKeys.map((key) => Number(searchParams.get(key)));
    let ids = regionIds;
    if (hasBbox) {
      if (!bbox.every(Number.isFinite)) {
        return NextResponse.json({ error: "Batas peta tidak valid." }, { status: 400 });
      }
      const [west, south, east, north] = bbox;
      if (
        west < -180 ||
        east > 180 ||
        south < -90 ||
        north > 90 ||
        west >= east ||
        south >= north
      ) {
        return NextResponse.json({ error: "Batas peta tidak valid." }, { status: 400 });
      }
      const regions = await supabaseRequest<{ id: string }[]>(
        "rpc/get_public_regions_in_bbox",
        {
          method: "POST",
          body: JSON.stringify({ west, south, east, north }),
        },
      );
      ids = regions.filter((region) => region.id).map((region) => region.id);
    }
    if (ids?.length === 0) return NextResponse.json({ data: [] });
    const filter = ids?.length
      ? `&region_id=in.(${ids.map(encodeURIComponent).join(",")})`
      : "";
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
    >(`public_risk_v?select=region_id,region_code,region_name,region_level,week_start,risk_level,score,top_reasons,method${filter}`);
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: "Data risiko sedang tidak tersedia." },
      { status: 503 },
    );
  }
}
