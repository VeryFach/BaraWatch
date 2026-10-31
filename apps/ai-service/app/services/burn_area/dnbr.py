from math import isfinite

import numpy as np


def calculate_nbr(nir: float, swir: float) -> float:
    if not all(isfinite(x) and x >= 0 for x in (nir, swir)):
        raise ValueError("Reflectance must be finite and nonnegative")
    if nir + swir == 0:
        raise ValueError("NIR + SWIR cannot be zero")
    return (nir - swir) / (nir + swir)


def calculate_dnbr(pre_nir, pre_swir, post_nir, post_swir):
    return calculate_nbr(pre_nir, pre_swir) - calculate_nbr(post_nir, post_swir)


def square_meters_to_hectares(area_square_meters: float) -> float:
    if not isfinite(area_square_meters) or area_square_meters < 0:
        raise ValueError("Area must be finite and nonnegative")
    return area_square_meters / 10000


def nbr_array(nir: np.ndarray, swir: np.ndarray, mask: np.ndarray) -> np.ndarray:
    nir = np.asarray(nir, dtype=np.float32)
    swir = np.asarray(swir, dtype=np.float32)
    mask = np.asarray(mask, dtype=bool)
    denom = nir + swir
    valid = mask & np.isfinite(nir) & np.isfinite(swir) & (denom > 0)
    result = np.full(nir.shape, np.nan, dtype=np.float32)
    np.divide(nir - swir, denom, out=result, where=valid)
    return result
