import { NextResponse } from "next/server";
import type { PublicRegionBoundary } from "@/lib/public-api";
import { supabaseRequest } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level");
  const parentId = searchParams.get("parent_id");
  const filters = [
    level ? `level=eq.${encodeURIComponent(level)}` : "",
    parentId ? `parent_id=eq.${encodeURIComponent(parentId)}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const regions = await supabaseRequest<PublicRegionBoundary[]>(
    `public_regions?select=id,parent_id,level,code,name,geometry&order=code.asc${filters ? `&${filters}` : ""}`,
  );
  return NextResponse.json({ data: regions });
}
