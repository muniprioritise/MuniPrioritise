"""Time-lapse simulation of the prioritisation algorithms over twelve weeks.

Synthetic data. Requests arrive each day across the 20 benchmark wards, a fixed
crew clears the top of the queue each day, and the queue is re-ranked daily.
The same arrivals are replayed under every policy, so differences between
policies come from the policy alone.

What this models: who is served first. It does not model fixing the underlying
infrastructure. Arrival rates, crew capacity and reporting behaviour are
assumptions listed in CONFIG.

Run from this folder:  python simulate.py
Writes ../database/seed/simulation_results.json
"""
import argparse
import json
import math
import random
import statistics
from datetime import datetime, timedelta, timezone
from pathlib import Path

import main as algo

HERE = Path(__file__).resolve().parent
WARDS_PATH = HERE.parent / "database" / "seed" / "wards.json"
OUTPUT_PATH = HERE.parent / "database" / "seed" / "simulation_results.json"

CONFIG = {
    "days": 84,
    "switch_day": 28,              # weeks 1-4 are the status quo (first come, first served)
    "seeds": 10,
    "arrivals_per_day": 44,        # city-wide reports per day
    "workers": 10,
    "hours_per_worker_day": 8.0,
    "work_hours_per_job": 1.0,     # time on site, before travel
    "travel_speed_kmh": 30.0,      # same assumption as the benchmark
    "depot_wards": 5,              # crews are based in the 5 least deprived wards, 2 each
    "reporting_bias": 0.5,         # 0 = every ward reports equally per person
    "deprived_sampi": 0.5,         # matches the benchmark's low-income cut-off
    "fixed_alpha": 0.4,
    "alpha_min": 0.1,
    "alpha_max": 0.8,
    "window_days": 7,
    "gap_tolerance_days": 0.1,     # wait gap treated as closed (2.4 hours)
    "gap_gain": 0.1,               # alpha change per day of gap per day
    "backlog_tolerance": 0.1,      # per-person backlog ratio treated as closed
    "backlog_gain": 0.1,
    "location_spread_km": 2.5,
    "depot_spread_km": 1.5,
}
KM_PER_DEGREE = 111.0
START = datetime(2026, 1, 5, tzinfo=timezone.utc)
POLICIES = ["fcfs", "hybrid_fixed", "hybrid_gap", "hybrid_backlog"]


def load_wards():
    return json.loads(WARDS_PATH.read_text(encoding="utf-8"))["wards"]


def poisson(rng, lam):
    """Knuth's method; lam is small enough that this is fast."""
    limit, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= limit:
            return k
        k += 1


def build_arrivals(seed, wards, cfg):
    """One list of arrivals per day. Identical for every policy."""
    rng = random.Random(seed)
    weights = [w["population"] * (1 - cfg["reporting_bias"] * w["sampi_score"]) for w in wards]
    total = sum(weights)
    rates = [cfg["arrivals_per_day"] * x / total for x in weights]

    days = []
    counter = 0
    for day in range(cfg["days"]):
        todays = []
        for ward, rate in zip(wards, rates):
            for _ in range(poisson(rng, rate)):
                offset = rng.random()  # fraction of the day
                lat = ward["lat"] + rng.gauss(0, cfg["location_spread_km"] / KM_PER_DEGREE)
                lng = ward["lng"] + rng.gauss(0, cfg["location_spread_km"] / KM_PER_DEGREE)
                severity = min(5, max(1, round(rng.gauss(3, 1))))
                created = START + timedelta(days=day + offset)
                counter += 1
                todays.append({
                    "report": algo.Report(
                        id=f"r{counter}", category="water", severity=severity,
                        created_at=created.isoformat(), lat=lat, lng=lng,
                        ward_id=ward["id"], equity_weight=ward["sampi_score"],
                    ),
                    "created_day": day + offset,
                })
        days.append(todays)

    depots = sorted(wards, key=lambda w: w["sampi_score"])[: cfg["depot_wards"]]
    workers = []
    for i in range(cfg["workers"]):
        w = depots[i % len(depots)]
        workers.append(algo.Worker(
            id=f"w{i}",
            lat=w["lat"] + rng.gauss(0, cfg["depot_spread_km"] / KM_PER_DEGREE),
            lng=w["lng"] + rng.gauss(0, cfg["depot_spread_km"] / KM_PER_DEGREE),
        ))
    return days, workers


