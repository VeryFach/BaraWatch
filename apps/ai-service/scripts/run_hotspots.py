import argparse
import json
from pathlib import Path

from app.core.config import get_settings
from app.schemas.clustering import ClusterRequest
from app.services.clustering.dbscan import (
    cluster_hotspots,
)
from app.services.firms import (
    download_firms_csv,
    parse_firms_csv,
)


def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--csv",
        default="data/samples/firms_demo_synthetic.csv",
    )

    parser.add_argument(
        "--fetch",
        action="store_true",
    )

    parser.add_argument(
        "--source",
        default="VIIRS_NOAA20_NRT",
    )

    parser.add_argument(
        "--bbox",
        default="111,-4,116,-0.5",
    )

    parser.add_argument(
        "--days",
        type=int,
        default=1,
    )

    parser.add_argument(
        "--date",
        default=None,
    )

    parser.add_argument(
        "--eps-km",
        type=float,
        default=1.5,
    )

    parser.add_argument(
        "--min-samples",
        type=int,
        default=2,
    )

    parser.add_argument(
        "--out",
        default="outputs/hotspot_clusters.json",
    )

    args = parser.parse_args()

    # Ambil data
    if args.fetch:

        content = download_firms_csv(
            map_key=get_settings().firms_map_key,
            source=args.source,
            bbox=tuple(
                map(float, args.bbox.split(","))
            ),
            days=args.days,
            start_date=args.date,
        )

        raw_path = Path(
            "data/raw/firms_last_download.csv"
        )

        raw_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        raw_path.write_text(
            content,
            encoding="utf-8-sig",
        )

    else:
        content = Path(args.csv).read_text(
            encoding="utf-8-sig"
        )

    # Normalisasi
    hotspots = parse_firms_csv(content)

    # Clustering
    request = ClusterRequest(
        hotspots=hotspots,
        eps_km=args.eps_km,
        min_samples=args.min_samples,
    )

    result = cluster_hotspots(request)

    # Simpan JSON
    output_path = Path(args.out)

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_path.write_text(
        result.model_dump_json(indent=2),
        encoding="utf-8",
    )

    print(json.dumps({
        "input": len(hotspots),
        "clusters": len(result.clusters),
        "noise": len(result.noise_hotspot_ids),
        "filtered": len(result.filtered_hotspot_ids),
        "output": str(output_path),
    }, indent=2))


if __name__ == "__main__":
    main()