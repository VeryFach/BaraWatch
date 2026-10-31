# BaraWatch Backend API

Dokumentasi endpoint backend di repository BaraWatch.

## Base URL

- Web API: `http://localhost:3000`
- AI service: `http://localhost:8000`

Secret hanya digunakan server-to-server. Jangan kirim `SUPABASE_SECRET_KEY`,
token Twilio, `AI_INTERNAL_KEY`, atau `BARAWATCH_AI_API_KEY` dari browser.

## Daftar endpoint

### Next.js Web API

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api` | Publik | Health sederhana |
| GET | `/api/health/connections` | `X-Healthcheck-Key` | Cek koneksi backend |
| GET | `/api/public/hotspots` | Publik | Scaffold, mengembalikan data kosong |
| GET | `/api/public/incidents` | Publik | Scaffold, mengembalikan data kosong |
| GET | `/api/public/risk` | Publik | Scaffold, mengembalikan data kosong |
| GET | `/api/public/regions` | Publik | Data wilayah dari Supabase |
| GET | `/api/public/reports` | Publik | Data laporan tersanitasi dari Supabase |
| POST | `/api/webhooks/whatsapp` | `X-Twilio-Signature` | Webhook inbound Twilio |
| GET | `/api/debug/twilio` | `TWILIO_DEBUG=true` | Tes kredensial Twilio |
| GET | `/api/cron/ingest-hotspots` | Belum diterapkan | Scaffold |
| GET | `/api/cron/fetch-support-data` | Belum diterapkan | Scaffold |
| GET | `/api/cron/weekly-risk` | Belum diterapkan | Scaffold |
| GET | `/api/cron/flush-outbox` | Belum diterapkan | Scaffold |

### FastAPI AI service

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/health` | Publik | Liveness AI service |
| GET | `/v1/ping` | `X-Internal-Key` | Tes akses internal |
| POST | `/v1/cluster` | `X-Internal-Key` | DBSCAN hotspot |
| POST | `/v1/vision/detect` | `X-API-Key` | Deteksi gambar |
| GET | `/docs` | Publik secara default | Swagger UI |
| GET | `/openapi.json` | Publik secara default | OpenAPI schema |

## Endpoint koneksi

### `GET /api/health/connections`

Endpoint diagnostik internal yang melakukan koneksi nyata ke:

1. Supabase REST API.
2. Supabase Storage bucket.
3. Twilio Account API.
4. AI service `/health`.

Header:

```text
X-Healthcheck-Key: <HEALTHCHECK_KEY>
```

Response sehat:

```json
{
  "status": "ok",
  "checkedAt": "2026-10-31T12:00:00.000Z",
  "checks": {
    "supabase": { "status": "ok", "latencyMs": 42 },
    "storage": { "status": "ok", "latencyMs": 37 },
    "twilio": { "status": "ok", "latencyMs": 181 },
    "aiService": { "status": "ok", "latencyMs": 23 }
  }
}
```

Kemungkinan status:

- `ok`: semua koneksi berhasil, HTTP `200`.
- `degraded`: ada koneksi gagal, HTTP `503`.
- `not_configured`: konfigurasi belum lengkap, HTTP `503`.
- Tanpa header atau key salah: HTTP `401`.

Contoh PowerShell:

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3000/api/health/connections `
  -Headers @{ "X-Healthcheck-Key" = $env:HEALTHCHECK_KEY }
```

Endpoint ini tidak mengembalikan secret.

## Web API

### `GET /api`

Response:

```json
{ "name": "BaraWatch API", "status": "ok" }
```

### Public scaffold

Endpoint berikut saat ini mengembalikan:

```json
{ "data": [] }
```

- `GET /api/public/hotspots`
- `GET /api/public/incidents`
- `GET /api/public/risk`

### `GET /api/public/regions`

Mengambil wilayah dari view `public_regions`, termasuk geometry GeoJSON untuk
lapisan batas peta. Geometry dapat difilter berdasarkan level.

Query opsional:

