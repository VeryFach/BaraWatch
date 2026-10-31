# Laporan Validasi BaraWatch AI

> **Snapshot historis, bukan hasil validasi terbaru.** Laporan ini merekam pemeriksaan deployment dan versi yang lebih lama. Pemeriksaan dokumentasi pada tanggal yang sama menjalankan 74 test (lihat [Testing](TESTING.md)), dan tidak memverifikasi ulang deployment publik. Versi pada `pyproject.toml` sekarang `0.2.0`; riwayat ketidaksesuaian versi di bawah dipertahankan sebagai catatan lama.

Tanggal: 31 Oktober 2026  
Lokasi service: `apps/ai-service`

## Ringkasan

Service AI berhasil melewati validasi lokal dan pemeriksaan deployment publik.
Seluruh test otomatis lulus, lint tidak menemukan error, kode Python dapat
dikompilasi, dan konfigurasi Docker Compose valid.

## Pekerjaan yang sudah tersedia

- Menyediakan service FastAPI untuk BaraWatch AI.
- Menyediakan endpoint:
  - `GET /health`
  - `GET /v1/ping`
  - `POST /v1/cluster`
  - `POST /v1/vision/detect`
- Menambahkan konfigurasi berbasis environment melalui Pydantic Settings.
- Menambahkan autentikasi internal untuk endpoint sistem dan clustering.
- Menambahkan API key untuk endpoint vision.
- Menambahkan parsing data NASA FIRMS dan clustering hotspot DBSCAN.
- Menambahkan fusion hasil deteksi vision dari beberapa model.
- Menambahkan validasi input gambar dan schema API.
- Menambahkan unit test dan integration test.
- Menambahkan Dockerfile dan Docker Compose untuk deployment CPU.
- Merapikan import dan menghapus import `os` yang tidak digunakan pada script.

## Hasil pengujian

| Pemeriksaan | Hasil |
|---|---|
| `python -m pytest -q` | PASS — 18 test lulus |
| `python -m ruff check .` | PASS |
| `python -m compileall -q app scripts tests` | PASS |
| `docker compose config --quiet` | PASS |
| `GET /health` pada deployment Cloudflare | PASS — HTTP 200 |
| `GET /docs` pada deployment Cloudflare | PASS — HTTP 200 |
| `GET /openapi.json` pada deployment Cloudflare | PASS |

Test suite menghasilkan satu warning deprecation dari kombinasi
`starlette.testclient` dan `httpx`. Warning ini tidak menyebabkan test gagal,
tetapi sebaiknya ditinjau saat upgrade dependency berikutnya.

## Pemeriksaan deployment publik

URL yang diperiksa:

`https://arrested-hoping-davidson-adapter.trycloudflare.com/docs`

Hasil:

- Swagger UI tersedia.
- `/health` mengembalikan status `ok`.
- OpenAPI mendeklarasikan `/health`, `/v1/ping`, `/v1/cluster`, dan
  `/v1/vision/detect`.
- Deployment saat ini berjalan pada `APP_ENV=development`.

## Catatan yang perlu ditindaklanjuti

Terdapat ketidaksesuaian versi:

- Konfigurasi lokal pada `app/core/config.py`: `0.2.0`.
- Versi package pada `pyproject.toml`: `0.1.0`.
- Deployment Cloudflare mengembalikan versi: `0.1.0`.

Artinya deployment publik kemungkinan belum dibangun ulang dari konfigurasi
lokal terbaru, atau sumber versi belum diseragamkan. Sebelum staging atau
production, tentukan satu versi resmi, rebuild/redeploy service, lalu verifikasi
kembali `/health` dan `/openapi.json`.

Selain itu, deployment publik masih menggunakan mode development. Untuk
production, gunakan `APP_ENV=production`, API key yang kuat melalui secret
manager, dan jangan mengekspos key ke client/browser.

## Kesimpulan

Implementasi saat ini layak untuk development dan integrasi awal. Tidak ada
kegagalan pada test otomatis maupun endpoint dasar yang diperiksa. Deployment
production belum dapat dinyatakan final sebelum versi diseragamkan, service
dibangun ulang, dan konfigurasi keamanan production diterapkan.
