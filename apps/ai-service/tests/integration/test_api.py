from io import BytesIO

from PIL import Image


def test_health(client):
    data = response.json()

    assert data["clusters"] == []
    assert data["input_count"] == 0


def test_vision_rejects_missing_api_key(client):
    response = client.post(
        "/v1/vision/detect",
        files={"file": ("image.png", b"not-an-image", "image/png")},
    )

    assert response.status_code == 401


def test_vision_rejects_invalid_image(client):
    response = client.post(
        "/v1/vision/detect",
        headers={"X-API-Key": "v" * 32},
        files={"file": ("image.png", b"not-an-image", "image/png")},
    )

    assert response.status_code == 400


def test_vision_returns_fused_result(client, monkeypatch):
    def fake_predict(image):
        return {
            "device": "cpu",
            "models": {
                "mfranzon": [
                    {"class": "fire", "confidence": 0.8, "bbox": [1, 2, 3, 4]},
                ],
                "touati": [
                    {
                        "class": "fire-smoke",
                        "confidence": 0.7,
                        "bbox": [5, 6, 7, 8],
                    },
                ],
            },
        }

    monkeypatch.setattr("app.api.v1.vision.predict_vision", fake_predict)
    image = BytesIO()
    Image.new("RGB", (2, 2), "white").save(image, format="PNG")
    response = client.post(
        "/v1/vision/detect",
        headers={"X-API-Key": "v" * 32},
        files={"file": ("image.png", image.getvalue(), "image/png")},
    )

    assert response.status_code == 200
    assert response.json()["vision"]["labels"] == ["fire", "wildfire_smoke"]