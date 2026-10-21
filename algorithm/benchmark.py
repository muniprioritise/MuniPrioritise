"""Benchmark all four algorithms and run the alpha sensitivity analysis.

Run from the algorithm folder:

    python benchmark.py             # full run, writes the result files
    python benchmark.py --quick     # 3 datasets, short Genetic runs, writes nothing

Every algorithm runs on the same N synthetic datasets (seeds 42 to 42 + N - 1),
so each dataset gives one pair of observations for the paired t-tests. Genetic
gets a fixed seed per dataset, so a run can be repeated exactly.

Writes database/seed/benchmark_results.json and database/seed/alpha_sensitivity.csv.
"""

import argparse
import csv
import importlib.util
import json
import math
import platform
import sys
import time
from itertools import combinations
from pathlib import Path

import numpy as np
from scipy import stats

import main
from main import (
    HIGH_SEVERITY_TOP_SHARE,
    LOW_INCOME_SAMPI_THRESHOLD,
    LOW_INCOME_TOP_SHARE,
    PrioritiseRequest,
    Report,
    Worker,
    euclidean_distance,
    simulate_response_times,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
SEED_DIR = REPO_ROOT / "database" / "seed"
RESULTS_PATH = SEED_DIR / "benchmark_results.json"
ALPHA_CSV_PATH = SEED_DIR / "alpha_sensitivity.csv"

FIRST_SEED = 42  # the seed of the committed benchmark_dataset.json
DEFAULT_DATASETS = 10  # minimum 10 iterations
BENCHMARK_GENERATIONS = 100  # Genetic "benchmark mode" (live mode is 50)
HYBRID_ALPHA = 0.4  # the live default
ALPHAS = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]

ALGORITHMS = {
    "fcfs": main.prioritise_fcfs,
    "greedy": main.prioritise_greedy,
    "genetic": main.prioritise_genetic,
    "hybrid": main.prioritise_hybrid,
}

# The five metrics from the proposal, then two diagnostics.
PRIMARY_METRICS = [
    "gini_coefficient",
    "avg_response_time_estimate",
    "high_severity_rate",
    "low_income_coverage",
    "computational_time_ms",
]
DIAGNOSTIC_METRICS = [
    "sampi_wait_correlation",  # Spearman: negative means deprived wards wait less
    "mean_leg_km",  # average distance a worker travels between consecutive jobs
]
ALL_METRICS = PRIMARY_METRICS + DIAGNOSTIC_METRICS


