import assert from "node:assert/strict";
import test from "node:test";

const regionId = "11111111-1111-4111-8111-111111111111";
const contactId = "22222222-2222-4222-8222-222222222222";
const reportId = "33333333-3333-4333-8333-333333333333";
const incidentId = "44444444-4444-4444-8444-444444444444";

test("public report submission stores contact, precise location, and report server-side", async () => {
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
    SUPABASE_SECRET_KEY: "server-only-test-key",
    TWILIO_ACCOUNT_SID: "test-account",
    TWILIO_AUTH_TOKEN: "test-token",
    TWILIO_WHATSAPP_FROM: "whatsapp:+14155550100",
  });
  const requests: { path: string; method: string; body: unknown }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    requests.push({ path: url.pathname, method, body });
    if (url.pathname.endsWith("/rpc/region_for_point")) {
      return Response.json([{ region_id: regionId, region_name: "Desa Uji" }]);
    }
    if (url.pathname.endsWith("/contacts"))
      return Response.json([{ id: contactId }]);
    if (url.pathname.endsWith("/reports")) {
      return Response.json([
        { id: reportId, created_at: "2026-11-01T04:00:00.000Z" },
      ]);
    }
    if (url.pathname.endsWith("/rpc/link_report_to_incident"))
      return Response.json(incidentId);
    throw new Error(`Unexpected Supabase request: ${url.pathname}`);
  };

  try {
    const { POST } = await import("../src/app/api/public/reports/route");
    const body = new FormData();
    body.set("phone", "+6281234567890");
    body.set("region_id", regionId);
    body.set("latitude", "-2.2");
    body.set("longitude", "113.9");
    body.set("type", "Api");
    body.set("description", "Asap terlihat dari kebun.");
    const response = await POST(
      new Request("http://localhost/api/public/reports", {
        method: "POST",
        body,
      }),
    );
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      data: { id: reportId, incident_id: incidentId },
      warnings: [],
    });

    const reportInsert = requests.find(
      (request) =>
        request.path.endsWith("/reports") && request.method === "POST",
    );
    assert.deepEqual(reportInsert?.body, {
      contact_id: contactId,
      region_id: regionId,
      geom: { type: "Point", coordinates: [113.9, -2.2] },
      observed_at: (reportInsert?.body as { observed_at: string }).observed_at,
      description: "Api: Asap terlihat dari kebun.",
      status: "received",
    });
    assert.equal(
      requests.some(
        (request) =>
          JSON.stringify(request.body).includes("+6281234567890") &&
          request.path.endsWith("/reports"),
      ),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of envKeys) {
      const previous = previousEnv[key];
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  }
});

test("public report submission rejects coordinates outside the chosen village", async () => {
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
    SUPABASE_SECRET_KEY: "server-only-test-key",
    TWILIO_ACCOUNT_SID: "test-account",
    TWILIO_AUTH_TOKEN: "test-token",
    TWILIO_WHATSAPP_FROM: "whatsapp:+14155550100",
  });
  let writeAttempted = false;
  globalThis.fetch = async (input) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (url.pathname.endsWith("/rpc/region_for_point")) {
      return Response.json([
        {
          region_id: "55555555-5555-4555-8555-555555555555",
          region_name: "Desa Lain",
        },
      ]);
    }
    writeAttempted = true;
    throw new Error("Writes should not be reached for mismatched location");
  };
  try {
    const { POST } = await import("../src/app/api/public/reports/route");
    const body = new FormData();
    body.set("phone", "+6281234567890");
    body.set("region_id", regionId);
    body.set("latitude", "-2.2");
    body.set("longitude", "113.9");
    body.set("type", "Api");
    const response = await POST(
      new Request("http://localhost/api/public/reports", {
        method: "POST",
        body,
      }),
    );
    assert.equal(response.status, 400);
    assert.equal(writeAttempted, false);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of envKeys) {
      const previous = previousEnv[key];
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  }
});

test("consented web photo runs annotated YOLO once and stores the public annotation", async () => {
  const originalFetch = globalThis.fetch;
  const envKeys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_FROM",
    "WHATSAPP_STORAGE_BUCKET",
    "AI_SERVICE_URL",
    "AI_SERVICE_API_KEY",
  ] as const;
  const previousEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test",
    SUPABASE_SECRET_KEY: "server-only-test-key",
    TWILIO_ACCOUNT_SID: "test-account",
    TWILIO_AUTH_TOKEN: "test-token",
    TWILIO_WHATSAPP_FROM: "whatsapp:+14155550100",
    WHATSAPP_STORAGE_BUCKET: "private-reports",
    AI_SERVICE_URL: "http://ai.test",
    AI_SERVICE_API_KEY: "server-only-vision-key",
  });

  let inferenceCount = 0;
  const storedMedia: Record<string, unknown>[] = [];
  let storageUploads = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (url.hostname === "ai.test") {
      inferenceCount += 1;
      assert.equal(url.pathname, "/v1/vision/detect/annotated");
      assert.equal(url.searchParams.get("view"), "combined");
      assert.equal(
        new Headers(init?.headers).get("x-api-key"),
        "server-only-vision-key",
      );
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
        headers: { "content-type": "image/jpeg" },
      });
    }
    if (url.pathname.endsWith("/rpc/region_for_point")) {
      return Response.json([{ region_id: regionId, region_name: "Desa Uji" }]);
    }
    if (url.pathname.endsWith("/contacts"))
      return Response.json([{ id: contactId }]);
    if (url.pathname.endsWith("/reports")) {
      return Response.json([
        { id: reportId, created_at: "2026-11-01T04:00:00.000Z" },
      ]);
    }
    if (url.pathname.endsWith("/rpc/link_report_to_incident"))
      return Response.json(incidentId);
    if (url.pathname.includes("/storage/v1/object/private-reports/")) {
      storageUploads += 1;
      return new Response(null, { status: 200 });
    }
    if (url.pathname.endsWith("/report_media")) {
      storedMedia.push(
        JSON.parse(String(init?.body)) as Record<string, unknown>,
      );
      return new Response(null, { status: 201 });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  };

  try {
    const { POST } = await import("../src/app/api/public/reports/route");
    const body = new FormData();
    body.set("phone", "+6281234567890");
    body.set("region_id", regionId);
    body.set("latitude", "-2.2");
    body.set("longitude", "113.9");
    body.set("type", "Api");
    body.set("description", "Asap terlihat dari kebun.");
    body.set("public_photo_consent", "true");
    body.set(
      "photo",
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "fire.jpg", {
        type: "image/jpeg",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/public/reports", {
        method: "POST",
        body,
      }),
    );
    assert.equal(response.status, 201);
    assert.equal(inferenceCount, 1);
    assert.equal(storageUploads, 2);
    assert.equal(storedMedia.length, 2);
    assert.equal(
      storedMedia.some(
        (media) =>
          JSON.stringify(media.detections) ===
          JSON.stringify({ annotated: true, public_consent: true }),
      ),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of envKeys) {
      const previous = previousEnv[key];
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  }
});
