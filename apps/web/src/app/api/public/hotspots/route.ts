import { dbFixtures } from "@/lib/dummy-data";

export function GET() {
  return Response.json({ data: dbFixtures.hotspots });
}
