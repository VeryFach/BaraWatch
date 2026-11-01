import { NextResponse } from "next/server";
import type { PublicRegion, PublicRegionBoundary } from "@/lib/public-api";
import { supabaseRequest } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level");
  const parentId = searchParams.get("parent_id");
  const bboxKeys = ["west", "south", "east", "north"] as const;
  const hasBbox = bboxKeys.every((key) => searchParams.has(key));
  const bbox = bboxKeys.map((key) => Number(searchParams.get(key)));
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
    const regions = await supabaseRequest<PublicRegionBoundary[]>(
      "rpc/get_public_regions_in_bbox",
      {
        method: "POST",
        body: JSON.stringify({ west, south, east, north }),
      },
    );
    return NextResponse.json({
      data: level ? regions.filter((region) => region.level === level) : regions,
    });
  }
  const includeGeometry = searchParams.get("include_geometry") !== "false";
  const filters = [
    level ? `level=eq.${encodeURIComponent(level)}` : "",
    parentId ? `parent_id=eq.${encodeURIComponent(parentId)}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const select = includeGeometry
    ? "id,parent_id,level,code,name,geometry"
    : "id,parent_id,level,code,name";
  const regions = await supabaseRequest<
    (PublicRegion | PublicRegionBoundary)[]
  >(
    `public_regions?select=${select}&order=code.asc&limit=10000${filters ? `&${filters}` : ""}`,
  );
  return NextResponse.json({ data: regions });
}
