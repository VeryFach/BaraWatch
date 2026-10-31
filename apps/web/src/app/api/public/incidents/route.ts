import { hotspots } from "@/lib/dummy-data";

export function GET() {
  return Response.json({ data: hotspots.filter((hotspot) => hotspot.status !== "bukan-api") });
}