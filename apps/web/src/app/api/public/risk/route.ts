import { NextResponse } from "next/server";
import {
  getRiskRegionIdsInBbox,
  getRiskScoresByRegionIds,
} from "@/modules/risk/repo";

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
        return NextResponse.json(
          { error: "Batas peta tidak valid." },
          { status: 400 },
        );
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
        return NextResponse.json(
          { error: "Batas peta tidak valid." },
          { status: 400 },
        );
      }
      const regions = await getRiskRegionIdsInBbox({
        west,
        south,
        east,
        north,
      });
      ids = regions.filter((region) => region.id).map((region) => region.id);
    }
    if (ids?.length === 0) return NextResponse.json({ data: [] });
    const data = await getRiskScoresByRegionIds(ids);
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: "Data risiko sedang tidak tersedia." },
      { status: 503 },
    );
  }
}
