import numpy as np
import numpy.ma as ma
import pytest

from app.services.burn_area.dnbr import nbr_array
from app.services.burn_area.raster_processor import (
    composite_nbr,
    create_grid,
    scene_nbr,
)


def test_utm_grid_circle():
    grid = create_grid(-2.21, 113.92, 1)
    assert grid.width == grid.height
    assert 0 < grid.circle_mask.sum() < grid.width * grid.height


def test_scene_mask_and_dn_offset():
    b8 = ma.array([[6000., 6000.], [6000., 6000.]])
    b12 = ma.array([[3000., 3000.], [3000., 3000.]])
    scl = ma.array([[4, 9], [6, 5]])
    result = scene_nbr(b8, b12, scl, np.ones((2, 2), dtype=bool), offset_dn=-1000)
    assert result[0, 0] == pytest.approx((5000 - 2000) / (5000 + 2000))
    assert np.isnan(result[0, 1])
    assert np.isnan(result[1, 0])
    assert np.isfinite(result[1, 1])


def test_nbr_array_zero_denominator():
    output = nbr_array(np.array([[0.]]), np.array([[0.]]), np.array([[True]]))
    assert np.isnan(output[0, 0])


def test_median_nan():
    first = np.array([[.4, np.nan]], dtype=np.float32)
    second = np.array([[.6, .1]], dtype=np.float32)
    out = composite_nbr([first, second])
    assert out[0, 0] == pytest.approx(.5)
    assert out[0, 1] == pytest.approx(.1)
