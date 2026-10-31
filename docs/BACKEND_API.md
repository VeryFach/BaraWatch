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
| GET | `/api/public/hotspots` | Publik | Hotspot FIRMS tersaring dari Supabase |
| GET | `/api/public/incidents` | Publik | Insiden aktif dari Supabase |
| GET | `/api/public/risk` | Publik | Skor risiko terbaru dari Supabase |
| GET | `/api/public/burn-area?incident_id=<uuid>` | Publik | Hasil estimasi dNBR tersimpan |
| GET | `/api/public/regions` | Publik | Data wilayah dari Supabase |
| GET | `/api/public/reports` | Publik | Data laporan tersanitasi dari Supabase |
| POST | `/api/auth/login` | Publik | Membuat sesi Supabase dengan email/password |
| POST | `/api/auth/logout` | Sesi aktif | Mengakhiri sesi Supabase |
| GET | `/api/auth/session` | Publik | Mengambil user dan profil sesi aktif |
| GET | `/api/admin/contacts` | Admin | Daftar warga dan MPA dari nomor WhatsApp |
| POST | `/api/admin/contacts` | Admin | Mendaftarkan/menetapkan nomor warga atau MPA |
| PATCH | `/api/admin/contacts` | Admin | Mengubah nama dan assignment kontak |
| GET | `/api/ops/incidents` | Petugas/Admin | Daftar insiden aktif dalam wilayah kerja |
| PATCH | `/api/ops/incidents` | Petugas/Admin | Memperbarui status operasional dan membuat log |
| POST | `/api/webhooks/whatsapp` | `X-Twilio-Signature` | Webhook inbound Twilio |
| GET | `/api/debug/twilio` | `TWILIO_DEBUG=true` | Tes kredensial Twilio |
| GET | `/api/cron/ingest-hotspots` | `Bearer CRON_SECRET` | FIRMS → DBSCAN → Supabase |
| GET | `/api/cron/fetch-support-data` | Belum diterapkan | Scaffold |
| GET | `/api/cron/weekly-risk` | `Bearer CRON_SECRET` | Hotspot mingguan → AI risk → `risk_scores` |
| POST | `/api/internal/burn-area` | `Bearer CRON_SECRET` | AI dNBR → `burn_area_reports` |
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

### Public data

Endpoint publik membaca view/RPC Supabase yang sudah disanitasi. Peta memanggil
hotspot dan incident secara bersamaan, lalu mengirimkannya ke `FireMap`.

- `GET /api/public/hotspots?limit=200`
- `GET /api/public/incidents?limit=200`
- `GET /api/public/risk`
- `GET /api/public/burn-area?incident_id=<uuid>`

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
menggunakan proyeksi terbatas dari view `public_reports_v`. Endpoint hanya
meminta `id`, `incident_id`, `status`, dan `created_at`; koordinat, deskripsi,
verifikasi, region, dan media tidak dikirim.

Query opsional:

- `status=received|in_review|verified|handled|rejected`
- `limit=1..100`, default `50`
- `region_id` ditolak dengan HTTP 400 karena kolom tersebut tidak tersedia di
  proyeksi publik.

Field privat pada bentuk respons kompatibilitas bernilai `null`, dan `media`
serta `region` kosong/null. View `public_reports` yang berisi koordinat tepat
dan deskripsi tidak digunakan oleh endpoint ini.

```json
{
  "data": [
    {
      "id": "report-uuid",
      "incident_id": null,
      "status": "in_review",
      "created_at": "2026-11-01T10:00:00Z",
      "matched_hotspot_id": null,
      "latitude": null,
      "longitude": null,
      "observed_at": null,
      "description": null,
      "verification_outcome": null,
      "verification_score": null,
      "updated_at": null,
      "media": [],
      "region": null
    }
  ]
}
```

### Auth

`POST /api/auth/login` menerima:

```json
{ "email": "petugas@example.com", "password": "password" }
```

Sesi dikirim melalui cookie HTTP-only yang dikelola Supabase SSR. Frontend
tidak menyimpan token atau role di `sessionStorage`.

`POST /api/auth/logout` menghapus sesi aktif. Route `/admin/*` dilindungi
middleware dan mengarahkan pengguna yang belum login ke `/login`.

### Admin contacts

Kontak WhatsApp tidak memiliki akun login. Admin dapat mendaftarkan nomor
format E.164, nama tampilan, dan wilayah tugas MPA melalui
`/api/admin/contacts`. Role `mpa` wajib memiliki `regionId`; kontak `warga`
tidak dapat menerima assignment MPA.

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
Storage, lalu memanggil AI service untuk JSON dan gambar annotated. Gambar asli
disimpan sebagai satu baris `report_media`, sedangkan hasil annotated disimpan
sebagai baris media kedua dengan `detections.annotated=true`. Keduanya berada
di bucket Storage yang sama pada prefix `reports/<report_id>/`. Laporan berlabel diteruskan ke MPA;
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

### Cron dan operasi internal

`ingest-hotspots` menjalankan FIRMS, policy `annotate_hotspots`, DBSCAN, dan
reconciliation incident. `weekly-risk` mengagregasi tujuh hari hotspot per
desa, memanggil `/v1/risk/score`, dan melakukan upsert idempoten ke
`risk_scores`. Keduanya membutuhkan `Authorization: Bearer <CRON_SECRET>`.

`POST /api/internal/burn-area` memanggil `/v1/burn-area/estimate` dan menyimpan
hasil indikasi ke `burn_area_reports`. Nilai ini bukan bukti hukum final dan
hasil dengan coverage terbatas ditandai `is_uncertain=true`.

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
## Operasi Petugas

### `GET /api/ops/incidents`

Mengambil insiden aktif (`confirmed`, `in_progress`, atau `extinguished`) yang
berada dalam wilayah kerja pengguna. Endpoint ini memerlukan session Supabase
dengan role `petugas` atau `admin`.

### `PATCH /api/ops/incidents`

Memperbarui status operasional insiden secara atomik dan membuat catatan pada
`incident_status_logs`.

```json
{
  "incidentId": "uuid-insiden",
  "status": "in_progress",
  "note": "Tim mulai menuju lokasi."
}
```

Transisi yang diizinkan:

- `confirmed` -> `in_progress` (Diterima -> Ditangani)
- `in_progress` -> `extinguished` (Ditangani -> Selesai)
- `extinguished` -> `closed` (menutup arsip insiden)

Status laporan warga tidak diubah oleh endpoint ini; status tersebut tetap
berada pada alur verifikasi laporan.
