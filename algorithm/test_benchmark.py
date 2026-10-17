import pytest

import benchmark

ALGORITHMS = {"fcfs", "greedy", "genetic", "hybrid"}


@pytest.fixture(scope="module")
def small_run():
    # Two datasets and two Genetic generations keep this fast. Only the shape and
    # the arithmetic are checked here, not the research results.
    return benchmark.run_benchmark(n_datasets=2, generations=2, alphas=[0.0, 1.0])


def test_every_algorithm_runs_on_every_dataset(small_run):
    runs = small_run["runs"]
    assert len(runs) == 2 * 4
    assert {r["algorithm"] for r in runs} == ALGORITHMS
    assert {r["seed"] for r in runs} == {42, 43}


def test_committed_dataset_is_the_seed_42_dataset(small_run):
    assert small_run["config"]["committed_dataset_matches_seed_42"] is True


def test_each_run_has_all_metrics_in_range(small_run):
    for run in small_run["runs"]:
        m = run["metrics"]
        assert set(m) == set(benchmark.ALL_METRICS)
        assert 0 <= m["gini_coefficient"] <= 1
        assert m["avg_response_time_estimate"] > 0
        assert 0 <= m["high_severity_rate"] <= 1
        assert 0 <= m["low_income_coverage"] <= 1
        assert m["computational_time_ms"] > 0
        assert -1 <= m["sampi_wait_correlation"] <= 1
        assert m["mean_leg_km"] > 0


def test_summary_covers_every_algorithm_and_metric(small_run):
    assert set(small_run["summary"]) == ALGORITHMS
    for stats_by_metric in small_run["summary"].values():
        assert set(stats_by_metric) == set(benchmark.ALL_METRICS)
        assert stats_by_metric["gini_coefficient"]["n"] == 2


def test_paired_tests_cover_all_six_pairs_for_every_metric(small_run):
    tests = small_run["paired_t_tests"]
    assert len(tests) == 6 * len(benchmark.ALL_METRICS)
    pairs = {(t["a"], t["b"]) for t in tests if t["metric"] == "gini_coefficient"}
    assert len(pairs) == 6


def test_anova_has_an_entry_per_metric(small_run):
    assert set(small_run["anova"]) == set(benchmark.ALL_METRICS)


def test_alpha_sensitivity_has_a_row_per_alpha(small_run):
    rows = small_run["alpha_sensitivity"]
    assert [r["alpha"] for r in rows] == [0.0, 1.0]
    # More weight on equity must put low-income reports further forward.
    low, high = (r["metrics"]["low_income_coverage"]["mean"] for r in rows)
    assert high > low


def test_results_are_reproducible_apart_from_timings(small_run):
    again = benchmark.run_benchmark(n_datasets=2, generations=2, alphas=[0.0, 1.0])
    for a, b in zip(small_run["runs"], again["runs"]):
        for metric in benchmark.ALL_METRICS:
            if metric != "computational_time_ms":
                assert a["metrics"][metric] == b["metrics"][metric], (a["algorithm"], metric)


def test_paired_test_with_identical_groups_gives_p_of_one():
    rows = benchmark.paired_tests("m", {"a": [1.0, 2.0, 3.0], "b": [1.0, 2.0, 3.0]})
    assert rows[0]["p"] == 1.0 and rows[0]["mean_diff"] == 0.0


def test_paired_test_detects_a_clear_difference():
    rows = benchmark.paired_tests("m", {"a": [10.0, 11.0, 12.0, 13.0], "b": [1.0, 1.2, 0.9, 1.1]})
    assert rows[0]["mean_diff"] > 8
    assert rows[0]["p"] < 0.01
    assert rows[0]["p_bonferroni"] == pytest.approx(rows[0]["p"])  # one pair, so no correction


def test_bonferroni_multiplies_by_the_number_of_pairs():
    groups = {"a": [1.0, 2.0, 3.5, 4.0], "b": [1.1, 2.3, 3.0, 4.6], "c": [5.0, 6.0, 7.5, 8.0]}
    for row in benchmark.paired_tests("m", groups):
        assert row["p_bonferroni"] == pytest.approx(min(1.0, row["p"] * 3))


def test_paired_test_skips_missing_values():
    rows = benchmark.paired_tests("m", {"a": [1.0, None, 3.0], "b": [1.0, 2.0, 3.0]})
    assert rows[0]["p"] is None


def test_anova_of_constant_values_is_null():
    assert benchmark.anova({"a": [1.0, 1.0], "b": [1.0, 1.0]}) == {"F": None, "p": None}


def test_anova_detects_a_difference():
    result = benchmark.anova({"a": [1.0, 1.1, 0.9], "b": [5.0, 5.1, 4.9], "c": [9.0, 9.1, 8.9]})
    assert result["p"] < 0.001