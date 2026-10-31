import { desaList } from "@/lib/dummy-data";

export function GET() {
  return Response.json({ data: desaList });
}