"""Generate database/seed/benchmark_dataset.json (issue P3-03).

Run from the repo root:

    python database/seed/generate_benchmark_dataset.py

The output is fully determined by SEED, so anyone re-running it gets the same
file. That is what makes the benchmark results reproducible.

Everything here is synthetic. See database/seed/README.md.
"""

import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

SEED = 42
N_REPORTS = 500
N_WORKERS = 10
DAYS = 7
START = datetime(2026, 10, 1, 0, 0, 0, tzinfo=timezone.utc)

# Exact category counts (500 requests): water 25%, electricity 25%, roads 20%,
# refuse 20%, sanitation 10%.
CATEGORY_SHARES = {"water": 0.25, "electricity": 0.25, "roads": 0.20, "refuse": 0.20, "sanitation": 0.10}

SEVERITY_MEAN = 3.0
SEVERITY_SD = 1.0  # rounded and clipped to 1-5, so roughly 68% fall on 2-4

# Requests are scattered around a ward centroid with this spread (km).
LOCATION_SPREAD_KM = 2.5
# Workers start near ward centroids, a little more tightly.
WORKER_SPREAD_KM = 1.5

# Same rule as findNearestWardId in backend/index.js.
MAX_WARD_DISTANCE_KM = 25
KM_PER_DEGREE = 111.0

HERE = Path(__file__).resolve().parent


def km_between(lat1, lng1, lat2, lng2):
    dy = (lat1 - lat2) * KM_PER_DEGREE
    dx = (lng1 - lng2) * KM_PER_DEGREE * math.cos(math.radians(lat1))
    return math.hypot(dx, dy)


def nearest_ward(lat, lng, wards):
    best, best_km = None, None
    for w in wards:
        km = km_between(lat, lng, w["lat"], w["lng"])
        if best_km is None or km < best_km:
            best, best_km = w, km
    return best if best_km <= MAX_WARD_DISTANCE_KM else None


def scatter(rng, lat, lng, spread_km):
    """A point normally distributed around (lat, lng) with the given spread in km."""
    dlat = rng.normal(0, spread_km) / KM_PER_DEGREE
    dlng = rng.normal(0, spread_km) / (KM_PER_DEGREE * math.cos(math.radians(lat)))
    return lat + dlat, lng + dlng


def build(seed=SEED):
    rng = np.random.default_rng(seed)
    wards = json.loads((HERE / "wards.json").read_text())["wards"]
    assert len(wards) == 20

    # Categories: exact counts, shuffled.
    categories = []
    for name, share in CATEGORY_SHARES.items():
        categories += [name] * round(N_REPORTS * share)
    assert len(categories) == N_REPORTS
    rng.shuffle(categories)

    # Severity: approximately normal around 3, clipped to 1-5.
    severities = np.clip(np.rint(rng.normal(SEVERITY_MEAN, SEVERITY_SD, N_REPORTS)), 1, 5).astype(int)

    # Time: spread over 7 days, with most requests during waking hours.
    hour_weights = np.array([1, 1, 1, 1, 1, 2, 4, 6, 7, 7, 6, 6, 6, 6, 6, 6, 6, 6, 5, 4, 3, 2, 2, 1], dtype=float)
    hour_weights /= hour_weights.sum()
    days = rng.integers(0, DAYS, N_REPORTS)
    hours = rng.choice(24, N_REPORTS, p=hour_weights)
    minutes = rng.integers(0, 60, N_REPORTS)
    seconds = rng.integers(0, 60, N_REPORTS)

    # Location: pick a ward in proportion to its population, scatter around its
    # centroid, then label the report with the NEAREST ward to that point, which
    # is the rule the live system uses.
    pops = np.array([w["population"] for w in wards], dtype=float)
    origin = rng.choice(len(wards), N_REPORTS, p=pops / pops.sum())

    reports = []
    for i in range(N_REPORTS):
        w = wards[origin[i]]
        lat, lng = scatter(rng, w["lat"], w["lng"], LOCATION_SPREAD_KM)
        ward = nearest_ward(lat, lng, wards)
        created = START + timedelta(days=int(days[i]), hours=int(hours[i]), minutes=int(minutes[i]), seconds=int(seconds[i]))
        reports.append(
            {
                "id": f"r{i + 1:03d}",
                "category": categories[i],
                "severity": int(severities[i]),
                "created_at": created.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "ward_id": ward["id"],
                "equity_weight": ward["sampi_score"],
            }
        )
    reports.sort(key=lambda r: (r["created_at"], r["id"]))
    for i, r in enumerate(reports):
        r["id"] = f"r{i + 1:03d}"  # ids in time order

    # Workers: start near distinct ward centroids across the city.
    picks = rng.choice(len(wards), N_WORKERS, replace=False)
    workers = []
    for i, k in enumerate(picks):
        lat, lng = scatter(rng, wards[k]["lat"], wards[k]["lng"], WORKER_SPREAD_KM)
        workers.append({"id": f"w{i + 1:02d}", "lat": round(lat, 6), "lng": round(lng, 6), "available": True})

    return {
        "_note": "SYNTHETIC benchmark dataset (issue P3-03). Regenerate with database/seed/generate_benchmark_dataset.py.",
        "seed": seed,
        "wards": [
            {k: w[k] for k in ("id", "name", "lat", "lng", "sampi_score", "population")} for w in wards
        ],
        "reports": reports,
        "workers": workers,
    }


def summary(data):
    reports = data["reports"]
    sev = np.array([r["severity"] for r in reports])
    cats = {}
    for r in reports:
        cats[r["category"]] = cats.get(r["category"], 0) + 1
    per_ward = {}
    for r in reports:
        per_ward[r["ward_id"]] = per_ward.get(r["ward_id"], 0) + 1
    return {
        "reports": len(reports),
        "wards": len(data["wards"]),
        "workers": len(data["workers"]),
        "categories": cats,
        "severity_mean": round(float(sev.mean()), 3),
        "severity_counts": {int(s): int((sev == s).sum()) for s in range(1, 6)},
        "wards_with_requests": len(per_ward),
        "requests_per_ward_min_max": (min(per_ward.values()), max(per_ward.values())),
        "first": reports[0]["created_at"],
        "last": reports[-1]["created_at"],
    }


if __name__ == "__main__":
    out = HERE / "benchmark_dataset.json"
    data = build()
    out.write_text(json.dumps(data, indent=1) + "\n")
    print(f"wrote {out}")
    print(json.dumps(summary(data), indent=1))
    sys.exit(0)
