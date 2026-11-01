import { supabaseRequest } from "@/lib/supabase/admin";

export function getRiskRegionIdsInBbox(bbox: {
  west: number;
  south: number;
  east: number;
  north: number;
}) {
  return supabaseRequest<{ id: string }[]>(
    "rpc/get_public_regions_in_bbox?select=id",
    { method: "POST", body: JSON.stringify(bbox) },
  );
}

export async function getRiskScoresByRegionIds(ids?: string[] | null) {
  if (ids?.length === 0) return [];
  const select =
    "region_id,region_code,region_name,region_level,week_start,risk_level,score,top_reasons,method";
  type RiskRow = {
    region_id: string;
    region_code: string;
    region_name: string;
    region_level: string;
    week_start: string;
    risk_level: string;
    score: number | null;
    top_reasons: string[];
    method: string;
  };
  if (!ids) return supabaseRequest<RiskRow[]>(`public_risk_v?select=${select}`);

  // Keep UUID filters below URL size limits enforced by upstream proxies.
  const uniqueIds = [...new Set(ids)];
  const groups: string[][] = [];
  for (let offset = 0; offset < uniqueIds.length; offset += 50)
    groups.push(uniqueIds.slice(offset, offset + 50));
  const data: RiskRow[] = [];
  // Bound concurrency so a wide viewport does not flood Supabase.
  for (let offset = 0; offset < groups.length; offset += 4) {
    const results = await Promise.all(
      groups
        .slice(offset, offset + 4)
        .map((group) =>
          supabaseRequest<RiskRow[]>(
            `public_risk_v?select=${select}&region_id=in.(${group.map(encodeURIComponent).join(",")})&order=region_id.asc`,
          ),
        ),
    );
    data.push(...results.flat());
  }
  data.sort((left, right) => left.region_id.localeCompare(right.region_id));
  return data;
}
