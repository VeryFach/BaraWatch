
import logging
import os
from pathlib import Path

import numpy as np

from app.schemas.burn_area import BurnAreaRequest, BurnAreaResponse
from app.services.burn_area.copernicus_client import (
    BurnAreaDataError,
    raster_environment,
    search_sentinel2,
    sorted_scenes,
)
from app.services.burn_area.raster_processor import (
    SCALE,
    RasterReadError,
    composite_nbr,
    create_grid,
    read_band,
    scene_nbr,
    write_geotiff,
)

logger = logging.getLogger("barawatch")


def _load_composite(scenes, grid):
    arrays = []
    scene_ids = []
    for scene in scenes:
        try:
            from app.services.burn_area.copernicus_client import select_assets

            scene_assets = select_assets(scene)
            b8 = read_band(scene_assets["B8"], grid, categorical=False)
            b12 = read_band(scene_assets["B12"], grid, categorical=False)
            scl = read_band(scene_assets["SCL"], grid, categorical=True)
            array = scene_nbr(b8, b12, scl, grid.circle_mask)
            logger.info(
                "burn_area_scene_quality",
                extra={
                    "scene_id": scene.id,
                    "b8_valid_pixels": int(b8.count()),
                    "b12_valid_pixels": int(b12.count()),
                    "scl_valid_pixels": int(scl.count()),
                    "nbr_valid_pixels": int(np.count_nonzero(np.isfinite(array))),
                },
            )
            arrays.append(array)
            scene_ids.append(scene.id)
        except (BurnAreaDataError, RasterReadError) as exc:
            logger.warning(
                "burn_area_scene_unusable",
                extra={"scene_id": scene.id, "reason": str(exc)},
            )
            continue
    if not arrays:
        raise BurnAreaDataError("No readable Sentinel-2 scenes")
    return composite_nbr(arrays), scene_ids


def estimate_burn_area(request: BurnAreaRequest) -> BurnAreaResponse:
    if not (-80 <= request.latitude <= 84):
        raise BurnAreaDataError("Latitude outside UTM supported bounds")
    grid = create_grid(request.latitude, request.longitude, request.radius_km)
    pre_items = search_sentinel2(request.latitude, request.longitude, request.pre_start,
                                 request.pre_end, request.radius_km)
    post_items = search_sentinel2(request.latitude, request.longitude, request.post_start,
                                  request.post_end, request.radius_km)
    pre_scenes = sorted_scenes(pre_items, request.max_cloud_percent, request.max_scenes_per_period)
    post_scenes = sorted_scenes(
        post_items,
        request.max_cloud_percent,
        request.max_scenes_per_period,
    )
    if not pre_scenes or not post_scenes:
        raise BurnAreaDataError("No matching Sentinel-2 L2A scenes in one/both periods")
    logger.info(
        "burn_area_scene_selection",
        extra={
            "pre_scene_ids": [scene.id for scene in pre_scenes],
            "post_scene_ids": [scene.id for scene in post_scenes],
            "max_cloud_percent": request.max_cloud_percent,
            "max_scenes_per_period": request.max_scenes_per_period,
        },
    )
    with raster_environment():
        pre, pre_ids = _load_composite(pre_scenes, grid)
        post, post_ids = _load_composite(post_scenes, grid)
    valid = grid.circle_mask & np.isfinite(pre) & np.isfinite(post)
    pixels_total = int(np.count_nonzero(grid.circle_mask))
    valid_pre_pixels = int(np.count_nonzero(grid.circle_mask & np.isfinite(pre)))
    valid_post_pixels = int(np.count_nonzero(grid.circle_mask & np.isfinite(post)))
    valid_pixels = int(np.count_nonzero(valid))
    logger.info(
        "burn_area_pixel_quality",
        extra={
            "pre_scenes_usable": len(pre_ids),
            "post_scenes_usable": len(post_ids),
            "valid_pre_pixels": valid_pre_pixels,
            "valid_post_pixels": valid_post_pixels,
            "overlapping_valid_pixels": valid_pixels,
        },
    )
    if not valid_pixels:
        raise BurnAreaDataError("No common clear pixels between periods")
    dnbr = np.full(pre.shape, np.nan, dtype=np.float32)
    dnbr[valid] = pre[valid] - post[valid]
    indicated_pixels = int(np.count_nonzero(valid & (dnbr >= request.dnbr_threshold)))
    logger.info(
        "burn_area_result",
        extra={
            "indicated_pixels": indicated_pixels,
            "valid_coverage_percent": round(
                100.0 * valid_pixels / pixels_total,
                2,
            ),
        },
    )
    pixel_ha = (SCALE * SCALE) / 10000.0
    coverage = 100.0 * valid_pixels / pixels_total
    quality = "adequate" if coverage >= 70 else "limited"
    raster_path = None
    if request.save_geotiff:
        outdir = Path(os.getenv("BURN_AREA_OUTPUT_DIR", "outputs/burn_area"))
        # Deterministic fixed basename: no untrusted user path fragments.
        name = (
            f"dnbr_{request.latitude:.4f}_{request.longitude:.4f}_"
            f"{request.pre_start}_{request.post_start}.tif"
        )
        target = outdir / name
        write_geotiff(target, grid, dnbr)
        raster_path = str(target)
    limitations = [
        "Spectral-change indication only; not verified burned area",
        "Scene cloud metadata differs from local cloud conditions",
        "Cloud/shadow/water/unclassified pixels masked; remaining pixels can still be contaminated",
        "20-m UTM grid pixel-area approximation, local UTM distortion and border sampling",
        "Cloud and acquisition-date changes may affect pre/post comparison",
        "Experimental dNBR threshold; validate against reference burn polygons",
        "Sentinel-2 L2A BOA offset inferred from processing baseline; verify source metadata",
    ]
    if quality == "limited":
        limitations.append("Less than 70% common valid-pixel coverage")
    return BurnAreaResponse(
        indicated_area_ha=round(indicated_pixels * pixel_ha, 4),
        valid_area_ha=round(valid_pixels * pixel_ha, 4),
        analysis_area_ha=round(pixels_total * pixel_ha, 4),
        valid_coverage_percent=round(coverage, 2),
        pre_image_count=len(pre_ids),
        post_image_count=len(post_ids),
        pre_scene_ids=pre_ids, post_scene_ids=post_ids,
        dnbr_threshold=request.dnbr_threshold,
        quality=quality, raster_path=raster_path, limitations=limitations,
    )
