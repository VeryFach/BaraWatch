def maximum_score(detections, label):
    return max(
        (
            float(d["confidence"])
            for d in detections
            if d["class"] == label
        ),
        default=0.0,
    )


def fuse_predictions(mfranzon, touati):
    # Threshold awal untuk eksperimen saja.
    # Harus divalidasi menggunakan gambar berlabel.
    fire_threshold = 0.25
    smoke_threshold = 0.25
    subtype_threshold = 0.25

    fire_score = maximum_score(
        mfranzon, "fire"
    )
    smoke_score = maximum_score(
        mfranzon, "smoke"
    )

    wildfire_score = maximum_score(
        touati, "fire-smoke"
    )
    industrial_score = maximum_score(
        touati, "factory-smoke"
    )
    fog_score = maximum_score(
        touati, "fog"
    )

    labels = []

    if fire_score >= fire_threshold:
        labels.append("fire")

    wildfire_found = (
        wildfire_score >= subtype_threshold
    )
    industrial_found = (
        industrial_score >= subtype_threshold
    )

    if wildfire_found and industrial_found:
        smoke_type = "ambiguous"
    elif wildfire_found:
        smoke_type = "wildfire_smoke"
        labels.append("wildfire_smoke")
    elif industrial_found:
        smoke_type = "industrial_smoke"
        labels.append("industrial_smoke")
    elif smoke_score >= smoke_threshold:
        smoke_type = "smoke_unknown"
    else:
        smoke_type = "not_detected"

    return {
        "labels": labels,
        "smoke_type": smoke_type,
        "scores": {
            "fire": fire_score,
            "smoke_general": smoke_score,
            "wildfire_smoke": wildfire_score,
            "industrial_smoke": industrial_score,
            "fog": fog_score,
        },
        "needs_review": (
            smoke_type in {"ambiguous", "smoke_unknown"}
            or (
                fog_score >= subtype_threshold
                and (
                    fire_score >= fire_threshold
                    or smoke_score >= smoke_threshold
                )
            )
        ),
    }