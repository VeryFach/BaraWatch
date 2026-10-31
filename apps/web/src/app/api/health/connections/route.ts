import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { testTwilioCredentials } from "@/modules/whatsapp/transport/twilio";

type CheckStatus = "ok" | "error" | "not_configured";

type ConnectionCheck = {
  status: CheckStatus;
  latencyMs?: number;
  detail?: string;
};

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function timed<T>(
  check: () => Promise<T>,
): Promise<{ value?: T; latencyMs: number; error?: string }> {
  const started = performance.now();
  try {
    return {
      value: await check(),
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    return {
      latencyMs: Math.round(performance.now() - started),
      error:
        error instanceof Error ? error.message : "Unknown connection error",
    };
  }
}

async function checkSupabase(
  env: ReturnType<typeof getServerEnv>,
): Promise<ConnectionCheck> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { status: "not_configured" };
  }
  const result = await timed(() =>
    fetch(`${env.supabaseUrl}/rest/v1/regions?select=id&limit=1`, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    }),
  );
  if (result.error || !result.value?.ok) {
    return {
      status: "error",
      latencyMs: result.latencyMs,
      detail: result.error ?? `HTTP ${result.value?.status}`,
    };
  }
  return { status: "ok", latencyMs: result.latencyMs };
}

async function checkStorage(
  env: ReturnType<typeof getServerEnv>,
): Promise<ConnectionCheck> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { status: "not_configured" };
  }
  const result = await timed(() =>
    fetch(
      `${env.supabaseUrl}/storage/v1/bucket/${encodeURIComponent(env.storageBucket)}`,
      {
        headers: {
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      },
    ),
  );
  if (result.error || !result.value?.ok) {
    return {
      status: "error",
      latencyMs: result.latencyMs,
      detail: result.error ?? `HTTP ${result.value?.status}`,
    };
  }
  return { status: "ok", latencyMs: result.latencyMs };
}

async function checkTwilio(): Promise<ConnectionCheck> {
  const result = await timed(testTwilioCredentials);
  if (result.error) {
    return {
      status: "error",
      latencyMs: result.latencyMs,
      detail: result.error,
    };
  }
  if (!result.value?.valid) {
    return {
      status: "error",
      latencyMs: result.latencyMs,
      detail: result.value?.error ?? "Twilio credentials are invalid",
    };
  }
  return { status: "ok", latencyMs: result.latencyMs };
}

async function checkAiService(
  env: ReturnType<typeof getServerEnv>,
): Promise<ConnectionCheck> {
  const serviceUrl = env.aiServiceUrl;
  if (!serviceUrl) return { status: "not_configured" };
  const result = await timed(() =>
    fetch(`${serviceUrl.replace(/\/$/, "")}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    }),
  );
  if (result.error || !result.value?.ok) {
    return {
      status: "error",
      latencyMs: result.latencyMs,
      detail: result.error ?? `HTTP ${result.value?.status}`,
    };
  }
  return { status: "ok", latencyMs: result.latencyMs };
}

export async function GET(request: Request) {
  const env = getServerEnv();
  const providedKey = request.headers.get("x-healthcheck-key");
  if (
    !env.healthcheckKey ||
    !providedKey ||
    providedKey !== env.healthcheckKey
  ) {
    return unauthorized();
  }

  const [supabase, storage, twilio, aiService] = await Promise.all([
    checkSupabase(env),
    checkStorage(env),
    checkTwilio(),
    checkAiService(env),
  ]);
  const checks = { supabase, storage, twilio, aiService };
  const values = Object.values(checks);
  const status = values.every((check) => check.status === "ok")
    ? "ok"
    : values.some((check) => check.status === "error")
      ? "degraded"
      : "not_configured";

  return NextResponse.json(
    {
      status,
      checkedAt: new Date().toISOString(),
      checks,
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
