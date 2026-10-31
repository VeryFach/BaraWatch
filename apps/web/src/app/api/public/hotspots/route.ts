import { NextResponse } from "next/server";
import {
  publicHotspotFromRow,
  type PublicHotspotRow,
} from "@/lib/public-api";
import { supabaseRequest } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function numericParam(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null) return null;
  if (!raw.trim()) return Number.NaN;
  return Number(raw);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitude = numericParam(params, "latitude");
  const longitude = numericParam(params, "longitude");
  const radius = numericParam(params, "radius_m");
  const limit = numericParam(params, "limit") ?? 100;
  const offset = numericParam(params, "offset") ?? 0;
  const regionId = params.get("region_id");

  if (
    (latitude !== null && !Number.isFinite(latitude)) ||
    (longitude !== null && !Number.isFinite(longitude)) ||
    (radius !== null && !Number.isInteger(radius)) ||
    !Number.isInteger(limit) ||
    !Number.isInteger(offset)
  ) {
    return NextResponse.json({ error: "Parameter pencarian tidak valid." }, { status: 400 });
  }
  if (
    (latitude === null) !== (longitude === null) ||
    (latitude === null) !== (radius === null) ||
    (latitude !== null && (latitude < -90 || latitude > 90)) ||
    (longitude !== null && (longitude < -180 || longitude > 180)) ||
    (radius !== null && (radius < 1 || radius > 100000)) ||
    limit < 1 || limit > 200 ||
    offset < 0 || offset > 10000 ||
    (regionId !== null && !UUID.test(regionId))
  ) {
    return NextResponse.json({ error: "Parameter pencarian di luar batas." }, { status: 400 });
  }

  try {
    const rows = await supabaseRequest<PublicHotspotRow[]>("rpc/get_public_hotspots", {
      method: "POST",
      body: JSON.stringify({
        p_lat: latitude,
        p_lon: longitude,
        p_radius_m: radius,
        p_region_id: regionId,
        p_limit: limit,
        p_offset: offset,
      }),
    });
    return NextResponse.json({ data: rows.map(publicHotspotFromRow) });
  } catch {
    return NextResponse.json(
      { error: "Data hotspot sedang tidak tersedia." },
      { status: 503 },
    );
  }
}
