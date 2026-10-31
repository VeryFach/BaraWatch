from app.services.vision.fusion import fuse_predictions

def test_fusion_preserves_fire_and_wildfire_smoke():
    result = fuse_predictions(
        [{"class": "fire", "confidence": 0.8}],
        [{"class": "fire-smoke", "confidence": 0.7}],
    )

    assert result["labels"] == ["fire", "wildfire_smoke"]
    assert result["smoke_type"] == "wildfire_smoke"
    assert result["needs_review"] is False

def test_fusion_marks_conflicting_smoke_origins_ambiguous():
    result = fuse_predictions(
        [{"class": "smoke", "confidence": 0.9}],
        [
            {"class": "fire-smoke", "confidence": 0.8},
            {"class": "factory-smoke", "confidence": 0.8},
        ],
    )

    assert result["smoke_type"] == "ambiguous"
    assert result["needs_review"] is True

def test_fusion_does_not_map_sol_to_target_label():
    result = fuse_predictions(
        [],
        [{"class": "sol", "confidence": 0.99}],
    )

    assert result["labels"] == []
    assert result["smoke_type"] == "not_detected"