import assert from "node:assert/strict";
import test from "node:test";

test("unauthenticated public reports response excludes private report data", async () => {
  const originalFetch = globalThis.fetch;
  const envKeys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_FROM",
  ] as const;
  const previousEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test",
    SUPABASE_SECRET_KEY: "test-service-role-key",
    TWILIO_ACCOUNT_SID: "test-account",
    TWILIO_AUTH_TOKEN: "test-token",
    TWILIO_WHATSAPP_FROM: "whatsapp:+14155550100",
  });

  let supabaseFetchCount = 0;
  globalThis.fetch = async (input, init) => {
    supabaseFetchCount += 1;
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (url.pathname === "/rest/v1/report_media") return Response.json([]);
    if (url.pathname === "/rest/v1/reports")
      return Response.json([{ id: "report-public", region_id: null }]);
    assert.equal(url.pathname, "/rest/v1/public_reports_v");
    assert.equal(
      url.searchParams.get("select"),
      "id,incident_id,status,created_at,approx_geom",
    );
    assert.equal(
      init?.headers && new Headers(init.headers).has("authorization"),
      true,
    );
    return Response.json([
      {
        id: "report-public",
        incident_id: null,
        status: "in_review",
        created_at: "2026-10-31T10:00:00.000Z",
        approx_geom: "0101000020e61000009a99999999795c409a999999999901c0",
        description: "PRIVATE_REPORT_DESCRIPTION",
        storage_path: "reports/private/photo.jpg",
        phone_e164: "+6281234567890",
      },
    ]);
  };

  try {
    const { GET } = await import("../src/app/api/public/reports/route");
    const response = await GET(
      new Request("http://localhost/api/public/reports"),
    );
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.equal(body.includes("PRIVATE_REPORT_DESCRIPTION"), false);
    assert.equal(body.includes("photo.jpg"), false);
    assert.equal(body.includes("+6281234567890"), false);
    const report = (JSON.parse(body) as { data: Record<string, unknown>[] })
      .data[0];
    assert.equal(report.latitude, -2.2);
    assert.equal(report.longitude, 113.9);
    assert.deepEqual(report.media, []);

    const regionFiltered = await GET(
      new Request(
        "http://localhost/api/public/reports?region_id=private-region",
      ),
    );
    assert.equal(regionFiltered.status, 400);
    assert.equal(supabaseFetchCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of envKeys) {
      const previous = previousEnv[key];
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  }
});

test("public reports exposes legacy annotated media while report is pending review", async () => {
  const originalFetch = globalThis.fetch;
  const envKeys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_FROM",
    "WHATSAPP_STORAGE_BUCKET",
  ] as const;
  const previousEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test",
    SUPABASE_SECRET_KEY: "test-service-role-key",
    TWILIO_ACCOUNT_SID: "test-account",
    TWILIO_AUTH_TOKEN: "test-token",
    TWILIO_WHATSAPP_FROM: "whatsapp:+14155550100",
    WHATSAPP_STORAGE_BUCKET: "private-reports",
  });

  globalThis.fetch = async (input) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (url.pathname.endsWith("/public_reports_v")) {
      return Response.json([
        {
          id: "report-verified",
          incident_id: null,
          status: "received",
          created_at: "2026-10-31T10:00:00.000Z",
          approx_geom: { type: "Point", coordinates: [113.9, -2.2] },
        },
      ]);
    }
    if (url.pathname.endsWith("/reports")) {
      return Response.json([
        {
          id: "report-verified",
          region_id: "region-village",
        },
      ]);
    }
    if (url.pathname.endsWith("/public_regions")) {
      return Response.json([
        {
          id: "region-village",
          parent_id: "region-subdistrict",
          level: "desa",
          name: "Desa Api",
        },
        {
          id: "region-subdistrict",
          parent_id: "region-district",
          level: "kecamatan",
          name: "Kecamatan Api",
        },
        {
          id: "region-district",
          parent_id: null,
          level: "kabupaten",
          name: "Kabupaten Api",
        },
      ]);
    }
    if (url.pathname.endsWith("/report_media")) {
      return Response.json([
        {
          report_id: "report-verified",
          storage_path: "reports/report-verified/annotated.jpg",
          media_type: "image",
          detections: { annotated: true },
        },
        {
          report_id: "report-verified",
          storage_path: "reports/report-verified/original.jpg",
          media_type: "image",
          detections: null,
        },
      ]);
    }
    if (url.pathname.includes("/storage/v1/object/sign/")) {
      return Response.json({
        signedURL:
          "/object/sign/private-reports/annotated.jpg?token=short-lived",
      });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  };

  try {
    const { GET } = await import("../src/app/api/public/reports/route");
    const response = await GET(
      new Request("http://localhost/api/public/reports"),
    );
    assert.equal(response.status, 200);
    const report = (
      JSON.parse(await response.text()) as { data: Record<string, unknown>[] }
    ).data[0];
    assert.deepEqual(report.media, [
      {
        url: "http://supabase.test/storage/v1/object/sign/private-reports/annotated.jpg?token=short-lived",
        mediaType: "image",
        annotated: true,
      },
    ]);
    assert.deepEqual(report.region, {
      id: "region-village",
      name: "Desa Api",
      level: "desa",
      parent: {
        id: "region-subdistrict",
        name: "Kecamatan Api",
        level: "kecamatan",
      },
      district: { id: "region-district", name: "Kabupaten Api" },
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of envKeys) {
      const previous = previousEnv[key];
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  }
});
