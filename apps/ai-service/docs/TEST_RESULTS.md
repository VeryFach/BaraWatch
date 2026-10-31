# Test results

> **Historical snapshot.** The 18-test result and Docker build/smoke results below belong to an earlier audit environment. The current documentation-time test run is 74 passed; see [Testing](TESTING.md). Docker was unavailable in the latest audit. Historical results are retained and are not current verification.

Environment: macOS host, repository virtualenv, Python 3.11. The commands below
were executed during this audit.

| Command | Result |
|---|---|
| `.venv/bin/python -m compileall -q app` | PASS |
| `.venv/bin/python -c "from app.main import app; ..."` | PASS; four routes registered |
| `.venv/bin/python -m pytest -q` | PASS; 18 tests |
| `.venv/bin/python -m ruff check ...` (changed files) | PASS after import cleanup |
| `docker --version` | PASS; Docker available |
| `docker compose version` | PASS; Compose available |
| `docker compose config` | PASS |
| `docker compose build` | PASS; image rebuilt successfully with CPU PyTorch wheels |
| `docker compose up -d` + `curl -f http://localhost:8000/health` | PASS after adding `python-multipart`; initial run exposed that missing dependency |

The tests cover health and internal authentication, clustering regression,
FIRMS parsing, fusion edge cases, invalid image rejection, vision
authentication, and a mocked valid vision response. They do not download
checkpoints or call NASA.

Real-model native/container inference remains pending until the deployment
environment provisions the model checkpoints. Container health and CPU runtime
were verified without loading model weights.
