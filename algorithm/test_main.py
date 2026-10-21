import random
import time

import pytest
from fastapi.testclient import TestClient

from main import (
    CONFIG_HISTORY_LIMIT,
    Report,
    Worker,
    app,
    build_ga_toolbox,
    gini,
    high_severity_rate,
    low_income_coverage,
    reset_config,
    simulate_response_times,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_config():
    # The live alpha is module state, so reset it around every test.
    reset_config()
    yield
    reset_config()


def make_report(i, severity=3, lat=-33.92, lng=18.42, created="2026-07-20T10:00:00Z", ward="CPT-001", equity=None):
    report = {
        "id": f"r{i}",
        "category": "water",
        "severity": severity,
        "created_at": created,
        "lat": lat,
        "lng": lng,
        "ward_id": ward,
    }
    if equity is not None:
        report["equity_weight"] = equity
    return report


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


# health + FCFS
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


# greedy
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
    # Severity must still matter when distances differ a lot.
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


# genetic
def test_genetic_fitness_depends_on_order():
    # The fitness must depend on the order, otherwise the search cannot improve.
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
    # One worker and equal distances: the best order is severity descending.
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
    # A single report must not fail.
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


# hybrid
ONE_WORKER = [{"id": "w1", "lat": -33.93, "lng": 18.43, "available": True}]


def hybrid(reports, alpha=None, workers=None):
    payload = {"reports": reports, "workers": workers or ONE_WORKER}
    if alpha is not None:
        payload["alpha"] = alpha
    return client.post("/prioritise/hybrid", json=payload)


def test_hybrid_default_alpha_is_0_4():
    body = hybrid([make_report(1, equity=0.5)]).json()
    assert body["algorithm"] == "hybrid"
    assert body["alpha_used"] == pytest.approx(0.4)


def test_hybrid_alpha_zero_ignores_equity():
    # Same place and time, so severity is the only efficiency difference.
    reports = [
        make_report(1, severity=5, equity=0.1),
        make_report(2, severity=2, equity=0.9),
    ]
    assert hybrid(reports, alpha=0.0).json()["prioritised_order"] == ["r1", "r2"]


def test_hybrid_alpha_one_orders_by_equity_only():
    reports = [
        make_report(1, severity=5, equity=0.1),
        make_report(2, severity=1, equity=0.9),
        make_report(3, severity=3, equity=0.5),
    ]
    assert hybrid(reports, alpha=1.0).json()["prioritised_order"] == ["r2", "r3", "r1"]


def test_hybrid_equity_breaks_a_tie_at_default_alpha():
    reports = [make_report(1, equity=0.12), make_report(2, equity=0.78)]
    assert hybrid(reports).json()["prioritised_order"] == ["r2", "r1"]


def test_hybrid_final_score_matches_formula():
    reports = [
        make_report(1, severity=4, equity=0.6, created="2026-10-01T08:00:00Z"),
        make_report(2, severity=2, equity=0.2, created="2026-10-03T08:00:00Z", lat=-33.95),
    ]
    body = hybrid(reports, alpha=0.3).json()
    for a in body["assignments"]:
        expected = 0.7 * a["efficiency_score"] + 0.3 * a["equity_score"]
        assert a["score"] == pytest.approx(expected, abs=1e-5)


def test_hybrid_scores_stay_between_0_and_1():
    payload = {**make_problem(80, seed=4), "alpha": 0.4}
    for r in payload["reports"]:
        r["equity_weight"] = 0.5
    body = client.post("/prioritise/hybrid", json=payload).json()
    for a in body["assignments"]:
        assert 0 <= a["efficiency_score"] <= 1
        assert 0 <= a["equity_score"] <= 1
        assert 0 <= a["score"] <= 1


def test_hybrid_older_report_first_when_otherwise_equal():
    reports = [
        make_report(1, created="2026-10-05T08:00:00Z"),
        make_report(2, created="2026-10-01T08:00:00Z"),
    ]
    assert hybrid(reports, alpha=0.0).json()["prioritised_order"] == ["r2", "r1"]


def test_hybrid_waiting_is_not_stretched_across_a_short_batch():
    # The waiting term uses a fixed horizon, so reports five minutes apart
    # must not look like the oldest against the newest.
    reports = [
        make_report(1, created="2026-10-05T08:00:00Z"),
        make_report(2, created="2026-10-05T08:05:00Z"),
    ]
    a, b = hybrid(reports, alpha=0.0).json()["assignments"]
    assert abs(a["efficiency_score"] - b["efficiency_score"]) < 0.001


def test_hybrid_missing_equity_weight_scores_zero_and_is_counted():
    reports = [make_report(1, equity=0.8), make_report(2), make_report(3)]
    body = hybrid(reports).json()
    by_id = {a["report_id"]: a for a in body["assignments"]}
    assert by_id["r2"]["equity_score"] == 0.0
    assert by_id["r3"]["equity_score"] == 0.0
    assert by_id["r1"]["equity_score"] == pytest.approx(0.8)
    assert body["metrics"]["equity_missing_count"] == 2


@pytest.mark.parametrize("alpha", [-0.1, 1.5])
def test_hybrid_rejects_alpha_outside_0_to_1(alpha):
    assert hybrid([make_report(1)], alpha=alpha).status_code == 422


def test_hybrid_rejects_a_bad_timestamp():
    assert hybrid([make_report(1, created="not-a-date")]).status_code == 422


def test_hybrid_accepts_millisecond_timestamps_from_the_backend():
    # Node sends timestamps like 2026-10-13T10:00:00.000Z.
    reports = [make_report(1, created="2026-10-13T10:00:00.000Z")]
    assert hybrid(reports).status_code == 200


def test_hybrid_is_deterministic():
    payload = {**make_problem(60, seed=8), "alpha": 0.4}
    a = client.post("/prioritise/hybrid", json=payload).json()["prioritised_order"]
    b = client.post("/prioritise/hybrid", json=payload).json()["prioritised_order"]
    assert a == b


@pytest.mark.parametrize("n", [0, 1, 2])
def test_hybrid_handles_tiny_inputs(n):
    response = hybrid([make_report(i) for i in range(n)])
    assert response.status_code == 200
    assert len(response.json()["prioritised_order"]) == n


def test_hybrid_with_no_available_worker():
    workers = [{"id": "w1", "lat": -33.93, "lng": 18.43, "available": False}]
    body = hybrid([make_report(i, severity=5) for i in range(3)], workers=workers).json()
    assert len(body["prioritised_order"]) == 3
    assert body["assignments"] == []


def test_hybrid_reports_gini_and_response_time():
    m = client.post("/prioritise/hybrid", json=make_problem(30)).json()["metrics"]
    assert m["gini_coefficient"] is not None and 0 <= m["gini_coefficient"] <= 1
    assert m["avg_response_time_estimate"] is not None and m["avg_response_time_estimate"] > 0


# config
def test_config_get_returns_defaults():
    body = client.get("/prioritise/config").json()
    assert body["alpha"] == pytest.approx(0.4)
    assert body["default_alpha"] == pytest.approx(0.4)
    assert body["efficiency_weights"] == {"severity": 0.4, "waiting": 0.3, "proximity": 0.3}
    assert body["wait_horizon_hours"] == 168.0
    assert body["history"] == []


def test_config_patch_changes_alpha_and_hybrid_uses_it():
    response = client.patch("/prioritise/config", json={"alpha": 0.7})
    assert response.status_code == 200
    assert response.json()["alpha"] == pytest.approx(0.7)
    assert client.get("/prioritise/config").json()["alpha"] == pytest.approx(0.7)
    assert hybrid([make_report(1)]).json()["alpha_used"] == pytest.approx(0.7)


def test_request_alpha_overrides_the_config():
    client.patch("/prioritise/config", json={"alpha": 0.7})
    assert hybrid([make_report(1)], alpha=0.2).json()["alpha_used"] == pytest.approx(0.2)


def test_config_accepts_the_boundaries():
    for value in (0.0, 1.0):
        assert client.patch("/prioritise/config", json={"alpha": value}).status_code == 200


@pytest.mark.parametrize("bad", [-0.1, 1.5, "high", None])
def test_config_rejects_bad_alpha_and_leaves_it_unchanged(bad):
    response = client.patch("/prioritise/config", json={"alpha": bad})
    assert response.status_code == 422
    assert client.get("/prioritise/config").json()["alpha"] == pytest.approx(0.4)


def test_config_patch_without_alpha_is_rejected():
    assert client.patch("/prioritise/config", json={}).status_code == 422


def test_config_change_is_logged_with_timestamp_and_author():
    client.patch("/prioritise/config", json={"alpha": 0.6, "changed_by": "supervisor-1"})
    client.patch("/prioritise/config", json={"alpha": 0.3})
    history = client.get("/prioritise/config").json()["history"]
    assert len(history) == 2
    assert history[0]["old_alpha"] == pytest.approx(0.4)
    assert history[0]["new_alpha"] == pytest.approx(0.6)
    assert history[0]["changed_by"] == "supervisor-1"
    assert history[1]["old_alpha"] == pytest.approx(0.6)
    assert history[1]["changed_by"] is None
    assert history[0]["timestamp"].endswith("+00:00")


def test_config_history_is_capped():
    for i in range(CONFIG_HISTORY_LIMIT + 5):
        client.patch("/prioritise/config", json={"alpha": (i % 10) / 10})
    assert len(client.get("/prioritise/config").json()["history"]) == CONFIG_HISTORY_LIMIT


def test_config_patch_needs_the_key_when_one_is_set(monkeypatch):
    monkeypatch.setenv("CONFIG_API_KEY", "s3cret")
    body = {"alpha": 0.9}
    assert client.patch("/prioritise/config", json=body).status_code == 403
    assert client.patch("/prioritise/config", json=body, headers={"X-Config-Key": "wrong"}).status_code == 403
    assert client.get("/prioritise/config").json()["alpha"] == pytest.approx(0.4)
    assert client.patch("/prioritise/config", json=body, headers={"X-Config-Key": "s3cret"}).status_code == 200
    # Reading is open because the backend and dashboard need it.
    assert client.get("/prioritise/config").status_code == 200


# compare
def test_compare_returns_all_four_with_metrics():
    body = client.post("/prioritise/compare", json=make_problem(30)).json()
    assert set(body) == {"fcfs", "greedy", "genetic", "hybrid"}
    for name, result in body.items():
        assert result["algorithm"] == name
        assert result["metrics"]["gini_coefficient"] is not None
        assert result["metrics"]["avg_response_time_estimate"] is not None


def test_compare_with_a_single_report():
    payload = {"reports": [make_report(1)], "workers": [{"id": "w1", "lat": -33.93, "lng": 18.43, "available": True}]}
    assert client.post("/prioritise/compare", json=payload).status_code == 200


# queue-order metrics
def queue(severities=None, equities=None):
    n = len(severities or equities)
    return [
        Report(
            id=f"r{i}",
            category="water",
            severity=(severities or [3] * n)[i],
            created_at="2026-10-01T00:00:00Z",
            lat=-33.9,
            lng=18.4,
            ward_id="W1",
            equity_weight=None if equities is None else equities[i],
        )
        for i in range(n)
    ]


def test_high_severity_rate_all_at_the_front():
    # 10 reports: the top 20% is the first 2 places.
    assert high_severity_rate(queue([5, 4] + [1] * 8)) == pytest.approx(1.0)


def test_high_severity_rate_all_at_the_back():
    assert high_severity_rate(queue([1] * 8 + [5, 4])) == pytest.approx(0.0)


def test_high_severity_rate_partial():
    assert high_severity_rate(queue([5, 1, 1, 1, 1, 1, 1, 1, 1, 5])) == pytest.approx(0.5)


def test_high_severity_rate_none_without_high_severity_reports():
    assert high_severity_rate(queue([1, 2, 3, 3])) is None


def test_low_income_coverage_all_in_the_top_half():
    assert low_income_coverage(queue(equities=[0.8, 0.7, 0.6, 0.1, 0.2, 0.3])) == pytest.approx(1.0)


def test_low_income_coverage_all_in_the_bottom_half():
    assert low_income_coverage(queue(equities=[0.1, 0.2, 0.3, 0.8, 0.7, 0.6])) == pytest.approx(0.0)


def test_low_income_threshold_is_inclusive():
    assert low_income_coverage(queue(equities=[0.5, 0.1, 0.1, 0.1])) == pytest.approx(1.0)
    assert low_income_coverage(queue(equities=[0.49, 0.1, 0.1, 0.1])) is None


def test_low_income_coverage_none_without_equity_weights():
    assert low_income_coverage(queue(severities=[3, 3, 3])) is None


def test_every_algorithm_now_returns_the_two_queue_metrics():
    p = make_problem(30)
    for r in p["reports"]:
        r["equity_weight"] = 0.7
        r["severity"] = max(r["severity"], 4) if r["id"] == "r0" else r["severity"]
    for name in ("fcfs", "greedy", "genetic", "hybrid"):
        m = client.post(f"/prioritise/{name}", json={**p, "seed": 1}).json()["metrics"]
        assert 0 <= m["high_severity_rate"] <= 1, name
        assert 0 <= m["low_income_coverage"] <= 1, name


def test_hybrid_moves_low_income_reports_forward_as_alpha_rises():
    p = make_problem(100, seed=2)
    for r in p["reports"]:
        r["equity_weight"] = 0.78 if int(r["id"][1:]) % 2 else 0.12
    coverage = [
        client.post("/prioritise/hybrid", json={**p, "alpha": a}).json()["metrics"]["low_income_coverage"]
        for a in (0.0, 0.5, 1.0)
    ]
    assert coverage[0] < coverage[1] <= coverage[2]
    assert coverage[2] == pytest.approx(1.0)


# helpers
def test_gini_basics():
    assert gini([5, 5, 5, 5]) == pytest.approx(0.0)
    assert gini([0, 0, 0, 10]) == pytest.approx(0.75)
    assert gini([]) == 0.0


# NFR-02
def test_nfr02_1000_reports_within_5_seconds_for_every_algorithm():
    payload = {**make_problem(1000, workers=10), "seed": 1}
    for name in ("fcfs", "greedy", "genetic", "hybrid"):
        start = time.perf_counter()
        response = client.post(f"/prioritise/{name}", json=payload)
        elapsed = time.perf_counter() - start
        assert response.status_code == 200
        assert elapsed < 5, f"{name} took {elapsed:.2f}s for 1000 reports (NFR-02 limit is 5s)"