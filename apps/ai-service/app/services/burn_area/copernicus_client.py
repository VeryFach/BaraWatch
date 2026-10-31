import hashlib
import os
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx

DEFAULT_STAC = "https://catalogue.dataspace.copernicus.eu/stac"
OFFICIAL_STAC_URLS = {
    DEFAULT_STAC,
    "https://stac.dataspace.copernicus.eu/v1",
    "https://stac.opensearch.dataspace.copernicus.eu/v1",
}
COLLECTION = "sentinel-2-l2a"


class BurnAreaDataError(RuntimeError):
    pass


@dataclass(frozen=True)
class Asset:
    href: str


@dataclass(frozen=True)
class Scene:
    id: str
    properties: dict
    assets: dict[str, Asset]
    datetime: datetime | None


def search_sentinel2(lat: float, lon: float, start: date, end: date, radius_km=2, max_items=40):
    if not (start < end):
        raise ValueError("Invalid date interval")
    from math import cos, radians

    # Bounding box is a discovery approximation; analysis clips in projected metres.
    dy = (radius_km + 1) / 111.0
    dx = dy / max(0.1, abs(cos(radians(lat))))
    bbox = [max(-180, lon - dx), max(-90, lat - dy), min(180, lon + dx), min(90, lat + dy)]
    base = os.getenv("COPERNICUS_STAC_URL", DEFAULT_STAC).rstrip("/")
    if base not in OFFICIAL_STAC_URLS:
        raise ValueError("COPERNICUS_STAC_URL must be an official CDSE catalog")
    body = {"collections": [COLLECTION], "bbox": bbox,
            "datetime": (
                f"{start.isoformat()}T00:00:00Z/"
                f"{end.isoformat()}T23:59:59Z"
            ),
            "limit": min(max_items, 100)}
    with httpx.Client(timeout=35, follow_redirects=False) as client:
        response = client.post(f"{base}/search", json=body)
        response.raise_for_status()
        data = response.json()
    scenes = []
    for feature in data.get("features", [])[:max_items]:
        raw_dt = feature.get("properties", {}).get("datetime")
        dt = datetime.fromisoformat(raw_dt.replace("Z", "+00:00")) if raw_dt else None
        scenes.append(Scene(id=feature["id"], properties=feature.get("properties", {}),
                            assets={name: Asset(href=value["href"])
                                    for name, value in feature.get("assets", {}).items()
                                    if isinstance(value, dict) and "href" in value},
                            datetime=dt))
    return sorted(
        scenes,
        key=lambda scene: (
            float(scene.properties.get("eo:cloud_cover", 101)),
            scene.datetime.isoformat() if scene.datetime else "",
            scene.id,
        ),
    )


def sorted_scenes(items, max_cloud, limit):
    filtered = [item for item in items if item.properties.get("eo:cloud_cover") is None
                or float(item.properties["eo:cloud_cover"]) <= max_cloud]
    return sorted(filtered, key=lambda i: (
        float(i.properties.get("eo:cloud_cover") or 100),
        i.datetime.isoformat() if i.datetime else "",
        i.id,
    ))[:limit]


ALIASES = {
    "B8": ("B08_10m", "B8", "B08", "B08_20m"),
    "B12": ("B12_20m", "B12", "B12_10m"),
    "SCL": ("SCL_20m", "SCL", "SCL_60m"),
}


def select_assets(item):
    found = {}
    for band, choices in ALIASES.items():
        for key in choices:
            if key in item.assets:
                found[band] = item.assets[key].href
                break
        if band not in found:
            raise BurnAreaDataError(
                f"Scene {item.id} missing {band}; "
                f"available: {sorted(item.assets)}"
            )
    return found


def _s3_parts(href):
    parsed = urlparse(href)
    if parsed.scheme != "s3" or parsed.netloc != "eodata":
        raise BurnAreaDataError(f"Unsupported S3 asset location: {parsed.scheme}://{parsed.netloc}")
    key = parsed.path.lstrip("/")
    if not key or ".." in Path(key).parts:
        raise BurnAreaDataError("Invalid S3 asset path")
    return parsed.netloc, key


@contextmanager
def raster_environment():
    """GDAL /vsis3 via CDSE S3 credentials; only reads from the fixed CDSE bucket."""
    import boto3
    import rasterio
    from rasterio.session import AWSSession

    access = os.getenv("CDSE_S3_ACCESS_KEY", "")
    secret = os.getenv("CDSE_S3_SECRET_KEY", "")
    if not access or not secret:
        raise BurnAreaDataError(
            "Set CDSE_S3_ACCESS_KEY and CDSE_S3_SECRET_KEY from CDSE S3 credentials portal"
        )
    session = boto3.Session(
        aws_access_key_id=access,
        aws_secret_access_key=secret,
        region_name="default",
    )
    with rasterio.Env(
        session=AWSSession(session),
        AWS_S3_ENDPOINT="eodata.dataspace.copernicus.eu",
        AWS_HTTPS="YES",
        AWS_VIRTUAL_HOSTING="FALSE",
        AWS_REGION="default",
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
    ):
        yield


def resolve_raster_href(href):
    """Return GDAL path for trusted CDSE S3 asset, never arbitrary remote URL."""
    bucket, key = _s3_parts(href)
    return f"/vsis3/{bucket}/{key}"


def download_raster_asset(href: str) -> Path:
    """Download a trusted CDSE asset once and return its local cache path."""
    import boto3

    bucket, key = _s3_parts(href)
    access = os.getenv("CDSE_S3_ACCESS_KEY", "")
    secret = os.getenv("CDSE_S3_SECRET_KEY", "")
    if not access or not secret:
        raise BurnAreaDataError(
            "Set CDSE_S3_ACCESS_KEY and CDSE_S3_SECRET_KEY from CDSE S3 credentials portal"
        )

    cache_dir = Path(
        os.getenv("BURN_AREA_CACHE_DIR", "/tmp/barawatch-burn-area-cache")
    )
    cache_dir.mkdir(parents=True, exist_ok=True)
    filename = hashlib.sha256(f"{bucket}/{key}".encode()).hexdigest() + ".jp2"
    target = cache_dir / filename
    if target.is_file() and target.stat().st_size > 0:
        return target

    client = boto3.client(
        "s3",
        endpoint_url="https://eodata.dataspace.copernicus.eu",
        aws_access_key_id=access,
        aws_secret_access_key=secret,
        region_name="default",
    )
    with tempfile.NamedTemporaryFile(
        dir=cache_dir,
        prefix=f".{filename}.",
        delete=False,
    ) as temporary:
        temporary_path = Path(temporary.name)
    try:
        client.download_file(bucket, key, str(temporary_path))
        if temporary_path.stat().st_size == 0:
            raise BurnAreaDataError("Downloaded raster asset is empty")
        os.replace(temporary_path, target)
        return target
    finally:
        temporary_path.unlink(missing_ok=True)


def summarize_item(item):
    assets = {}
    for band, href in select_assets(item).items():
        parsed = urlparse(href)
        assets[band] = {"protocol": parsed.scheme, "bucket": parsed.netloc}
    return {"id": item.id,
            "datetime": item.datetime.isoformat() if item.datetime else None,
            "cloud_cover": item.properties.get("eo:cloud_cover"),
            "selected_assets": assets}
