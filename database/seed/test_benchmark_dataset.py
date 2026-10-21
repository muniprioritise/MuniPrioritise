"""Checks the generated benchmark dataset against its specification.

Run from the repo root:  python -m pytest database/seed -q
"""

import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import generate_benchmark_dataset as gen  # noqa: E402


@pytest.fixture(scope="module")
def data():
    return gen.build()


def test_committed_file_matches_the_generator(data):
    committed = json.loads((HERE / "benchmark_dataset.json").read_text())
    assert committed == json.loads(json.dumps(data)), "re-run generate_benchmark_dataset.py and commit the result"


def test_same_seed_same_output():
    assert gen.build(7) == gen.build(7)
    assert gen.build(7) != gen.build(8)


def test_sizes(data):
    assert len(data["reports"]) == 500
    assert len(data["wards"]) == 20
    assert len(data["workers"]) == 10


def test_ward_scores_span_the_required_range(data):
    scores = [w["sampi_score"] for w in data["wards"]]
    assert min(scores) == pytest.approx(0.12, abs=0.005)
    assert max(scores) == pytest.approx(0.78, abs=0.005)
    assert all(0 <= s <= 1 for s in scores)


def test_wards_file_matches_dataset_wards(data):
    wards = {w["id"]: w for w in json.loads((HERE / "wards.json").read_text())["wards"]}
    for w in data["wards"]:
        assert wards[w["id"]]["sampi_score"] == w["sampi_score"]


def test_category_mix_is_exact(data):
    counts = {}
    for r in data["reports"]:
        counts[r["category"]] = counts.get(r["category"], 0) + 1
    assert counts == {"water": 125, "electricity": 125, "roads": 100, "refuse": 100, "sanitation": 50}


def test_severity_is_roughly_normal_around_three(data):
    sev = [r["severity"] for r in data["reports"]]
    assert 2.8 <= sum(sev) / len(sev) <= 3.2
    assert set(sev) <= {1, 2, 3, 4, 5}
    counts = [sev.count(s) for s in range(1, 6)]
    assert counts[2] == max(counts)  # most common is 3
    assert counts[0] < counts[1] and counts[4] < counts[3]  # tails thinner than shoulders


def test_requests_span_seven_days(data):
    days = {r["created_at"][:10] for r in data["reports"]}
    assert len(days) == 7


def test_every_ward_has_requests_and_ids_are_valid(data):
    ward_ids = {w["id"] for w in data["wards"]}
    used = {r["ward_id"] for r in data["reports"]}
    assert used == ward_ids


def test_ward_label_is_the_nearest_ward_and_weight_matches(data):
    wards = data["wards"]
    by_id = {w["id"]: w for w in wards}
    for r in data["reports"]:
        nearest = gen.nearest_ward(r["lat"], r["lng"], wards)
        assert r["ward_id"] == nearest["id"]
        assert r["equity_weight"] == by_id[r["ward_id"]]["sampi_score"]


def test_workers_are_spread_out(data):
    pts = {(w["lat"], w["lng"]) for w in data["workers"]}
    assert len(pts) == 10
    assert all(w["available"] for w in data["workers"])


def test_report_ids_are_unique_and_in_time_order(data):
    ids = [r["id"] for r in data["reports"]]
    assert len(set(ids)) == 500
    times = [r["created_at"] for r in data["reports"]]
    assert times == sorted(times)
