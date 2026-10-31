import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const today = new Date();
  const utcToday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const days = Array.from({ length: 7 }, (_, index) => {
    const start = new Date(utcToday);
    start.setUTCDate(utcToday.getUTCDate() - (6 - index));
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 1);
    return { start, end };
  });

  try {
    const data = await Promise.all(
      days.map(async ({ start, end }) => {
        const startAt = start.toISOString();
        const endAt = end.toISOString();
        const [raw, kept] = await Promise.all([
          admin
            .from("hotspots")
            .select("id", { count: "exact", head: true })
            .gte("acq_at", startAt)
            .lt("acq_at", endAt),
          admin
            .from("hotspots")
            .select("id", { count: "exact", head: true })
            .eq("filter_status", "kept")
            .gte("acq_at", startAt)
            .lt("acq_at", endAt),
        ]);
        if (raw.error || kept.error)
          throw new Error("Hotspot trend query failed");
        return {
          hari: new Intl.DateTimeFormat("id-ID", {
            weekday: "short",
            timeZone: "UTC",
          }).format(start),
          mentah: raw.count ?? 0,
          tersaring: kept.count ?? 0,
        };
      }),
    );
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: "Data tren hotspot sedang tidak tersedia." },
      { status: 503 },
    );
  }
}
