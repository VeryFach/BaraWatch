import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const [
  ,
  ,
  regionId,
  phone,
  imagePath = "examples/fire-examples/WhatsApp Image 2026-10-31 at 10.45.39.jpeg",
] = process.argv;
const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const cronSecret = process.env.CRON_SECRET;

if (!regionId || !phone || !cronSecret) {
  console.error(
    "Usage: $env:CRON_SECRET='...'; node scripts/create-dummy-report.mjs <region-id> <phone> [image-path]",
  );
  process.exit(1);
}

const resolvedImage = path.resolve(imagePath);
const bytes = await readFile(resolvedImage);
const form = new FormData();
form.set("region_id", regionId);
form.set("phone", phone);
form.set("description", "Dummy test: indikasi api dari gambar contoh.");
form.set(
  "photo",
  new Blob([bytes], { type: "image/jpeg" }),
  path.basename(resolvedImage),
);

const response = await fetch(
  `${baseUrl.replace(/\/$/, "")}/api/debug/dummy-report`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${cronSecret}` },
    body: form,
  },
);
const body = await response.text();
console.log(body);
if (!response.ok) process.exit(1);
