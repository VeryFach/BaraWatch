from PIL import Image, ImageDraw, ImageFont

from app.api.v1.vision import (
    _format_detection_label,
    _label_position,
    render_detections,
)


def test_render_draws_multiple_native_model_detections():
    source = Image.new("RGB", (100, 80), "white")
    annotated = render_detections(
        source,
        {
            "mfranzon": [{"class": "fire", "confidence": 0.9, "bbox": [10, 10, 40, 40]}],
            "touati": [{"class": "smoke", "confidence": 0.7, "bbox": [50, 20, 90, 70]}],
        },
    )

    assert annotated.size == source.size
    assert annotated.getpixel((10, 10)) != (255, 255, 255)
    assert annotated.getpixel((50, 20)) != (255, 255, 255)
    assert annotated.getpixel((10, 10)) != annotated.getpixel((50, 20))


def test_render_skips_invalid_boxes_and_clips_valid_coordinates():
    source = Image.new("RGB", (20, 20), "white")
    annotated = render_detections(
        source,
        {
            "mfranzon": [
                {"class": "bad", "confidence": 0.9, "bbox": [float("nan"), 1, 5, 5]},
                {"class": "inverted", "confidence": 0.9, "bbox": [8, 8, 2, 2]},
                {"class": "outside", "confidence": 0.8, "bbox": [-5, -4, 5, 5]},
            ],
        },
    )

    assert annotated.getpixel((0, 0)) != (255, 255, 255)
    assert annotated.getpixel((19, 19)) == (255, 255, 255)


def test_render_zero_detections_leaves_pixels_unchanged():
    source = Image.new("RGB", (20, 20), "white")
    annotated = render_detections(source, {"mfranzon": [], "touati": []})
    assert list(annotated.getdata()) == list(source.getdata())


def test_render_view_defaults_to_combined_and_can_select_each_model():
    source = Image.new("RGB", (240, 160), "white")
    detections = {
        "mfranzon": [{"class": "fire", "confidence": 0.8, "bbox": [10, 20, 80, 100]}],
        "touati": [{"class": "fog", "confidence": 0.4, "bbox": [120, 20, 220, 100]}],
    }

    combined = render_detections(source, detections)
    mfranzon_only = render_detections(source, detections, view="mfranzon")
    touati_only = render_detections(source, detections, view="touati")

    assert combined.getpixel((10, 20)) != (255, 255, 255)
    assert combined.getpixel((120, 20)) != (255, 255, 255)
    assert mfranzon_only.getpixel((10, 20)) != (255, 255, 255)
    assert mfranzon_only.getpixel((120, 20)) == (255, 255, 255)
    assert touati_only.getpixel((10, 20)) == (255, 255, 255)
    assert touati_only.getpixel((120, 20)) != (255, 255, 255)


def test_label_includes_readable_class_and_original_percent_confidence():
    assert _format_detection_label(
        {"class": "fire", "confidence": 0.802365}
    ) == "Fire 80.2%"
    assert _format_detection_label(
        {"class": "fire-smoke", "confidence": 0.753}
    ) == "Fire-Smoke 75.3%"
    assert _format_detection_label(
        {"class": "fog", "confidence": 0.399238}
    ) == "Fog 39.9%"
    assert _format_detection_label(
        {"class": "factory-smoke", "confidence": 0.675}
    ) == "Factory Smoke 67.5%"


def test_rendered_label_text_omits_model_names_and_uses_native_confidences(monkeypatch):
    rendered_text = []
    original_text = ImageDraw.ImageDraw.text

    def capture_text(self, xy, text, *args, **kwargs):
        rendered_text.append(text)
        return original_text(self, xy, text, *args, **kwargs)

    monkeypatch.setattr(ImageDraw.ImageDraw, "text", capture_text)
    render_detections(
        Image.new("RGB", (640, 360), "white"),
        {
            "mfranzon": [
                {"class": "fire", "confidence": 0.802365, "bbox": [30, 40, 200, 240]}
            ],
            "touati": [
                {
                    "class": "factory-smoke",
                    "confidence": 0.675,
                    "bbox": [300, 40, 600, 240],
                }
            ],
        },
    )

    assert rendered_text == ["Fire 80.2%", "Factory Smoke 67.5%"]
    assert all("Mfranzon" not in text and "Touati" not in text for text in rendered_text)


def test_label_near_image_edge_stays_inside_canvas():
    position = _label_position((200, 120), (195, 117), (110, 20), 3)
    x, y = position
    assert x >= 0 and y >= 0
    assert x + 110 + 6 <= 200
    assert y + 20 + 6 <= 120


def test_font_loader_falls_back_to_default_font(monkeypatch):
    from app.api.v1 import vision

    original_load_default = ImageFont.load_default
    calls = []

    def fake_load_default(*, size=None):
        calls.append(size)
        if size is not None:
            raise OSError("scalable bundled font unavailable")
        return original_load_default()

    monkeypatch.setattr(ImageFont, "load_default", fake_load_default)
    image = Image.new("RGB", (240, 160), "white")
    rendered = vision.render_detections(
        image,
        {"mfranzon": [{"class": "fire", "confidence": 0.8, "bbox": [20, 30, 180, 130]}]},
    )

    assert rendered.size == image.size
    assert calls == [12, None]