def clip(value, low, high):
    return max(low, min(high, value))


def mean(values):
    return sum(values) / len(values) if values else None


def assign_day(order, by_id, workers, cfg):
    """Serve reports in ranked order until the crews run out of hours.

    A report goes to the nearest worker with enough hours left for the round
    trip plus the job. If no worker can fit it, it stays in the queue and a
    cheaper job behind it is served instead. Returns {report_id: travel_hours}.
    """
    remaining = {w.id: cfg["hours_per_worker_day"] for w in workers}
    served = {}
    for rid in order:
        r = by_id[rid]["report"]
        options = []
        for w in workers:
            km = algo.euclidean_distance(w.lat, w.lng, r.lat, r.lng)
            travel = 2 * km / cfg["travel_speed_kmh"]
            cost = travel + cfg["work_hours_per_job"]
            if cost <= remaining[w.id]:
                options.append((km, w.id, travel, cost))
        if options:
            _, wid, travel, cost = min(options)
            remaining[wid] -= cost
            served[rid] = travel / 2  # one-way travel is the arrival delay
    return served


def run_policy(policy, days, workers, wards, cfg):
    deprived = {w["id"] for w in wards if w["sampi_score"] >= cfg["deprived_sampi"]}
    pop = {w["id"]: w["population"] for w in wards}
    pop_dep = sum(p for i, p in pop.items() if i in deprived)
    pop_aff = sum(p for i, p in pop.items() if i not in deprived)

    pending = []
    by_id = {}
    served_log = []       # (day_served, ward_id, response_days)
    alpha = cfg["fixed_alpha"]
    out = {k: [] for k in ["alpha", "wait_dep", "wait_aff", "backlog_dep", "backlog_aff"]}
    ward_wait = {w["id"]: [] for w in wards}
    ward_open = {w["id"]: [] for w in wards}

    for day, arrivals in enumerate(days):
        pending.extend(arrivals)
        by_id.update({a["report"].id: a for a in arrivals})
        live = policy != "fcfs" and day >= cfg["switch_day"]

        if live:
            window = [s for s in served_log if s[0] >= day - cfg["window_days"]]
            dep_waits = [s[2] for s in window if s[1] in deprived]
            aff_waits = [s[2] for s in window if s[1] not in deprived]
            if policy == "hybrid_gap" and dep_waits and aff_waits:
                gap = mean(dep_waits) - mean(aff_waits)
                alpha = clip(alpha + cfg["gap_gain"] * (gap - cfg["gap_tolerance_days"]),
                             cfg["alpha_min"], cfg["alpha_max"])
            if policy == "hybrid_backlog":
                b_dep = sum(1 for p in pending if p["report"].ward_id in deprived) / pop_dep
                b_aff = sum(1 for p in pending if p["report"].ward_id not in deprived) / pop_aff
                if b_aff > 0:
                    ratio = b_dep / b_aff
                    alpha = clip(alpha + cfg["backlog_gain"] * (ratio - 1 - cfg["backlog_tolerance"]),
                                 cfg["alpha_min"], cfg["alpha_max"])

        if pending:
            request = algo.PrioritiseRequest(
                reports=[p["report"] for p in pending], workers=workers, alpha=alpha,
            )
            if live:
                order = algo.prioritise_hybrid(request).prioritised_order
            else:
                order = algo.prioritise_fcfs(request).prioritised_order
            served = assign_day(order, by_id, workers, cfg)
            for p in pending:
                rid = p["report"].id
                if rid in served:
                    response = (day + 1 - p["created_day"]) + served[rid] / 24
                    served_log.append((day, p["report"].ward_id, response))
            pending = [p for p in pending if p["report"].id not in served]

        window = [s for s in served_log if s[0] > day - cfg["window_days"]]
        dep = [s[2] for s in window if s[1] in deprived]
        aff = [s[2] for s in window if s[1] not in deprived]
        out["alpha"].append(alpha if live else None)
        out["wait_dep"].append(mean(dep))
        out["wait_aff"].append(mean(aff))
        out["backlog_dep"].append(sum(1 for p in pending if p["report"].ward_id in deprived))
        out["backlog_aff"].append(sum(1 for p in pending if p["report"].ward_id not in deprived))
        for w in wards:
            ww = [s[2] for s in window if s[1] == w["id"]]
            ward_wait[w["id"]].append(mean(ww))
            ward_open[w["id"]].append(sum(1 for p in pending if p["report"].ward_id == w["id"]))

    out["ward_wait"] = ward_wait
    out["ward_open"] = ward_open
    out["status_quo_ward_mean"] = {
        w["id"]: mean([s[2] for s in served_log if s[1] == w["id"] and s[0] < cfg["switch_day"]])
        for w in wards
    }
    out["long_waits"] = {
        "deprived": mean([1.0 if s[2] > 7 else 0.0 for s in served_log if s[1] in deprived and s[0] >= cfg["days"] - 28]),
        "affluent": mean([1.0 if s[2] > 7 else 0.0 for s in served_log if s[1] not in deprived and s[0] >= cfg["days"] - 28]),
    }
    return out


