import { connection, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ReportRow = {
  id: string;
  region_id: string | null;
  description: string | null;
  status: "received" | "in_review" | "verified" | "handled" | "rejected";
  verification_score: number | null;
  created_at: string;
};

type RegionRow = {
  id: string;
  parent_id: string | null;
  level: "provinsi" | "kabupaten" | "kecamatan" | "desa";
  name: string;
};

type ReportMediaAiRow = {
  report_id: string;
  detections: unknown;
};

type PipelineRunRow = {
  job_name: string;
  status: "running" | "success" | "partial" | "failed";
  started_at: string;
  error: string | null;
};

const sourceDefinitions = [
  { job: "firms", name: "NASA FIRMS" },
  { job: "radd", name: "RADD" },
  { job: "support_data", name: "Data pendukung" },
  { job: "weekly_risk", name: "Risiko mingguan" },
  { job: "retrain", name: "Pelatihan model" },
] as const;

const demoSources = [
  { job: "firms", status: "success", started_at: "", error: null },
  { job: "radd", status: "success", started_at: "", error: null },
  { job: "support_data", status: "success", started_at: "", error: null },
  { job: "weekly_risk", status: "unknown", started_at: "", error: null },
  { job: "retrain", status: "success", started_at: "", error: null },
] as const;

export async function GET() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Autentikasi diperlukan." },
      { status: 401 },
    );

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin")
    return NextResponse.json(
      { error: "Akses admin diperlukan." },
      { status: 403 },
    );

  const admin = createAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [
    { data: reports, error: reportsError },
    { count: pendingCount, error: pendingError },
    { count: labelCount, error: labelError },
    { count: labelsThisWeek, error: labelsWeekError },
    { data: modelVersion, error: modelError },
  ] = await Promise.all([
    admin
      .from("reports")
      .select("id,region_id,description,status,verification_score,created_at")
      .in("status", ["received", "in_review"])
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["received", "in_review"]),
    admin.from("training_labels").select("id", { count: "exact", head: true }),
    admin
      .from("training_labels")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo),
    admin
      .from("model_versions")
      .select("metrics,version")
      .eq("model_type", "yolo_fire_smoke")
      .eq("status", "active")
      .maybeSingle(),
  ]);
  if (
    reportsError ||
    pendingError ||
    labelError ||
    labelsWeekError ||
    modelError
  )
    return NextResponse.json(
      { error: "Data dashboard admin belum dapat dimuat." },
      { status: 500 },
    );

  const regionRows: RegionRow[] = [];
  let pendingRegionIds = [
    ...new Set(
      (reports ?? [])
        .map((report) => report.region_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  for (let depth = 0; depth < 3 && pendingRegionIds.length; depth += 1) {
    const { data, error } = await admin
      .from("public_regions")
      .select("id,parent_id,level,name")
      .in("id", pendingRegionIds);
    if (error)
      return NextResponse.json(
        { error: "Wilayah laporan belum dapat dimuat." },
        { status: 500 },
      );
    const layer = (data ?? []) as RegionRow[];
    regionRows.push(...layer);
    const knownIds = new Set(regionRows.map((region) => region.id));
    pendingRegionIds = [
      ...new Set(
        layer
          .map((region) => region.parent_id)
          .filter((id): id is string => id !== null && !knownIds.has(id)),
      ),
    ];
  }
  const regionById = new Map(regionRows.map((region) => [region.id, region]));
  const reportIds = (reports ?? []).map((report) => report.id);
  const { data: mediaRows, error: mediaError } = reportIds.length
    ? await admin
        .from("report_media")
        .select("report_id,detections")
        .in("report_id", reportIds)
    : { data: [], error: null };
  if (mediaError)
    return NextResponse.json(
      { error: "Skor Vision laporan belum dapat dimuat." },
      { status: 500 },
    );

  const visionScoreByReport = new Map<
    string,
    { score: number; label: string }
  >();
  for (const media of (mediaRows ?? []) as ReportMediaAiRow[]) {
    if (!media.detections || typeof media.detections !== "object") continue;
    const vision = (media.detections as { vision?: unknown }).vision;
    if (!vision || typeof vision !== "object") continue;
    const summary = vision as {
      labels?: unknown;
      scores?: unknown;
    };
    if (
      !Array.isArray(summary.labels) ||
      !summary.scores ||
      typeof summary.scores !== "object"
    )
      continue;
    const scores = summary.scores as Record<string, unknown>;
    const candidates = summary.labels
      .filter((label): label is string => typeof label === "string")
      .map((label) => ({ label, score: scores[label] }))
      .filter(
        (candidate): candidate is { label: string; score: number } =>
          typeof candidate.score === "number" &&
          Number.isFinite(candidate.score) &&
          candidate.score >= 0 &&
          candidate.score <= 1,
      )
      .sort((left, right) => right.score - left.score);
    const top = candidates[0];
    const previous = visionScoreByReport.get(media.report_id);
    if (top && (!previous || top.score > previous.score))
      visionScoreByReport.set(media.report_id, top);
  }

  const reportData = ((reports ?? []) as ReportRow[]).map((report) => {
    const region = report.region_id
      ? regionById.get(report.region_id)
      : undefined;
    const parent = region?.parent_id
      ? regionById.get(region.parent_id)
      : undefined;
    const district = parent?.parent_id
      ? regionById.get(parent.parent_id)
      : undefined;
    return {
      id: report.id,
      description: report.description,
      status: report.status,
      verification_score: report.verification_score,
      vision_score: visionScoreByReport.get(report.id)?.score ?? null,
      vision_label: visionScoreByReport.get(report.id)?.label ?? null,
      created_at: report.created_at,
      village: region?.name ?? null,
      district: district?.name ?? null,
    };
  });

  const activeMetrics =
    modelVersion?.metrics && typeof modelVersion.metrics === "object"
      ? (modelVersion.metrics as Record<string, unknown>)
      : {};
  const rawFilterPrecision = activeMetrics.filter_precision;
  const actualFilterPrecision =
    typeof rawFilterPrecision === "number" &&
    Number.isFinite(rawFilterPrecision) &&
    rawFilterPrecision >= 0 &&
    rawFilterPrecision <= 1
      ? rawFilterPrecision
      : null;
  const latestRunResults = await Promise.all(
    sourceDefinitions.map((source) =>
      admin
        .from("pipeline_runs")
        .select("job_name,status,started_at,error")
        .eq("job_name", source.job)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  );
  if (latestRunResults.some((result) => result.error))
    return NextResponse.json(
      { error: "Status pipeline belum dapat dimuat." },
      { status: 500 },
    );
  const latestRunByJob = new Map<string, PipelineRunRow>();
  for (const result of latestRunResults) {
    if (result.data) {
      const run = result.data as PipelineRunRow;
      latestRunByJob.set(run.job_name, run);
    }
  }
  const sourceRuns = sourceDefinitions.map((source) => {
    const latest = latestRunByJob.get(source.job);
    if (latest)
      return {
        name: source.name,
        status: latest.status,
        started_at: latest.started_at,
        error: latest.error,
        demo: false,
      };
    const demo = demoSources.find((run) => run.job === source.job);
    return {
      name: source.name,
      status: demo?.status ?? "unknown",
      started_at: null,
      error: null,
      demo: true,
    };
  });

  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const days = Array.from({ length: 7 }, (_, index) => {
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() - (6 - index));
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 1);
    return { start, end };
  });
  const trend = await Promise.all(
    days.map(async ({ start, end }) => {
      const [raw, kept] = await Promise.all([
        admin
          .from("hotspots")
          .select("id", { count: "exact", head: true })
          .gte("acq_at", start.toISOString())
          .lt("acq_at", end.toISOString()),
        admin
          .from("hotspots")
          .select("id", { count: "exact", head: true })
          .eq("filter_status", "kept")
          .gte("acq_at", start.toISOString())
          .lt("acq_at", end.toISOString()),
      ]);
      if (raw.error || kept.error) throw new Error("Hotspot trend unavailable");
      return {
        hari: new Intl.DateTimeFormat("id-ID", {
          weekday: "short",
          timeZone: "UTC",
        }).format(start),
        mentah: raw.count ?? 0,
        tersaring: kept.count ?? 0,
      };
    }),
  ).catch(() => null);

  if (!trend)
    return NextResponse.json(
      { error: "Data tren hotspot belum dapat dimuat." },
      { status: 500 },
    );

  const actualPending = pendingCount ?? 0;
  const actualLabels = labelCount ?? 0;
  const stats = {
    pending: actualPending || 6,
    pendingDemo: actualPending === 0,
    labels: actualLabels || 1284,
    labelsThisWeek: actualLabels === 0 ? 37 : (labelsThisWeek ?? 0),
    labelsDemo: actualLabels === 0,
    filterPrecision: actualFilterPrecision ?? 0.81,
    precisionDemo: actualFilterPrecision === null,
  };
  return NextResponse.json({
    data: { reports: reportData, trend, stats, sources: sourceRuns },
  });
}
