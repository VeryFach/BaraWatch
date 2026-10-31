from app.services.firms import parse_firms_csv


def test_csv_with_bom():
    csv_content = (
        "\ufefflatitude,longitude,acq_date,"
        "acq_time,satellite,instrument,confidence,frp\n"
        "-2.2,113.9,2026-10-30,0300,N20,VIIRS,h,12.0\n"
    )

    hotspots = parse_firms_csv(csv_content)

    assert len(hotspots) == 1
    assert hotspots[0].confidence_level == "high"