import { hotspots } from "@/lib/dummy-data";

export function GET() {
  return Response.json({ data: hotspots });
}