from types import SimpleNamespace

import pytest

from app.services.burn_area.copernicus_client import (
    BurnAreaDataError,
    resolve_raster_href,
    select_assets,
    sorted_scenes,
)


def test_s3_href():
    assert resolve_raster_href("s3://eodata/path/B08.jp2") == "/vsis3/eodata/path/B08.jp2"


def test_other_s3_bucket_rejected():
    with pytest.raises(BurnAreaDataError):
        resolve_raster_href("s3://attacker-bucket/path.jp2")


def test_missing_asset():
    item = SimpleNamespace(id="test", assets={})
    with pytest.raises(BurnAreaDataError):
        select_assets(item)


def test_band_aliases():
    item = SimpleNamespace(
        id="test",
        assets={
            x: SimpleNamespace(href=f"s3://eodata/{x}.jp2")
            for x in ("B08_10m", "B12_20m", "SCL_20m")
        },
    )
    assert set(select_assets(item)) == {"B8", "B12", "SCL"}


def test_cloud_sort():
    def item(name, cloud):
        return SimpleNamespace(id=name, datetime=None, properties={"eo:cloud_cover": cloud})
    result = sorted_scenes([item("b", 80), item("a", 10)], 50, 3)
    assert [x.id for x in result] == ["a"]


def test_cloud_sort_is_deterministic_for_ties():
    def item(name):
        return SimpleNamespace(
            id=name,
            datetime=None,
            properties={"eo:cloud_cover": 10},
        )

    result = sorted_scenes([item("z"), item("a")], 50, 3)
    assert [x.id for x in result] == ["a", "z"]
