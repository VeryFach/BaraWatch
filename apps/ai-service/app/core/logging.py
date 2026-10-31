import json
import logging
import sys
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):

    def format(self, record):
        payload = {
            "timestamp": datetime.fromtimestamp(
                record.created,
                tz=timezone.utc,
            ).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        fields = [
            "request_id",
            "method",
            "path",
            "status_code",
            "duration_ms",
            "scene_id",
            "reason",
            "b8_valid_pixels",
            "b12_valid_pixels",
            "scl_valid_pixels",
            "nbr_valid_pixels",
            "pre_scene_ids",
            "post_scene_ids",
            "max_cloud_percent",
            "max_scenes_per_period",
            "pre_scenes_usable",
            "post_scenes_usable",
            "valid_pre_pixels",
            "valid_post_pixels",
            "overlapping_valid_pixels",
            "indicated_pixels",
            "valid_coverage_percent",
        ]

        for field in fields:
            if hasattr(record, field):
                payload[field] = getattr(record, field)

        if record.exc_info:
            payload["exception"] = self.formatException(
                record.exc_info
            )

        return json.dumps(payload, ensure_ascii=False)


def setup_logging(level: str = "INFO"):

    logger = logging.getLogger("barawatch")
    logger.setLevel(level)
    logger.propagate = False
    logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    logger.addHandler(handler)