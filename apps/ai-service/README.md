# BaraWatch AI — Tahap 0 (Foundation)

Standalone FastAPI. Belum ada model, data FIRMS, DBSCAN, YOLO, atau Earth Engine pada tahap ini.

## Persyaratan
- Windows 10/11, PowerShell
- Python 3.11 atau 3.12 direkomendasikan; pyproject mendukung Python 3.11–3.13
- Koneksi internet saat pemasangan package

## Setup Windows (PowerShell)
Buka terminal pada folder yang berisi `pyproject.toml`.

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
Copy-Item .env.example .env
```

Perintah di atas tidak memerlukan aktivasi environment. Jika `py -3.11` tidak tersedia, cek `py -0p` lalu instal Python 3.11/3.12. Untuk Python 3.12, gunakan `py -3.12 -m venv .venv`.

Jalankan API:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Buka `http://127.0.0.1:8000/docs` atau `http://127.0.0.1:8000/health`.

## Tes di terminal PowerShell lain

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/health
Invoke-RestMethod -Uri http://127.0.0.1:8000/v1/ping
.\.venv\Scripts\python.exe -m pytest -v
.\.venv\Scripts\python.exe -m ruff check .
```

Pada development `.env` dengan `AI_INTERNAL_KEY=` kosong, `/v1/ping` boleh diakses lokal tanpa key. **Jangan expose development API ke jaringan publik.**

Untuk menguji keamanan, isi `.env` dengan kunci acak yang kuat, restart server, lalu:

```powershell
$headers = @{ 'X-Internal-Key' = 'ISI_NILAI_DARI_ENV' }
Invoke-RestMethod -Uri http://127.0.0.1:8000/v1/ping -Headers $headers
```

Di staging/production, `APP_ENV=production` dan `AI_INTERNAL_KEY` minimal 32 karakter wajib. Kirim key hanya dari backend server, bukan browser. Jangan commit kredensial ke Git.

## API tahap 0
| Method | Path | Fungsi | Auth |
|---|---|---|---|
| GET | `/health` | Liveness, versi, daftar model aktif (masih kosong) | publik |
| GET | `/v1/ping` | Contoh endpoint internal | X-Internal-Key saat diatur |
| GET | `/docs` | Swagger (sebaiknya dibatasi pada produksi) | publik di scaffold |

Health bukan pemeriksaan kesiapan model/layanan eksternal. Tambahkan readiness check terpisah saat integrasi model/GEE.

## Rancangan folder
- `app/api/` route handler (tipis)
- `app/services/` implementasi algoritma (ditambahkan tahap berikutnya)
- `app/schemas/` kontrak Pydantic
- `app/core/` konfigurasi, keamanan, logging
- `tests/unit` dan `tests/integration` pengujian
- `data/` input lokal (tidak dikomit), `models/weights/` bobot (tidak dikomit), `outputs/` keluaran lokal (tidak dikomit)
- `experiments/` eksperimen modular

## Docker (opsional)

```powershell
docker build -t barawatch-ai:stage0 .
docker run --rm -p 8000:8000 -e APP_ENV=production -e AI_INTERNAL_KEY=ISI_KUNCI_RANDOM_MINIMAL_32_KARAKTER barawatch-ai:stage0
```

Saat menjalankan Docker, gunakan key kuat dari environment/secrets manager. Perintah di atas sekadar format contoh.

## Tahap selanjutnya
1. NASA FIRMS ingestion (CSV/JSON sampel).
2. DBSCAN Haversine dan spatial filtering Python.
3. API `/v1/cluster` + evaluasi, baru setelah itu YOLO, matching, dan Earth Engine.

Tidak ada koneksi Supabase: sesuai arsitektur, Next.js nanti satu-satunya penulis database.
