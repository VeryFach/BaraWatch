import { NextResponse } from "next/server";
import { supabaseRequest } from "@/lib/supabase/admin";

type CountRow = { acq_at: string; filter_status: string };

export async function GET() {
  try {
    const now = new Date();
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 6);
    const rows = await supabaseRequest<CountRow[]>(
      `hotspots?select=acq_at,filter_status&acq_at=gte.${start.toISOString()}&order=acq_at.asc&limit=10000`,
    );
    const data = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + index);
      const date = day.toISOString().slice(0, 10);
      const dayRows = rows.filter((row) => row.acq_at.startsWith(date));
      return {
        hari: new Intl.DateTimeFormat("id-ID", {
          weekday: "short",
          timeZone: "UTC",
        }).format(day),
        mentah: dayRows.length,
        tersaring: dayRows.filter((row) => row.filter_status === "kept").length,
      };
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: "Data tren belum tersedia." },
      { status: 503 },
    );
  }
}
