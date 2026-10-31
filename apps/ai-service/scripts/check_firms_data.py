import csv
from collections import Counter
from pathlib import Path

CSV_PATH = Path("data/raw/firms_last_download.csv")


def main():
    if not CSV_PATH.is_file():
        raise FileNotFoundError(
            f"FIRMS CSV tidak ditemukan: {CSV_PATH}"
        )

    with CSV_PATH.open(
        encoding="utf-8-sig",
        newline=""
    ) as f:
        reader = csv.DictReader(f)
        columns = reader.fieldnames or []
        rows = list(reader)

    print("=" * 55)
    print("BARAWATCH - NASA FIRMS DATA AUDIT")
    print("=" * 55)

    print("File:", CSV_PATH)
    print("Rows:", len(rows))
    print("Columns:", columns)

    required = {
        "latitude",
        "longitude",
        "acq_date",
        "acq_time",
    }

    missing = required - set(columns)

    if missing:
        print("FAIL: Missing columns:", sorted(missing))
        return 1

    if not rows:
        print(
            "EMPTY DATA: CSV hanya berisi header. "
            "Periksa fetch NASA FIRMS."
        )
        return 2

    valid = 0
    invalid = 0
    dates = Counter()

    for row in rows:
        try:
            lat = float(row["latitude"])
            lon = float(row["longitude"])

            if not (-90 <= lat <= 90):
                raise ValueError("Invalid latitude")

            if not (-180 <= lon <= 180):
                raise ValueError("Invalid longitude")

            if not row["acq_date"] or not row["acq_time"]:
                raise ValueError("Missing acquisition time")

            valid += 1
            dates[row["acq_date"]] += 1

        except (ValueError, TypeError):
            invalid += 1

    print("Valid coordinates/time:", valid)
    print("Invalid records:", invalid)
    print("Acquisition dates:")

    for date, count in sorted(dates.items()):
        print(f"  {date}: {count}")

    print("AUDIT COMPLETE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
