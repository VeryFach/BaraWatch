# AGENT.md — BaraWatch

Acuan untuk agen AI dan kontributor yang bekerja di repo ini. Baca seluruhnya sebelum mengubah kode. Terakhir diperbarui: 30 Oktober 2026.

## 1. Proyek ini apa

BaraWatch adalah sistem peringatan dini kebakaran hutan dan lahan (karhutla), dengan wilayah pilot Kalimantan Tengah. Sistem menarik titik panas satelit, mengelompokkannya menjadi insiden, memberi tahu warga dan Masyarakat Peduli Api (MPA) lewat WhatsApp, lalu memverifikasi lewat penilaian manusia. Data pendukung (cuaca, RADD, citra Sentinel) dipakai untuk skor risiko dan telaah pasca-kejadian.

Sumber kebenaran, urut dari yang paling mengikat:

1. `supabase/migrations/` — skema database yang berlaku.
2. Dokumen "BaraWatch — ERD & Struktur Project" (https://claude.ai/artifact/MnvugdXRR3rFLW8HdBnfnF) — rancangan ERD, struktur, dan kontrak API.
3. Proposal Inception (kebutuhan fungsional BW-F-1 s.d. BW-F-28) di `docs/`.

Jika ketiganya bertentangan, ikuti nomor yang lebih kecil, lalu laporkan ketidaksesuaiannya. Jangan menebak.

## 2. Stack dan pembagian tugas

| Komponen | Teknologi | Tugas |
| --- | --- | --- |
| `apps/web` | Next.js (App Router, TypeScript) | UI publik dan dashboard, Route Handlers, webhook WhatsApp, orkestrasi pipeline. Satu-satunya penulis ke database |
| `apps/ai-service` | FastAPI (Python) | DBSCAN, YOLO, pencocokan spasial-temporal, skor risiko, nanti dNBR, RADD, RAG. Stateless |
| Supabase | PostgreSQL + PostGIS, Auth, Storage | Data, login dashboard, foto bukti |
| Twilio | WhatsApp (lewat adapter) | Pesan masuk dan keluar |
| GitHub Actions | `schedule` | Memanggil `/api/cron/*` |
| Earth Engine | dipanggil dari FastAPI | Komposit citra, dNBR, vektorisasi RADD. Hanya hasil kecil yang dikembalikan |

## 3. Aturan keras (jangan dilanggar)

### Arsitektur dan keamanan

- Hanya Next.js yang menulis ke database. FastAPI tidak punya koneksi database. Pengecualian baru di fase 3 (pelatihan ulang): Next.js mengekspor label ke Storage, FastAPI membacanya dari sana.
- FastAPI hanya dipanggil dari server Next.js dengan header `X-Internal-Key`. Jangan pernah memanggilnya dari browser.
- Endpoint `api/cron/*` wajib memeriksa `CRON_SECRET` dan harus idempotent (aman dipanggil dua kali).
- Service role key hanya dipakai di `lib/supabase/admin.ts` dan hanya di kode server (cron, webhook). Dashboard memakai klien sesi pengguna sehingga RLS berlaku.
- Setiap tabel baru wajib punya kebijakan RLS pada migrasi yang sama.
- Role `anon` tidak boleh membaca `contacts`, `reports`, `report_media`, `assessments`, `wa_messages`, `concessions`. Data publik lewat `app/api/public/*` atau view tersanitasi (`public_incidents_v`, `public_reports_v`).
- Nomor telepon hanya ada di `contacts.phone_e164`. Tabel lain memakai `contacts.id` sebagai pseudonim. Jangan menampilkan atau mencatat nomor di log, UI publik, maupun respons API.
- Jangan commit secret. Gunakan `.env.example` untuk nama variabel saja.

### WhatsApp

- Hanya `modules/whatsapp/twilio.ts` yang boleh mengimpor SDK Twilio. Semua kode lain memakai antarmuka `WhatsAppProvider` (`sendTemplate`, `sendText`, `sendMedia`, `parseInbound`, `verifyWebhook`).
- Webhook wajib memverifikasi `X-Twilio-Signature` dan idempotent lewat `wa_messages.provider_sid`.
- Pesan yang kita mulai (alert, update, ringkasan risiko) memakai template yang disetujui. Teks bebas hanya boleh bila `contacts.last_inbound_at` masih dalam 24 jam.
- `wa_messages` adalah log sekaligus outbox. Setiap notifikasi punya `dedupe_key` (insiden + kontak + jenis + versi) agar perkembangan insiden yang sama dikirim sebagai update, bukan alert baru.
- Hormati `opted_out_at`. Jangan mengirim ke kontak yang sudah berhenti.
- Tombol "Api nyata / Bukan" harus punya cadangan balasan teks "1" atau "2".
- Media masuk diunduh lalu disimpan ke Supabase Storage. Jangan bergantung pada URL Twilio.

### Insiden dan data

- Status insiden hanya satu kolom `incidents.status`. Perubahannya lewat `modules/incidents/state-machine.ts`, selalu menulis `incident_status_logs`, dan memakai `incidents.version` untuk optimistic locking.
- Konflik penilaian ditandai `needs_review`, bukan status baru.
- `assessments` bersifat append-only: jangan `UPDATE` atau `DELETE`. Penilaian terbaru ditandai `is_current`.
- Hotspot yang tersaring tetap disimpan dengan `filter_status`. Dedupe lewat unique `(geom, acq_at, satellite, instrument)`.
- DBSCAN hanya memakai hotspot (koordinat dan waktu). Alert RADD bukan masukan DBSCAN.
- Semua waktu di database `timestamptz` UTC. FIRMS memberi `acq_date` dan `acq_time` dalam UTC. Tampilkan ke pengguna dalam WIB (UTC+7).
- Geometri disimpan EPSG:4326. Untuk jarak dan luas dalam meter, cast ke `geography`, jangan hitung langsung dalam derajat.
- Operasi spasial dilakukan di PostGIS secara set-based (fungsi Postgres/RPC per batch), bukan per baris dari kode aplikasi.
- Akses data konsesi dan akses yang ditolak dicatat di `audit_logs`.

### Bahasa dan klaim di UI

- Keluaran AI adalah indikator, bukan keputusan. Tampilkan skor bersama alasan utamanya.
- Level risiko "rendah" tidak sama dengan "aman". Jangan memakai kata "aman".
- RADD ditulis "indikasi kehilangan tutupan pohon", bukan "pembukaan lahan ilegal".
- Luas area terbakar adalah estimasi. Tampilkan `is_uncertain` dan tanggal citra. Telaah untuk penegak hukum wajib memuat disclaimer "bukan bukti hukum final".
- Jangan mengaktifkan versi model baru secara otomatis. Aktivasi hanya setelah persetujuan admin dan tercatat di `model_versions`.

## 4. Struktur repo

```text
barawatch/
├─ apps/
│  ├─ web/                 # Next.js
│  │  └─ src/
│  │     ├─ app/           # (public), (auth), (dashboard), api/{webhooks,cron,public}
│  │     ├─ modules/       # logika domain, satu folder per fitur (repo.ts, service.ts, schemas.ts)
│  │     ├─ lib/           # supabase/{server,browser,admin}.ts, ai-client.ts, auth/rbac.ts, env.ts
│  │     └─ components/
│  └─ ai-service/          # FastAPI
│     └─ app/              # api/v1/, core/, schemas/, services/{clustering,vision,matching,risk,...}
├─ packages/ai-contract/   # openapi.json dari FastAPI -> tipe TypeScript
├─ scripts/geo-etl/        # unduh, bersihkan, muat layer spasial statis
├─ supabase/               # migrations/, seed/, config.toml
├─ .github/workflows/      # cron-ingest, ci-web, ci-ai, deploy-ai
└─ docs/
```

Aturan penempatan kode:

- Route handler tipis: validasi input, panggil service di `modules/`, kembalikan respons.
- Query database hanya di `repo.ts` tiap modul. Komponen UI tidak mengimpor `repo`.
- Skema Pydantic di `ai-service/app/schemas/` adalah kontrak API. Setelah mengubahnya, regenerasi `packages/ai-contract` dan perbarui `lib/ai-client.ts`.

## 5. Kontrak FastAPI

| Endpoint | Fase | Fungsi |
| --- | --- | --- |
| `GET /health` | MVP | Status dan versi model aktif |
| `POST /v1/cluster` | MVP | DBSCAN haversine; menerima hotspot lolos filter, insiden terbuka, `eps_km`, `min_samples` |
| `POST /v1/vision/detect` | F2 | YOLO pada foto atau video |
| `POST /v1/matching/score` | F2 | Skor verifikasi laporan vs hotspot kandidat |
| `POST /v1/risk/score` | F2 | Skor risiko mingguan per desa |
| `POST /v1/radd/vectorize` | F2 | Ubah raster RADD menjadi poligon |
| `POST /v1/burn-area/dnbr` | F3 | Luas area terbakar (dNBR) |
| `POST /v1/chat/answer` | F3 | Jawaban chatbot dengan sitasi |
| `POST /v1/models/train`, `/activate` | F3 | Pelatihan dan aktivasi model |

Jika FastAPI tidak tersedia: hotspot tetap disimpan, klasterisasi ditunda, `pipeline_runs` dicatat gagal dan admin diberi tahu. Laporan warga masuk sebagai `uncertain` ke antrean admin. Jangan mengirim alert dari data yang belum diklasterkan.

## 6. Database dan migrasi

- Perubahan skema hanya lewat file di `supabase/migrations/`. Jangan mengubah database langsung.
- Ekstensi: `postgis`, `pg_trgm`, `ltree`, `vector` (fase 3).
- Primary key `uuid`. Enum memakai `text` + `CHECK`. Setiap kolom `geom` punya index GiST.
- Hierarki wilayah satu tabel `regions` (`parent_id`, `path` ltree). Pelanggan kecamatan ikut menerima alert desa di bawahnya.
- Layer statis (batas wilayah, gambut, zona non-karhutla) dimuat lewat `scripts/geo-etl/` ke schema `staging`, divalidasi, lalu dipindah ke tabel final. Catat sumber, versi, dan lisensi tiap layer.
- Tabel inti: `regions`, `hotspots`, `incidents`, `incident_status_logs`, `contacts`, `subscriptions`, `wa_messages`, `assessments`, `reports`, `report_media`, `escalations`, `risk_scores`, `burn_area_reports`, `radd_alerts`, `pipeline_runs`, `system_settings`, `model_versions`, `profiles`, `audit_logs`. Daftar lengkap ada di dokumen ERD.

## 7. Cakupan fase

Kerjakan hanya fase yang diminta. Jangan membangun fase berikutnya "sekalian".

- MVP: tarik FIRMS, penyaringan, DBSCAN, peta publik dan daftar kejadian, langganan wilayah, alert WhatsApp, penilaian MPA, halaman admin untuk pipeline dan parameter.
- F2 (Pengembangan Lanjutan): laporan warga + YOLO, pencocokan, dashboard petugas, eskalasi, skor risiko mingguan, RADD.
- F3 (Jangka Panjang): area terbakar (dNBR), telaah penegak hukum, chatbot RAG, XGBoost, pelatihan ulang model.
- Di luar rencana: perkiraan arah sebar api (BW-F-13-03).

## 8. Environment variable

```text
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
FIRMS_MAP_KEY
AI_SERVICE_URL, AI_INTERNAL_KEY
CRON_SECRET
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
```

Tambahkan variabel baru ke `.env.example` dan `lib/env.ts` (validasi) pada perubahan yang sama.

## 9. Perintah

Konvensi awal. Sesuaikan jika hasil scaffold berbeda.

```text
# web (apps/web)
pnpm dev | pnpm lint | pnpm typecheck | pnpm test

# ai-service (apps/ai-service)
uvicorn app.main:app --reload | ruff check . | pytest

# database
supabase start | supabase migration new <nama> | supabase db reset
```

Sebelum menyatakan pekerjaan selesai: lint, typecheck, dan test lulus; migrasi baru berjalan bersih lewat `supabase db reset`; logika spasial punya test dengan fixture koordinat kecil yang hasilnya bisa diperiksa manual.

## 10. Keputusan yang belum final (tanyakan, jangan diasumsikan)

1. Onboarding MPA dan perangkat desa: siapa yang mendaftarkan dan memverifikasi nomor mereka. Asumsi sementara: admin menambah kontak (`contacts.role = 'mpa'`, `assigned_region_id` terisi).
2. Pemilik akun WhatsApp Business/Meta untuk produksi. Sampai itu jelas, gunakan Twilio Sandbox.
3. Tim atau regu pemadam (`response_teams`, `incident_assignments`): fase lanjutan atau cukup status teks.
4. Hosting FastAPI dan interval tarik FIRMS (usulan awal 30 menit, ubah lewat `system_settings`).
5. Sumber peta konsesi dan tutupan lahan, serta ketersediaan batas wilayah level desa untuk Kalimantan Tengah.
6. Rumus skor prioritas insiden dan ambang dNBR untuk gambut tropis (perlu kalibrasi lokal).

## 11. Cara bekerja

- Ubah sekecil mungkin dan satu hal per perubahan. Jelaskan alasan, bukan hanya apa yang berubah.
- Jika permintaan bertentangan dengan Bagian 3, berhenti dan sampaikan konfliknya.
- Jika ada keraguan tentang kebutuhan, rujuk kode BW-F terkait lalu tanyakan.
- Jangan menambah dependensi besar tanpa alasan tertulis. Terutama di Next.js, ukuran dan waktu build mempengaruhi deploy.
