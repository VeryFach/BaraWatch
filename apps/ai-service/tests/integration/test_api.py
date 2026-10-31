import json
from io import BytesIO

from PIL import Image


def _png_upload(size=(32, 24)):
    image = BytesIO()
    Image.new("RGB", size, "white").save(image, format="PNG")
    return image.getvalue()


def test_health(client):
    response = client.get("/health")

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "ok"
    assert data["version"] == "0.2.0"


def test_internal_endpoint_requires_key(client):
    response = client.get("/v1/ping")

    assert response.status_code == 401


def test_internal_endpoint_rejects_wrong_key(client):
    response = client.get(
        "/v1/ping",
        headers={
            "X-Internal-Key": "wrong"
        },
    )

    assert response.status_code == 401


def test_internal_endpoint_with_key(client):
    response = client.get(
        "/v1/ping",
        headers={
            "X-Internal-Key": "a" * 40
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_openapi_available(client):
    response = client.get("/openapi.json")

    assert response.status_code == 200

    schema = response.json()

    assert "/health" in schema["paths"]
    assert "/v1/ping" in schema["paths"]
    assert "/v1/cluster" in schema["paths"]


def test_cluster_requires_key(client):
    response = client.post(
        "/v1/cluster",
        json={"hotspots": []},
    )

    assert response.status_code == 401


def test_cluster_empty_input(client):
    response = client.post(
        "/v1/cluster",
        headers={
            "X-Internal-Key": "a" * 40
        },
        json={
            "hotspots": [],
            "open_incidents": [],
        },
    )

    assert response.status_code == 200

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


def test_annotated_vision_requires_api_key(client):
    response = client.post(
        "/v1/vision/detect/annotated",
        files={"file": ("image.png", _png_upload(), "image/png")},
    )
    assert response.status_code == 401


def test_annotated_vision_openapi_declares_image_responses(client):
    schema = client.get("/openapi.json").json()
    responses = schema["paths"]["/v1/vision/detect/annotated"]["post"]["responses"]
    assert set(responses["200"]["content"]) == {"image/jpeg", "image/png"}


def test_annotated_vision_rejects_invalid_upload(client):
    response = client.post(
        "/v1/vision/detect/annotated",
        headers={"X-API-Key": "v" * 32},
        files={"file": ("image.webp", b"invalid", "image/webp")},
    )
    assert response.status_code == 415


def test_annotated_vision_returns_original_format_and_infers_once(client, monkeypatch):
    calls = []

    def fake_predict(image):
        calls.append(image.size)
        return {
            "device": "cpu",
            "models": {
                "mfranzon": [
                    {"class": "fire", "confidence": 0.8, "bbox": [2, 3, 18, 20]},
                ],
                "touati": [
                    {"class": "smoke", "confidence": 0.7, "bbox": [10, 8, 28, 22]},
                ],
            },
        }

    monkeypatch.setattr("app.api.v1.vision.predict_vision", fake_predict)
    response = client.post(
        "/v1/vision/detect/annotated",
        headers={"X-API-Key": "v" * 32},
        files={"file": ("image.png", _png_upload(), "image/png")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    with Image.open(BytesIO(response.content)) as output:
        assert output.format == "PNG"
        assert output.size == (32, 24)
        assert output.convert("RGB").getpixel((2, 3)) != (255, 255, 255)
    assert calls == [(32, 24)]


def test_annotated_vision_zero_detections_returns_clean_image(client, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.vision.predict_vision",
        lambda image: {"device": "cpu", "models": {"mfranzon": [], "touati": []}},
    )
    response = client.post(
        "/v1/vision/detect/annotated",
        headers={"X-API-Key": "v" * 32},
        files={"file": ("image.png", _png_upload(), "image/png")},
    )
    with Image.open(BytesIO(response.content)) as output:
        assert output.convert("RGB").getpixel((5, 5)) == (255, 255, 255)


def test_annotated_vision_preserves_jpeg_output(client, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.vision.predict_vision",
        lambda image: {"device": "cpu", "models": {"mfranzon": [], "touati": []}},
    )
    jpeg = BytesIO()
    Image.new("RGB", (32, 24), "white").save(jpeg, format="JPEG")
    save_options = []
    original_save = Image.Image.save

    def capture_save(self, fp, *args, **kwargs):
        if kwargs.get("format") == "JPEG":
            save_options.append(kwargs.copy())
        return original_save(self, fp, *args, **kwargs)

    monkeypatch.setattr(Image.Image, "save", capture_save)
    response = client.post(
        "/v1/vision/detect/annotated",
        headers={"X-API-Key": "v" * 32},
        files={"file": ("image.jpg", jpeg.getvalue(), "image/jpeg")},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    summary = response.headers["x-vision-summary"]
    assert set(json.loads(summary)) == {
        "labels",
        "smoke_type",
        "scores",
        "needs_review",
    }
    with Image.open(BytesIO(response.content)) as output:
        assert output.format == "JPEG"
        assert output.size == (32, 24)
    assert save_options[-1]["quality"] == 95
    assert save_options[-1]["subsampling"] == 0


def test_annotated_vision_optional_view_selects_drawn_model(client, monkeypatch):
    calls = []

    def fake_predict(image):
        calls.append(image.size)
        return {
            "device": "cpu",
            "models": {
                "mfranzon": [{"class": "fire", "confidence": 0.8, "bbox": [2, 3, 18, 20]}],
                "touati": [{"class": "fog", "confidence": 0.7, "bbox": [20, 2, 30, 18]}],
            },
        }

    monkeypatch.setattr("app.api.v1.vision.predict_vision", fake_predict)
    response = client.post(
        "/v1/vision/detect/annotated?view=touati",
        headers={"X-API-Key": "v" * 32},
        files={"file": ("image.png", _png_upload(), "image/png")},
    )

    assert response.status_code == 200
    with Image.open(BytesIO(response.content)) as output:
        output = output.convert("RGB")
        assert output.getpixel((2, 3)) == (255, 255, 255)
        assert output.getpixel((20, 2)) != (255, 255, 255)
    assert calls == [(32, 24)]


def test_vision_json_contract_remains_unchanged(client, monkeypatch):
    expected_models = {
        "mfranzon": [{"class": "fire", "confidence": 0.8, "bbox": [1, 2, 3, 4]}],
        "touati": [],
    }
    monkeypatch.setattr(
        "app.api.v1.vision.predict_vision",
        lambda image: {"device": "cpu", "models": expected_models},
    )
    response = client.post(
        "/v1/vision/detect",
        headers={"X-API-Key": "v" * 32},
        files={"file": ("image.png", _png_upload(), "image/png")},
    )
    assert response.status_code == 200
    assert set(response.json()) == {
        "status", "filename", "device", "image_size", "vision", "model_results"
    }
    assert response.json()["model_results"] == expected_models


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
