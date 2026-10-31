export function GET() {
  return Response.json({ ok: true, message: "Outbox is empty." });
}
