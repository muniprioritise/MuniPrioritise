import random
import time

import pytest
from fastapi.testclient import TestClient

from main import (
    Report,
    Worker,
    app,
    build_ga_toolbox,
    gini,
    simulate_response_times,
)

client = TestClient(app)


def make_report(i, severity=3, lat=-33.92, lng=18.42, created="2026-07-20T10:00:00Z", ward="CPT-001"):
    return {
        "id": f"r{i}",
        "category": "water",
        "severity": severity,
        "created_at": created,
        "lat": lat,
        "lng": lng,
        "ward_id": ward,
    }


def make_problem(n, workers=5, seed=1):
    rnd = random.Random(seed)
    reports = [
        make_report(
            i,
            severity=rnd.randint(1, 5),
            lat=-33.9 + rnd.uniform(-0.1, 0.1),
            lng=18.4 + rnd.uniform(-0.1, 0.1),
            created=f"2026-10-0{1 + i % 7}T{i % 24:02d}:00:00Z",
            ward=f"W{i % 8}",
        )
        for i in range(n)
    ]
    worker_list = [
        {
            "id": f"w{i}",
            "lat": -33.9 + rnd.uniform(-0.1, 0.1),
            "lng": 18.4 + rnd.uniform(-0.1, 0.1),
            "available": True,
        }
        for i in range(workers)
    ]
    return {"reports": reports, "workers": worker_list}


# ---------------------------------------------------------------- health + FCFS

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_fcfs_sorts_by_created_at():
    payload = {
        "reports": [
            {"id": "r3", "category": "water", "severity": 3, "created_at": "2026-07-20T10:00:00Z", "lat": -33.92, "lng": 18.42, "ward_id": "CPT-001"},
            {"id": "r1", "category": "roads", "severity": 5, "created_at": "2026-07-18T08:00:00Z", "lat": -33.93, "lng": 18.41, "ward_id": "CPT-002"},
            {"id": "r5", "category": "refuse", "severity": 2, "created_at": "2026-07-22T14:00:00Z", "lat": -33.91, "lng": 18.40, "ward_id": "CPT-003"},
            {"id": "r2", "category": "electricity", "severity": 4, "created_at": "2026-07-19T09:00:00Z", "lat": -33.94, "lng": 18.43, "ward_id": "CPT-001"},
            {"id": "r4", "category": "sanitation", "severity": 1, "created_at": "2026-07-21T11:00:00Z", "lat": -33.90, "lng": 18.44, "ward_id": "CPT-004"},
        ],
        "workers": [
            {"id": "w1", "lat": -33.925, "lng": 18.42, "available": True},
            {"id": "w2", "lat": -33.90, "lng": 18.44, "available": True},
        ],
    }

    response = client.post("/prioritise/fcfs", json=payload)
    assert response.status_code == 200

    body = response.json()
    assert body["algorithm"] == "fcfs"
    assert body["prioritised_order"] == ["r1", "r2", "r3", "r4", "r5"]
    assert "processing_time_ms" in body["metrics"]
    assert len(body["assignments"]) == 5


def test_fcfs_skips_reports_when_no_worker_available():
    payload = {
        "reports": [make_report(1)],
        "workers": [{"id": "w1", "lat": -33.92, "lng": 18.42, "available": False}],
    }

    response = client.post("/prioritise/fcfs", json=payload)
    body = response.json()
    assert body["prioritised_order"] == ["r1"]
    assert body["assignments"] == []


# ---------------------------------------------------------------------- greedy

def test_greedy_higher_severity_first_when_equally_close():
    # Same location for all reports, so only severity can separate them.
    payload = {
        "reports": [make_report(i, severity=s) for i, s in enumerate([2, 5, 1, 4, 3])],
        "workers": [{"id": "w1", "lat": -33.93, "lng": 18.43, "available": True}],
    }
    body = client.post("/prioritise/greedy", json=payload).json()
    severities = {f"r{i}": s for i, s in enumerate([2, 5, 1, 4, 3])}
    ordered = [severities[r] for r in body["prioritised_order"]]
    assert ordered == sorted(ordered, reverse=True)


def test_greedy_closer_first_when_equal_severity():
    payload = {
        "reports": [
            make_report(0, severity=3, lat=-33.99, lng=18.50),  # far
            make_report(1, severity=3, lat=-33.931, lng=18.431),  # near
            make_report(2, severity=3, lat=-33.95, lng=18.45),  # middle
        ],
        "workers": [{"id": "w1", "lat": -33.93, "lng": 18.43, "available": True}],
    }
    body = client.post("/prioritise/greedy", json=payload).json()
    assert body["prioritised_order"] == ["r1", "r2", "r0"]


def test_greedy_severity_is_not_swamped_by_distance():
    # Regression: the old 1/distance term (in degrees) made severity irrelevant.
    payload = make_problem(60, seed=3)
    body = client.post("/prioritise/greedy", json=payload).json()
    sev = {r["id"]: r["severity"] for r in payload["reports"]}
    ordered = [sev[i] for i in body["prioritised_order"]]
    top, bottom = ordered[:20], ordered[-20:]
    assert sum(top) / 20 > sum(bottom) / 20 + 0.5


def test_greedy_reports_gini_and_response_time():
    body = client.post("/prioritise/greedy", json=make_problem(30)).json()
    m = body["metrics"]
    assert m["gini_coefficient"] is not None and 0 <= m["gini_coefficient"] <= 1
    assert m["avg_response_time_estimate"] is not None and m["avg_response_time_estimate"] > 0


# --------------------------------------------------------------------- genetic