def load_generator():
    spec = importlib.util.spec_from_file_location(
        "generate_benchmark_dataset", SEED_DIR / "generate_benchmark_dataset.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def clean(value):
    """JSON cannot hold NaN, so turn it into null."""
    if value is None:
        return None
    value = float(value)
    return None if math.isnan(value) or math.isinf(value) else value


def diagnostics(ordered: list[Report], workers: list[Worker]) -> dict:
    """Extra measures that help explain the main metrics."""
    served = simulate_response_times(ordered, workers)

    # Average distance between consecutive jobs.
    position = {w.id: (w.lat, w.lng) for w in workers if w.available}
    legs = []
    for report, worker, _ in served:
        lat, lng = position[worker.id]
        legs.append(euclidean_distance(lat, lng, report.lat, report.lng))
        position[worker.id] = (report.lat, report.lng)

    # SAMPI against average wait, per ward.
    by_ward: dict[str, list[float]] = {}
    sampi: dict[str, float] = {}
    for report, _, minutes in served:
        if report.equity_weight is None:
            continue
        by_ward.setdefault(report.ward_id, []).append(minutes)
        sampi[report.ward_id] = report.equity_weight
    correlation = None
    if len(by_ward) >= 3:
        wards = sorted(by_ward)
        waits = [float(np.mean(by_ward[w])) for w in wards]
        scores = [sampi[w] for w in wards]
        if len(set(waits)) > 1 and len(set(scores)) > 1:
            correlation = clean(stats.spearmanr(scores, waits).statistic)

    return {
        "sampi_wait_correlation": correlation,
        "mean_leg_km": float(np.mean(legs)) if legs else None,
    }


def run_once(name: str, data: dict, seed: int, alpha: float, generations: int) -> dict:
    reports = [Report(**r) for r in data["reports"]]
    workers = [Worker(**w) for w in data["workers"]]
    by_id = {r.id: r for r in reports}
    request = PrioritiseRequest(
        reports=reports, workers=workers, alpha=alpha, generations=generations, seed=seed
    )

    start = time.perf_counter()
    response = ALGORITHMS[name](request)
    elapsed_ms = (time.perf_counter() - start) * 1000

    m = response.metrics
    ordered = [by_id[i] for i in response.prioritised_order]
    result = {
        "gini_coefficient": m.gini_coefficient,
        "avg_response_time_estimate": m.avg_response_time_estimate,
        "high_severity_rate": m.high_severity_rate,
        "low_income_coverage": m.low_income_coverage,
        "computational_time_ms": round(elapsed_ms, 3),
    }
    result.update(diagnostics(ordered, workers))
    return result


def describe(values: list) -> dict:
    xs = [v for v in values if v is not None]
    if not xs:
        return {"mean": None, "sd": None, "min": None, "max": None, "n": 0}
    return {
        "mean": clean(np.mean(xs)),
        "sd": clean(np.std(xs, ddof=1)) if len(xs) > 1 else None,
        "min": clean(min(xs)),
        "max": clean(max(xs)),
        "n": len(xs),
    }


def anova(groups: dict[str, list]) -> dict:
    """One-way ANOVA across the algorithms. It ignores the pairing, so the paired t-tests are the main test."""
    samples = list(groups.values())
    if any(None in g or len(g) < 2 for g in samples):
        return {"F": None, "p": None}
    flat = [x for g in samples for x in g]
    if len(set(flat)) == 1:
        return {"F": None, "p": None}
    result = stats.f_oneway(*samples)
    return {"F": clean(result.statistic), "p": clean(result.pvalue)}


def paired_tests(metric: str, groups: dict[str, list]) -> list[dict]:
    pairs = list(combinations(groups, 2))
    rows = []
    for a, b in pairs:
        x, y = groups[a], groups[b]
        row = {"metric": metric, "a": a, "b": b, "mean_diff": None, "t": None, "p": None,
               "p_bonferroni": None, "cohens_dz": None}
        if None not in x and None not in y and len(x) == len(y) and len(x) > 1:
            diff = np.array(x, dtype=float) - np.array(y, dtype=float)
            row["mean_diff"] = clean(diff.mean())
            if np.allclose(diff, 0):
                row.update(t=0.0, p=1.0, p_bonferroni=1.0, cohens_dz=0.0)
            else:
                result = stats.ttest_rel(x, y)
                p = clean(result.pvalue)
                sd = diff.std(ddof=1)
                row.update(
                    t=clean(result.statistic),
                    p=p,
                    p_bonferroni=None if p is None else min(1.0, p * len(pairs)),
                    cohens_dz=clean(diff.mean() / sd) if sd > 0 else None,
                )
        rows.append(row)
    return rows


def run_benchmark(
    n_datasets: int = DEFAULT_DATASETS,
    generations: int = BENCHMARK_GENERATIONS,
    alphas: list[float] = ALPHAS,
    progress=None,
) -> dict:
    generator = load_generator()
    seeds = [FIRST_SEED + i for i in range(n_datasets)]
    datasets = {s: generator.build(s) for s in seeds}

    # The committed dataset should match what seed 42 generates.
    committed_path = SEED_DIR / "benchmark_dataset.json"
    matches_committed = None
    if committed_path.exists() and FIRST_SEED in datasets:
        committed = json.loads(committed_path.read_text())
        built = json.loads(json.dumps(datasets[FIRST_SEED]))
        matches_committed = (
            committed["reports"] == built["reports"] and committed["workers"] == built["workers"]
        )

    runs = []
    for seed in seeds:
        for name in ALGORITHMS:
            if progress:
                progress(f"dataset {seed}: {name}")
            metrics = run_once(name, datasets[seed], seed, HYBRID_ALPHA, generations)
            runs.append({"seed": seed, "algorithm": name, "metrics": metrics})

    summary, anova_results, t_tests = {}, {}, []
    for name in ALGORITHMS:
        summary[name] = {
            metric: describe([r["metrics"][metric] for r in runs if r["algorithm"] == name])
            for metric in ALL_METRICS
        }
    for metric in ALL_METRICS:
        groups = {
            name: [r["metrics"][metric] for r in runs if r["algorithm"] == name]
            for name in ALGORITHMS
        }
        anova_results[metric] = anova(groups)
        t_tests += paired_tests(metric, groups)

    sensitivity = []
    for alpha in alphas:
        alpha_runs = []
        for seed in seeds:
            if progress:
                progress(f"alpha {alpha}: dataset {seed}")
            alpha_runs.append(run_once("hybrid", datasets[seed], seed, alpha, generations))
        sensitivity.append(
            {
                "alpha": alpha,
                "metrics": {m: describe([r[m] for r in alpha_runs]) for m in ALL_METRICS},
            }
        )

    return {
        "_note": "SYNTHETIC data. Produced by algorithm/benchmark.py. Timings depend on the machine.",
        "config": {
            "datasets": n_datasets,
            "seeds": seeds,
            "requests_per_dataset": len(datasets[seeds[0]]["reports"]),
            "workers_per_dataset": len(datasets[seeds[0]]["workers"]),
            "wards": len(datasets[seeds[0]]["wards"]),
            "genetic_generations": generations,
            "genetic_population": main.POPULATION_SIZE,
            "hybrid_alpha": HYBRID_ALPHA,
            "alphas": alphas,
            "efficiency_weights": main.EFFICIENCY_WEIGHTS,
            "wait_horizon_hours": main.WAIT_HORIZON_HOURS,
            "high_severity_top_share": HIGH_SEVERITY_TOP_SHARE,
            "low_income_top_share": LOW_INCOME_TOP_SHARE,
            "low_income_sampi_threshold": LOW_INCOME_SAMPI_THRESHOLD,
            "share_of_requests_in_low_income_wards": round(
                float(np.mean([
                    r["equity_weight"] >= LOW_INCOME_SAMPI_THRESHOLD
                    for s in seeds for r in datasets[s]["reports"]
                ])),
                4,
            ),
            "committed_dataset_matches_seed_42": matches_committed,
            "python": platform.python_version(),
            "machine": platform.platform(),
        },
        "metric_notes": {
            "gini_coefficient": "Inequality of average response time between wards. Measures sameness, not fairness.",
            "avg_response_time_estimate": "Minutes. Travel only, nearest available worker, 30 km/h.",
            "high_severity_rate": "Share of severity 4/5 reports in the top 20% of the queue. Random is about 0.2.",
            "low_income_coverage": "Share of low-income-ward reports in the top 50% of the queue. Random is about 0.5.",
            "computational_time_ms": "Wall clock for one call on 500 requests, metric calculation included.",
            "sampi_wait_correlation": "Spearman correlation of ward SAMPI with ward average wait. Negative means deprived wards wait less.",
            "mean_leg_km": "Average distance a worker travels between consecutive jobs. Explains most of the response-time differences.",
        },
        "runs": runs,
        "summary": summary,
        "anova": anova_results,
        "paired_t_tests": t_tests,
        "alpha_sensitivity": sensitivity,
    }


def write_outputs(results: dict) -> None:
    RESULTS_PATH.write_text(json.dumps(results, indent=1) + "\n")
    with ALPHA_CSV_PATH.open("w", newline="") as f:
        writer = csv.writer(f)
        header = ["alpha"]
        for m in ALL_METRICS:
            header += [f"{m}_mean", f"{m}_sd"]
        writer.writerow(header)
        for row in results["alpha_sensitivity"]:
            line = [row["alpha"]]
            for m in ALL_METRICS:
                line += [row["metrics"][m]["mean"], row["metrics"][m]["sd"]]
            writer.writerow(line)


def print_summary(results: dict) -> None:
    def fmt(x, nd=3):
        return "-" if x is None else f"{x:.{nd}f}"

    cfg = results["config"]
    print(f"\n{cfg['datasets']} datasets x {cfg['requests_per_dataset']} requests. Means (sd).\n")
    print(f"{'algorithm':9} {'gini':>14} {'avg min':>16} {'sev top20%':>14} {'low-inc top50%':>16} {'ms':>14}")
    for name, s in results["summary"].items():
        cells = []
        for metric, nd in (("gini_coefficient", 3), ("avg_response_time_estimate", 1),
                           ("high_severity_rate", 3), ("low_income_coverage", 3),
                           ("computational_time_ms", 1)):
            cells.append(f"{fmt(s[metric]['mean'], nd)} ({fmt(s[metric]['sd'], nd)})")
        print(f"{name:9} " + " ".join(f"{c:>15}" for c in cells))
    print("\nHybrid across alpha (means):")
    print(f"{'alpha':>6} {'gini':>7} {'avg min':>9} {'sev top20%':>11} {'low-inc top50%':>15} {'corr':>7} {'leg km':>7}")
    for row in results["alpha_sensitivity"]:
        m = row["metrics"]
        print(f"{row['alpha']:>6.1f} {fmt(m['gini_coefficient']['mean']):>7} "
              f"{fmt(m['avg_response_time_estimate']['mean'], 1):>9} "
              f"{fmt(m['high_severity_rate']['mean']):>11} {fmt(m['low_income_coverage']['mean']):>15} "
              f"{fmt(m['sampi_wait_correlation']['mean'], 2):>7} {fmt(m['mean_leg_km']['mean'], 2):>7}")
    print(f"\nCommitted dataset matches seed 42: {cfg['committed_dataset_matches_seed_42']}")
    print(f"Share of requests in low-income wards (SAMPI >= {cfg['low_income_sampi_threshold']}): "
          f"{cfg['share_of_requests_in_low_income_wards']}")


def cli(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Run the MuniPrioritise benchmark.")
    parser.add_argument("--datasets", type=int, default=DEFAULT_DATASETS, help="number of synthetic datasets (default 10)")
    parser.add_argument("--generations", type=int, default=BENCHMARK_GENERATIONS, help="Genetic generations (default 100)")
    parser.add_argument("--quick", action="store_true", help="3 datasets, 10 generations, nothing written")
    parser.add_argument("--no-write", action="store_true", help="print the summary but do not write the result files")
    args = parser.parse_args(argv)

    n, generations, write = args.datasets, args.generations, not args.no_write
    if args.quick:
        n, generations, write = 3, 10, False
    if n < 2:
        parser.error("need at least 2 datasets for the statistical tests")

    results = run_benchmark(
        n_datasets=n,
        generations=generations,
        progress=lambda msg: print(msg, file=sys.stderr),
    )
    print_summary(results)
    if write:
        write_outputs(results)
        print(f"\nWrote {RESULTS_PATH.relative_to(REPO_ROOT)} and {ALPHA_CSV_PATH.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(cli())