- `level=desa`
- `parent_id=<uuid>`

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "parent_id": "uuid",
      "level": "desa",
      "code": "6201...",
      "name": "Nama Desa"
    }
  ]
}
```

### `GET /api/public/reports`

Mengambil laporan warga yang sudah disanitasi untuk frontend. Data ini
menggunakan view `public_reports`, yang menghitung `latitude` dan `longitude`
dari kolom PostGIS `geom`; `contact_id` tidak pernah dikirim.

Query opsional:

- `status=received|in_review|verified|handled|rejected`
- `region_id=<uuid>`
- `limit=1..100`, default `50`

Response menyertakan koordinat, status/verifikasi, deskripsi, ringkasan region
desa beserta parent kabupatennya, dan `media` berisi signed URL gambar/video
laporan. URL media berlaku terbatas dan dibuat server-side.

```json
{
  "media": [
    {
      "url": "https://project.supabase.co/storage/v1/object/sign/...",
      "mediaType": "image"
    }
  ]
}
```

### `POST /api/webhooks/whatsapp`

Webhook menerima `application/x-www-form-urlencoded` dari Twilio.

Header wajib:

```text
X-Twilio-Signature: <signature Twilio>
```

Field yang dibaca:

| Field | Keterangan |
|---|---|
| `From` | Nomor pengirim |
| `MessageSid` | ID unik pesan |
| `Body` | Pesan teks |
| `MediaUrl0` | URL media pertama |
| `MediaContentType0` | MIME media |
| `Latitude` | Latitude lokasi |
| `Longitude` | Longitude lokasi |

Response:

- `204`: diproses atau duplikat diabaikan.
- `400`: field wajib tidak ada.
- `401`: signature tidak valid.

Untuk laporan foto, web mengunduh media Twilio, menyimpannya ke Supabase
Storage, lalu memanggil AI service. Laporan berlabel diteruskan ke MPA;
laporan tanpa label masuk status `in_review` untuk evaluasi admin.

Lokasi laporan diproses sebagai point PostGIS. Sistem mencari polygon
`regions` level `desa` dengan `ST_Covers`, lalu mengisi `reports.region_id`.
`ST_Covers` juga menerima titik yang tepat berada di garis boundary. Trigger
database mengulang assignment ini saat `reports.geom` dibuat atau diubah,
sehingga assignment tetap konsisten walaupun report dibuat oleh caller lain.
Jika titik berada di luar semua boundary desa, `region_id` tetap `null`.

Setelah MPA mengirim keputusan verifikasi:

- `reports` diperbarui menjadi `verified` atau `rejected`.
- `assessments` dibuat untuk `incident_id` jika report sudah terhubung ke incident.
- `training_labels` dibuat pada `report_id` dengan label `valid` untuk api nyata
  atau `not_fire` untuk bukan api.
- `escalations` dibuat untuk incident yang diverifikasi sebagai api nyata.

`assessments` dan `escalations` tidak dibuat bila `reports.incident_id` masih
`null`, karena kedua tabel tersebut mensyaratkan incident.

### `GET /api/debug/twilio`

Aktif hanya jika `TWILIO_DEBUG=true`.

- `200`: kredensial valid.
- `404`: debug dinonaktifkan.
- `502`: Twilio tidak dapat diverifikasi.

Auth token tidak pernah dikembalikan.

### Cron scaffold

Endpoint berikut mengembalikan `{ "status": "not_configured" }`:

- `GET /api/cron/ingest-hotspots`
- `GET /api/cron/fetch-support-data`
- `GET /api/cron/weekly-risk`
- `GET /api/cron/flush-outbox`

Sebelum production, endpoint cron harus diberi secret auth dan idempotensi.

## AI service API

### `GET /health`

Health/liveness tanpa inference:

```json
{
  "status": "ok",
  "service": "BaraWatch AI",
  "version": "0.2.0",
  "environment": "development",
  "active_models": {}
}
```

### `GET /v1/ping`

Header:

```text
X-Internal-Key: <AI_INTERNAL_KEY>
```

Response:

```json
{
  "status": "ok",
  "message": "BaraWatch AI internal service running"
}
```

### `POST /v1/cluster`

Header:

```text
X-Internal-Key: <AI_INTERNAL_KEY>
Content-Type: application/json
```

Request ringkas:

```json
{
  "hotspots": [
    {
      "id": "hotspot-1",
      "latitude": -2.2,
      "longitude": 113.9,
      "acq_at": "2026-10-31T10:00:00Z",
      "confidence_level": "high",
      "frp": 12.5
    }
  ],
  "open_incidents": [],
  "eps_km": 1.5,
  "min_samples": 2,
  "max_time_gap_hours": 24,
  "match_radius_km": 1.5,
  "minimum_confidence": "nominal"
}
```

Response utama berisi `clusters`, `noise_hotspot_ids`,
`filtered_hotspot_ids`, `algorithm`, dan `input_count`.

Status error:

- `401`: internal key tidak valid.
- `422`: payload tidak valid.

### `POST /v1/vision/detect`

Header dan form:

```text
X-API-Key: <BARAWATCH_AI_API_KEY>
Content-Type: multipart/form-data
file: <JPEG atau PNG>
```

Batasan file: maksimal 10 MB dan 20.000.000 piksel.

Contoh:

```bash
curl -X POST http://localhost:8000/v1/vision/detect \
  -H "X-API-Key: $BARAWATCH_AI_API_KEY" \
  -F "file=@./image.jpg"
```

Response:

```json
{
  "status": "success",
  "filename": "image.jpg",
  "device": "cpu",
  "vision": {
    "labels": ["industrial_smoke"],
    "smoke_type": "industrial_smoke",
    "scores": {
      "fire": 0,
      "smoke_general": 0.328396,
      "wildfire_smoke": 0,
      "industrial_smoke": 0.813368,
      "fog": 0.174974
    },
    "needs_review": false
  },
  "model_results": {}
}
```

Label aplikasi:

- `fire`
- `smoke_general`
- `wildfire_smoke`
- `industrial_smoke`
- `fog`

Status error:

- `401`: API key tidak valid.
- `413`: file/resolusi terlalu besar.
- `415`: format bukan JPEG/PNG.
- `503`: model belum tersedia atau inference gagal.

## Environment penting

### Web

```text
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SECRET_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
HEALTHCHECK_KEY=
AI_SERVICE_URL=
AI_SERVICE_API_KEY=
WHATSAPP_STORAGE_BUCKET=
```

### AI service

```text
APP_ENV=development
AI_INTERNAL_KEY=
BARAWATCH_AI_API_KEY=
```
