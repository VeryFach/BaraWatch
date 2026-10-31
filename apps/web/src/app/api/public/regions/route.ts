import { NextResponse } from "next/server";
import type { PublicRegion, PublicRegionBoundary } from "@/lib/public-api";
import { supabaseRequest } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level");
  const parentId = searchParams.get("parent_id");
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