def test_genetic_fitness_depends_on_order():
    # Regression: fitness used to be identical for every permutation, so the
    # GA could not improve anything and returned a random order.
    p = make_problem(30)
    reports = [Report(**r) for r in p["reports"]]
    workers = [Worker(**w) for w in p["workers"]]
    toolbox = build_ga_toolbox(reports, workers)
    values = {round(toolbox.evaluate(toolbox.individual())[0], 6) for _ in range(100)}
    assert len(values) > 50


def test_genetic_fitness_matches_response_time_simulation():
    p = make_problem(25, seed=7)
    reports = [Report(**r) for r in p["reports"]]
    workers = [Worker(**w) for w in p["workers"]]
    toolbox = build_ga_toolbox(reports, workers)

    perm = list(range(len(reports)))
    random.Random(5).shuffle(perm)

    expected = sum(
        r.severity * minutes
        for r, _, minutes in simulate_response_times([reports[i] for i in perm], workers)
    )
    assert toolbox.evaluate(perm)[0] == pytest.approx(expected, rel=0.01)


def test_genetic_returns_every_report_exactly_once():
    payload = {**make_problem(40), "seed": 1}
    body = client.post("/prioritise/genetic", json=payload).json()
    assert sorted(body["prioritised_order"]) == sorted(r["id"] for r in payload["reports"])


def test_genetic_beats_random_ordering():
    p = make_problem(40, seed=11)
    reports = [Report(**r) for r in p["reports"]]
    workers = [Worker(**w) for w in p["workers"]]
    toolbox = build_ga_toolbox(reports, workers)

    rnd = random.Random(0)
    random_fitness = []
    for _ in range(50):
        perm = list(range(len(reports)))
        rnd.shuffle(perm)
        random_fitness.append(toolbox.evaluate(perm)[0])
    random_fitness.sort()
    median_random = random_fitness[len(random_fitness) // 2]

    body = client.post("/prioritise/genetic", json={**p, "seed": 42}).json()
    index = {r.id: i for i, r in enumerate(reports)}
    best = toolbox.evaluate([index[i] for i in body["prioritised_order"]])[0]

    assert best < 0.8 * median_random


def test_genetic_puts_severe_reports_ahead_of_minor_ones():
    # One worker, everything equally close: the best order is simply severity descending.
    severities = [1, 5, 2, 4, 3, 5, 1, 4]
    payload = {
        "reports": [make_report(i, severity=s, lat=-33.92 + i * 1e-5) for i, s in enumerate(severities)],
        "workers": [{"id": "w1", "lat": -33.93, "lng": 18.42, "available": True}],
        "generations": 100,
        "seed": 9,
    }
    body = client.post("/prioritise/genetic", json=payload).json()
    sev = {f"r{i}": s for i, s in enumerate(severities)}
    ordered = [sev[i] for i in body["prioritised_order"]]
    assert sum(ordered[:3]) > sum(ordered[-3:])


def test_genetic_same_seed_same_result():
    payload = {**make_problem(30), "seed": 123}
    a = client.post("/prioritise/genetic", json=payload).json()["prioritised_order"]
    b = client.post("/prioritise/genetic", json=payload).json()["prioritised_order"]
    assert a == b


@pytest.mark.parametrize("n", [0, 1, 2, 3])
def test_genetic_handles_tiny_inputs(n):
    # Regression: a single report used to return a 500.
    payload = {
        "reports": [make_report(i) for i in range(n)],
        "workers": [{"id": "w1", "lat": -33.93, "lng": 18.43, "available": True}],
    }
    response = client.post("/prioritise/genetic", json=payload)
    assert response.status_code == 200
    assert len(response.json()["prioritised_order"]) == n


def test_genetic_with_no_available_worker():
    payload = {
        "reports": [make_report(i, severity=5) for i in range(5)],
        "workers": [{"id": "w1", "lat": -33.93, "lng": 18.43, "available": False}],
    }
    body = client.post("/prioritise/genetic", json=payload).json()
    assert len(body["prioritised_order"]) == 5
    assert body["assignments"] == []


def test_genetic_generations_are_clamped():
    payload = {**make_problem(10), "generations": 10_000_000}
    start = time.perf_counter()
    response = client.post("/prioritise/genetic", json=payload)
    assert response.status_code == 200
    assert time.perf_counter() - start < 10


# --------------------------------------------------------------------- compare

def test_compare_returns_all_three_with_metrics():
    body = client.post("/prioritise/compare", json=make_problem(30)).json()
    assert set(body) == {"fcfs", "greedy", "genetic"}
    for name, result in body.items():
        assert result["algorithm"] == name
        assert result["metrics"]["gini_coefficient"] is not None
        assert result["metrics"]["avg_response_time_estimate"] is not None


def test_compare_with_a_single_report():
    payload = {"reports": [make_report(1)], "workers": [{"id": "w1", "lat": -33.93, "lng": 18.43, "available": True}]}
    assert client.post("/prioritise/compare", json=payload).status_code == 200


# --------------------------------------------------------------------- helpers

def test_gini_basics():
    assert gini([5, 5, 5, 5]) == pytest.approx(0.0)
    assert gini([0, 0, 0, 10]) == pytest.approx(0.75)
    assert gini([]) == 0.0


# ----------------------------------------------------------------------- NFR-02

def test_nfr02_1000_reports_within_5_seconds_for_every_algorithm():
    payload = {**make_problem(1000, workers=10), "seed": 1}
    for name in ("fcfs", "greedy", "genetic"):
        start = time.perf_counter()
        response = client.post(f"/prioritise/{name}", json=payload)
        elapsed = time.perf_counter() - start
        assert response.status_code == 200
        assert elapsed < 5, f"{name} took {elapsed:.2f}s for 1000 reports (NFR-02 limit is 5s)"
