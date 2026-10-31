import json
import logging

from app.core.logging import JsonFormatter


def test_log_is_json():
    record = logging.LogRecord("barawatch", logging.INFO, __file__, 1, "hello", (), None)
    result = json.loads(JsonFormatter().format(record))
    assert result["message"] == "hello"
    assert result["level"] == "INFO"
    assert "timestamp" in result
