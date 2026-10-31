export async function POST() {
  return Response.json({ ok: false, message: "WhatsApp webhook is not configured yet." }, { status: 501 });
}