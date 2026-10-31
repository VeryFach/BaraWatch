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
    assert.equal(url.pathname, "/rest/v1/public_reports_v");
    assert.equal(
      url.searchParams.get("select"),
      "id,incident_id,status,created_at",
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
        latitude: -2.2,
        longitude: 113.9,
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
    assert.equal(report.latitude, null);
    assert.equal(report.longitude, null);
    assert.deepEqual(report.media, []);

    const regionFiltered = await GET(
      new Request(
        "http://localhost/api/public/reports?region_id=private-region",
      ),
    );
    assert.equal(regionFiltered.status, 400);
    assert.equal(supabaseFetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of envKeys) {
      const previous = previousEnv[key];
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  }
});
