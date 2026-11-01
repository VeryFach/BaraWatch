import { timingSafeEqual } from "node:crypto";
import { getPipelineEnv } from "@/lib/env";
import { flushOutbox } from "@/modules/whatsapp/transport/outbox";

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  let env: ReturnType<typeof getPipelineEnv>;
  try {
    env = getPipelineEnv();
  } catch {
    return Response.json(
      { error: "Pipeline is not configured" },
      { status: 503 },
    );
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (
    !authorization.startsWith("Bearer ") ||
    !secureEqual(authorization.slice(7), env.cronSecret)
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return Response.json({ ok: true, ...(await flushOutbox()) });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Outbox flush failed",
      },
      { status: 502 },
    );
  }
}
