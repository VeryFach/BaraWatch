import { NextResponse } from "next/server";
import { pointCoordinates, type PublicIncident } from "@/lib/public-api";
import { supabaseRequest } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface IncidentRow {
  id: string;
  region_id: string | null;
  region_code: string | null;
  region_name: string | null;
  source: PublicIncident["source"];
  status: PublicIncident["status"];
  hotspot_count: number;
  centroid: unknown;
  first_detected_at: string;
  last_detected_at: string;
  closed_at: string | null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawLimit = params.get("limit");
  const rawOffset = params.get("offset");
  const regionId = params.get("region_id");
  const limit = rawLimit === null ? 100 : Number(rawLimit);
  const offset = rawOffset === null ? 0 : Number(rawOffset);

  if (
    !Number.isInteger(limit) || limit < 1 || limit > 200 ||
    !Number.isInteger(offset) || offset < 0 || offset > 10000 ||
    (regionId !== null && !UUID.test(regionId))
  ) {
    return NextResponse.json({ error: "Parameter pencarian tidak valid." }, { status: 400 });
  }

  try {
    const filters = [
      regionId ? `region_id=eq.${encodeURIComponent(regionId)}` : "",
    ].filter(Boolean).join("&");
    const rows = await supabaseRequest<IncidentRow[]>(
      `public_incidents_v?select=id,region_id,region_code,region_name,source,status,hotspot_count,centroid,first_detected_at,last_detected_at,closed_at&order=last_detected_at.desc,id.asc&limit=${limit}&offset=${offset}${filters ? `&${filters}` : ""}`,
    );
    const data: PublicIncident[] = rows.map((row) => {
      const point = pointCoordinates(row.centroid);
      return {
        id: row.id,
        regionId: row.region_id,
        regionCode: row.region_code,
        regionName: row.region_name,
        source: row.source,
        status: row.status,
        hotspotCount: row.hotspot_count,
        latitude: point?.latitude ?? null,
        longitude: point?.longitude ?? null,
        firstDetectedAt: row.first_detected_at,
        lastDetectedAt: row.last_detected_at,
        closedAt: row.closed_at,
      };
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: "Data insiden sedang tidak tersedia." },
      { status: 503 },
    );
  }
}