def average_series(runs, key):
    """Mean across seeds for each day, skipping days with no data."""
    length = len(runs[0][key])
    result = []
    for d in range(length):
        values = [r[key][d] for r in runs if r[key][d] is not None]
        result.append(round(mean(values), 4) if values else None)
    return result


def last_weeks_mean(runs, key, cfg, weeks=4):
    start = cfg["days"] - weeks * 7
    per_seed = [mean([v for v in r[key][start:] if v is not None]) for r in runs]
    per_seed = [v for v in per_seed if v is not None]
    if not per_seed:
        return {"mean": None, "sd": None}
    return {"mean": round(mean(per_seed), 3), "sd": round(statistics.pstdev(per_seed), 3)}


def simulate(cfg):
    wards = load_wards()
    results = {p: [] for p in POLICIES}
    for seed in range(cfg["seeds"]):
        days, workers = build_arrivals(1000 + seed, wards, cfg)
        for policy in POLICIES:
            results[policy].append(run_policy(policy, days, workers, wards, cfg))

    policies = {}
    for policy, runs in results.items():
        ward_series = {
            w["id"]: average_series([{"x": r["ward_wait"][w["id"]]} for r in runs], "x")
            for w in wards
        }
        policies[policy] = {
            "alpha": average_series(runs, "alpha"),
            "wait_deprived": average_series(runs, "wait_dep"),
            "wait_affluent": average_series(runs, "wait_aff"),
            "backlog_deprived": average_series(runs, "backlog_dep"),
            "backlog_affluent": average_series(runs, "backlog_aff"),
            "ward_wait": ward_series,
            "ward_open": {
                w["id"]: average_series([{"x": r["ward_open"][w["id"]]} for r in runs], "x")
                for w in wards
            },
            "summary_last_4_weeks": {
                "wait_deprived_days": last_weeks_mean(runs, "wait_dep", cfg),
                "wait_affluent_days": last_weeks_mean(runs, "wait_aff", cfg),
                "alpha": last_weeks_mean(runs, "alpha", cfg),
                "backlog_deprived": last_weeks_mean(runs, "backlog_dep", cfg),
                "backlog_affluent": last_weeks_mean(runs, "backlog_aff", cfg),
            },
            "status_quo_weeks_1_4": {
                "wait_deprived_days": round(mean([mean([v for v in r["wait_dep"][7:cfg["switch_day"]] if v is not None]) for r in runs]), 3),
                "wait_affluent_days": round(mean([mean([v for v in r["wait_aff"][7:cfg["switch_day"]] if v is not None]) for r in runs]), 3),
            },
            "share_waiting_over_7_days": {
                "deprived": round(mean([r["long_waits"]["deprived"] for r in runs if r["long_waits"]["deprived"] is not None]), 4),
                "affluent": round(mean([r["long_waits"]["affluent"] for r in runs if r["long_waits"]["affluent"] is not None]), 4),
            },
        }

    return {
        "_note": "SYNTHETIC simulation. Ward scores and populations are illustrative; arrivals, crew capacity and reporting behaviour are assumptions.",
        "config": cfg,
        "wards": [
            {"id": w["id"], "name": w["name"], "lat": w["lat"], "lng": w["lng"],
             "sampi_score": w["sampi_score"], "population": w["population"]}
            for w in wards
        ],
        "policies": policies,
    }


