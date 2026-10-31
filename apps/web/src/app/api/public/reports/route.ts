import { NextResponse } from "next/server";
import type { PublicRegion, PublicReport } from "@/lib/public-api";
import {
  createSupabaseStorageSignedUrl,
  supabaseRequest,
} from "@/lib/supabase/admin";

type ReportRow = Omit<PublicReport, "region" | "media"> & {
  region_id: string | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const regionId = searchParams.get("region_id");
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? 50) || 50, 1),
    100,
  );
  const filters = [
    status ? `status=eq.${encodeURIComponent(status)}` : "",
    regionId ? `region_id=eq.${encodeURIComponent(regionId)}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const reports = await supabaseRequest<ReportRow[]>(
    `public_reports?select=id,incident_id,matched_hotspot_id,latitude,longitude,observed_at,description,status,verification_outcome,verification_score,created_at,updated_at,region_id&order=created_at.desc&limit=${limit}${filters ? `&${filters}` : ""}`,
  );
  const reportIds = reports.map((report) => report.id);
  const media = reportIds.length
    ? await supabaseRequest<
        {
          report_id: string;
          storage_path: string;
          media_type: "image" | "video";
        }[]
      >(
        `report_media?select=report_id,storage_path,media_type&report_id=in.(${reportIds.join(",")})&order=created_at.asc`,
      )
    : [];
  const mediaByReport = new Map<string, PublicReport["media"]>();
  for (const item of media) {
    const reportMedia = mediaByReport.get(item.report_id) ?? [];
    reportMedia.push({
      url: await createSupabaseStorageSignedUrl(item.storage_path),
      mediaType: item.media_type,
    });
    mediaByReport.set(item.report_id, reportMedia);
  }
  const regions = await supabaseRequest<PublicRegion[]>(
    "regions?select=id,parent_id,level,code,name&limit=10000",
  );
  const byId = new Map(regions.map((region) => [region.id, region]));
  const data: PublicReport[] = reports.map(({ region_id, ...report }) => {
    const region = region_id ? byId.get(region_id) : undefined;
    const parent = region?.parent_id ? byId.get(region.parent_id) : undefined;
    return {
      ...report,
      media: mediaByReport.get(report.id) ?? [],
      region: region
        ? {
            id: region.id,
            name: region.name,
            level: region.level,
            parent: parent ? { id: parent.id, name: parent.name } : null,
          }
        : null,
    };
  });
  return NextResponse.json({ data });
}
