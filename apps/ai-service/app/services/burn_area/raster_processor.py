"""Project a small circle ROI onto a fixed 20m UTM grid and read bands with VRT."""

from dataclasses import dataclass
from math import ceil
from time import sleep

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.vrt import WarpedVRT

from app.services.burn_area.copernicus_client import download_raster_asset

SCALE = 20
# SCL: 2 dark-area pixels, 4 vegetation, 5 bare soil.
# Excludes cloud/shadows/water/snow/unclassified; this is intentionally conservative.
CLEAR_SCL = (2, 4, 5)


class RasterReadError(RuntimeError):
    pass


@dataclass(frozen=True)
class Grid:
    crs: str
    transform: object
    width: int
    height: int
    circle_mask: np.ndarray


def create_grid(lat: float, lon: float, radius_km: float) -> Grid:
    if not (-80 <= lat <= 84):
        raise ValueError("This UTM prototype supports -80 <= latitude <= 84")
    zone = min(60, max(1, int((lon + 180) // 6 + 1)))
    epsg = (32600 if lat >= 0 else 32700) + zone
    crs = f"EPSG:{epsg}"
    x, y = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform(lon, lat)
    radius_m = radius_km * 1000
    n = ceil(2 * radius_m / SCALE) + 2
    transform = from_origin(x - n * SCALE / 2, y + n * SCALE / 2, SCALE, SCALE)
    iy, ix = np.indices((n, n), dtype=np.float32)
    cx = transform.c + (ix + 0.5) * SCALE
    cy = transform.f - (iy + 0.5) * SCALE
    mask = (cx - x) ** 2 + (cy - y) ** 2 <= radius_m ** 2
    return Grid(crs, transform, n, n, mask)


def read_band(href: str, grid: Grid, *, categorical: bool) -> np.ma.MaskedArray:
    """Read remote JP2 into ROI grid; GDAL handles S3 HTTP range requests."""
    path = download_raster_asset(href)
    last_error = None
    for attempt in range(3):
        try:
            with rasterio.open(path) as src:
                with WarpedVRT(
                    src,
                    crs=grid.crs,
                    transform=grid.transform,
                    width=grid.width,
                    height=grid.height,
                    resampling=(
                        Resampling.nearest
                        if categorical
                        else Resampling.bilinear
                    ),
                    nodata=0,
                ) as vrt:
                    result = vrt.read(1, masked=True)
                    if result.count() > 0:
                        return result
                    last_error = RuntimeError(
                        f"Raster asset returned no valid pixels: {href}"
                    )
        except rasterio.errors.RasterioIOError as exc:
            last_error = exc
        if attempt < 2:
            sleep(0.5 * (attempt + 1))
    if last_error is not None:
        raise RasterReadError(str(last_error)) from last_error
    raise RuntimeError("Raster read failed") from last_error


def scene_nbr(
    b8: np.ma.MaskedArray,
    b12: np.ma.MaskedArray,
    scl: np.ma.MaskedArray,
    circle_mask: np.ndarray,
    offset_dn: float = -1000,
) -> np.ndarray:
    from app.services.burn_area.dnbr import nbr_array

    nir = np.asarray(b8.filled(0), dtype=np.float32) + offset_dn
    swir = np.asarray(b12.filled(0), dtype=np.float32) + offset_dn
    scl_data = np.asarray(scl.filled(0), dtype=np.int16)
    clear = np.isin(scl_data, CLEAR_SCL)
    valid = (
        circle_mask
        & clear
        & ~np.ma.getmaskarray(b8)
        & ~np.ma.getmaskarray(b12)
        & ~np.ma.getmaskarray(scl)
    )
    valid &= (nir > 0) & (swir > 0)
    # For baseline >=04.00, BOA_ADD_OFFSET is typically -1000 DN;
    # for earlier baselines it is 0. Verify via source product metadata.
    return nbr_array(nir, swir, valid)


def composite_nbr(arrays: list[np.ndarray]) -> np.ndarray:
    if not arrays:
        raise ValueError("No NBR arrays")
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return np.nanmedian(np.stack(arrays, axis=0), axis=0).astype(np.float32)


def write_geotiff(path, grid: Grid, dnbr: np.ndarray):
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(path, "w", driver="GTiff", width=grid.width,
                       height=grid.height, count=1, dtype="float32",
                       crs=grid.crs, transform=grid.transform,
                       nodata=-9999, compress="deflate") as dst:
        dst.write(np.where(np.isfinite(dnbr), dnbr, -9999).astype(np.float32), 1)