STRAINED_ARRIVALS = 48
SENSITIVITY_ARRIVALS = [40, 44, 48]   # light, base, heavy congestion
SENSITIVITY_BIAS = [0.0, 0.5, 0.8]    # how much less deprived wards report per person


def run_sensitivity(cfg):
    """Final-four-week waits for each policy across congestion and reporting bias."""
    rows = []
    for arrivals in SENSITIVITY_ARRIVALS:
        for bias in SENSITIVITY_BIAS:
            policies = simulate(dict(cfg, seeds=6, arrivals_per_day=arrivals, reporting_bias=bias))["policies"]
            row = {"arrivals_per_day": arrivals, "reporting_bias": bias, "policies": {}}
            for name, p in policies.items():
                s4 = p["summary_last_4_weeks"]
                row["policies"][name] = {
                    "wait_deprived_days": s4["wait_deprived_days"]["mean"],
                    "wait_affluent_days": s4["wait_affluent_days"]["mean"],
                    "alpha": s4["alpha"]["mean"],
                    "open_deprived": s4["backlog_deprived"]["mean"],
                    "open_affluent": s4["backlog_affluent"]["mean"],
                }
            rows.append(row)
    return rows


def main_cli():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seeds", type=int, default=CONFIG["seeds"])
    parser.add_argument("--bias", type=float, default=CONFIG["reporting_bias"])
    parser.add_argument("--out", type=Path, default=OUTPUT_PATH)
    args = parser.parse_args()
    cfg = dict(CONFIG, seeds=args.seeds, reporting_bias=args.bias)
    results = simulate(cfg)
    # Prioritising only matters when crews are short, so the output holds a
    # typical-load run and a strained run, selectable on the dashboard.
    strained = simulate(dict(cfg, arrivals_per_day=STRAINED_ARRIVALS))
    results["scenarios"] = {
        "typical": {
            "label": "Typical load",
            "arrivals_per_day": cfg["arrivals_per_day"],
            "policies": results.pop("policies"),
        },
        "strained": {
            "label": "Strained city",
            "arrivals_per_day": STRAINED_ARRIVALS,
            "policies": strained["policies"],
        },
    }
    results["sensitivity"] = run_sensitivity(cfg)
    args.out.write_text(json.dumps(results, indent=1), encoding="utf-8")
    for name, p in results["scenarios"]["strained"]["policies"].items():
        s4 = p["summary_last_4_weeks"]
        sq = p["status_quo_weeks_1_4"]
        print(f"{name:15s} status quo dep {sq['wait_deprived_days']:.2f}d aff {sq['wait_affluent_days']:.2f}d | "
              f"weeks 9-12 dep {s4['wait_deprived_days']['mean']:.2f}d aff {s4['wait_affluent_days']['mean']:.2f}d "
              f"alpha {s4['alpha']['mean'] if s4['alpha']['mean'] is None else round(s4['alpha']['mean'], 2)} backlog {s4['backlog_deprived']['mean']:.0f}/{s4['backlog_affluent']['mean']:.0f}")


if __name__ == "__main__":
    main_cli()
