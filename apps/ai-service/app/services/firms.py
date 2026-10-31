import csv
import hashlib
import io
from datetime import datetime, timezone

import httpx

from app.schemas.clustering import Hotspot

API_ROOT = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
MAX_FIRMS_RESPONSE_BYTES = 20 * 1024 * 1024

ALLOWED_SOURCES = {
    "VIIRS_NOAA20_NRT",
    "VIIRS_NOAA21_NRT",
    "VIIRS_SNPP_NRT",
    "MODIS_NRT",
}


def parse_firms_csv(content: str) -> list[Hotspot]:
    hotspots = []

    content = content.lstrip("\ufeff")

    reader = csv.DictReader(io.StringIO(content))
    
    required_columns = {
    "latitude",
    "longitude",
    "acq_date",
    "acq_time",
    }

    actual_columns = set(reader.fieldnames or [])

    missing = required_columns - actual_columns

    if missing:
        raise ValueError(
            f"Missing FIRMS CSV columns: {sorted(missing)}"
        )

    for line_number, row in enumerate(reader, start=2):

        if not row:
            continue

        if not row.get("latitude"):
            continue

        if not row.get("acq_date"):
            continue

        try:
            latitude = float(row["latitude"])
            longitude = float(row["longitude"])

            acq_date = row["acq_date"]
            acq_time = str(
                row.get("acq_time", "")
            ).strip().zfill(4)

            acquired_at = datetime.strptime(
                acq_date + acq_time,
                "%Y-%m-%d%H%M",
            ).replace(tzinfo=timezone.utc)

            instrument = str(
                row.get("instrument", "")
            ).upper()

            raw_confidence = str(
                row.get("confidence", "")
            ).strip().lower()

            # VIIRS: l = low, n = nominal, h = high
            if instrument == "VIIRS":
                confidence_level = {
                    "l": "low",
                    "n": "nominal",
                    "h": "high",
                }.get(raw_confidence, "unknown")

            # MODIS: confidence numerik 0-100
            elif instrument == "MODIS":
                confidence_value = float(raw_confidence)

                if confidence_value >= 80:
                    confidence_level = "high"
                elif confidence_value >= 30:
                    confidence_level = "nominal"
                else:
                    confidence_level = "low"

            else:
                confidence_level = "unknown"

            frp_raw = row.get("frp")
            frp = float(frp_raw) if frp_raw else None

            satellite = row.get("satellite", "")

            # ID konsisten untuk data identik
            unique_key = "|".join([
                str(latitude),
                str(longitude),
                acquired_at.isoformat(),
                satellite,
                instrument,
            ])

            hotspot_id = (
                "firms-"
                + hashlib.sha256(
                    unique_key.encode()
                ).hexdigest()[:20]
            )

            hotspot = Hotspot(
                id=hotspot_id,
                latitude=latitude,
                longitude=longitude,
                acq_at=acquired_at,
                satellite=satellite,
                instrument=instrument,
                confidence_raw=raw_confidence,
                confidence_level=confidence_level,
                frp=frp,
            )

            hotspots.append(hotspot)

        except (ValueError, KeyError) as exc:
            raise ValueError(
                f"Invalid FIRMS row {line_number}: {exc}"
            ) from exc

    return hotspots


def download_firms_csv(
    map_key: str,
    source: str,
    bbox: tuple[float, float, float, float],
    days: int = 1,
    start_date: str | None = None,
) -> str:

    if not map_key:
        raise ValueError("FIRMS_MAP_KEY is missing")

    if source not in ALLOWED_SOURCES:
        raise ValueError("Unsupported FIRMS source")

    if not 1 <= days <= 5:
        raise ValueError("Days must be between 1 and 5")

    west, south, east, north = bbox

    if not (
        -180 <= west < east <= 180
        and -90 <= south < north <= 90
    ):
        raise ValueError("Invalid bounding box")

    coordinates = ",".join(str(value) for value in bbox)

    url = (
        f"{API_ROOT}/{map_key}/{source}"
        f"/{coordinates}/{days}"
    )

    if start_date:
        datetime.strptime(start_date, "%Y-%m-%d")
        url += f"/{start_date}"

    chunks = bytearray()
    with httpx.Client(timeout=40, follow_redirects=False) as client:
        with client.stream("GET", url) as response:
            response.raise_for_status()
            for chunk in response.iter_bytes():
                chunks.extend(chunk)
                if len(chunks) > MAX_FIRMS_RESPONSE_BYTES:
                    raise ValueError("FIRMS response exceeds the 20 MiB limit")

    content = chunks.decode("utf-8-sig")
    if "<html" in content.lower()[:300]:
        raise ValueError("FIRMS did not return a CSV response")

    return content
