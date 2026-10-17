import logging
import os
import secrets
import threading
import time
import math
import random
from datetime import datetime, timezone

import numpy as np
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from deap import base, creator, tools

app = FastAPI()

# DEAP requires these to be created once at module level, not per-request.
# FitnessMin because we're minimising severity-weighted response time.
creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
creator.create("Individual", list, fitness=creator.FitnessMin)

# Schemas below must match docs/api-contracts.md. Update that file if these change.

class Report(BaseModel):
    id: str
    category: str
    severity: int
    created_at: str
    lat: float
    lng: float
    ward_id: str
    equity_weight: float | None = None


class Worker(BaseModel):
    id: str
    lat: float
    lng: float
    available: bool = True


class PrioritiseRequest(BaseModel):
    reports: list[Report]
    workers: list[Worker]
    alpha: float | None = None
    generations: int | None = None  # GA only. Defaults to 50 (live mode). Pass 100 for benchmark mode.
    seed: int | None = None  # GA only. Set for reproducible benchmark runs.


class Assignment(BaseModel):
    report_id: str
    worker_id: str
    score: float
    # Hybrid only (null for the baselines): the two parts of the final score.
    efficiency_score: float | None = None
    equity_score: float | None = None


class Metrics(BaseModel):
    processing_time_ms: float
    gini_coefficient: float | None = None
    avg_response_time_estimate: float | None = None  # minutes
    # Defined in Phase 3 (P3-05). Kept here so the output matches docs/api-contracts.md.
    high_severity_rate: float | None = None
    low_income_coverage: float | None = None
    # Hybrid only: reports that arrived with no equity_weight and were given Q = 0.
    equity_missing_count: int | None = None


class PrioritiseResponse(BaseModel):
    algorithm: str
    prioritised_order: list[str]
    assignments: list[Assignment]
    metrics: Metrics
    # Hybrid only: the alpha this run actually used, so a result describes itself.
    alpha_used: float | None = None


# ---------------------------------------------------------------------------
# Shared helpers used by every algorithm endpoint
# ---------------------------------------------------------------------------

KM_PER_DEGREE = 111.0
TRAVEL_SPEED_KMH = 30.0  # assumed average urban travel speed for response-time estimates


def euclidean_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Straight-line distance in km on a locally flat projection.

    Longitude degrees shrink with latitude, so raw degrees would distort
    distances. The result is still plain Euclidean, just in kilometres.
    """
    mid_lat = math.radians((lat1 + lat2) / 2)
    dy = (lat1 - lat2) * KM_PER_DEGREE
    dx = (lng1 - lng2) * KM_PER_DEGREE * math.cos(mid_lat)
    return math.sqrt(dx * dx + dy * dy)


def nearest_available_worker(report: Report, workers: list[Worker]) -> Worker | None:
    available = [w for w in workers if w.available]
    if not available:
        return None
    return min(
        available,
        key=lambda w: euclidean_distance(report.lat, report.lng, w.lat, w.lng),
    )


def proximity_scores(reports: list[Report], workers: list[Worker]) -> dict[str, float]:
    """Proximity of each report to its nearest available worker, scaled 0 to 1.

    1 is the closest report in the batch, 0 the furthest. A report with no
    available worker scores 0. If every report is equally far, all score 1.
    Greedy and Hybrid both use this, so the benchmark compares them on the
    same definition of "close".
    """
    distances: dict[str, float | None] = {}
    for report in reports:
        worker = nearest_available_worker(report, workers)
        distances[report.id] = (
            None
            if worker is None
            else euclidean_distance(report.lat, report.lng, worker.lat, worker.lng)
        )

    known = [d for d in distances.values() if d is not None]
    d_min = min(known) if known else 0.0
    d_max = max(known) if known else 0.0
    spread = d_max - d_min

    scores: dict[str, float] = {}
    for report in reports:
        d = distances[report.id]
        if d is None:
            scores[report.id] = 0.0
        elif spread <= 1e-9:
            scores[report.id] = 1.0
        else:
            scores[report.id] = 1.0 - (d - d_min) / spread
    return scores


def gini(values: list[float]) -> float:
    """Gini coefficient. 0 = perfectly equal, towards 1 = highly unequal."""
    xs = sorted(values)
    n = len(xs)
    total = sum(xs)
    if n < 2 or total <= 0:
        return 0.0
    weighted = sum((i + 1) * x for i, x in enumerate(xs))
    return (2 * weighted) / (n * total) - (n + 1) / n


def simulate_response_times(
    ordered_reports: list[Report], workers: list[Worker]
) -> list[tuple[Report, Worker, float]]:
    """Walk the prioritised order and estimate when each report is reached.

    Each report goes to its nearest available worker. A worker serves their
    reports in the prioritised order, travelling from wherever they last were.
    Only travel time is counted (service time on site is assumed to be zero).
    Returns (report, worker, minutes_until_arrival) for every served report.
    """
    position = {w.id: (w.lat, w.lng) for w in workers if w.available}
    elapsed = {w.id: 0.0 for w in workers if w.available}
    result: list[tuple[Report, Worker, float]] = []

    for report in ordered_reports:
        worker = nearest_available_worker(report, workers)
        if worker is None:
            continue
        lat, lng = position[worker.id]
        km = euclidean_distance(lat, lng, report.lat, report.lng)
        elapsed[worker.id] += (km / TRAVEL_SPEED_KMH) * 60
        position[worker.id] = (report.lat, report.lng)
        result.append((report, worker, elapsed[worker.id]))

    return result


HIGH_SEVERITY_TOP_SHARE = 0.20  # "the top of the queue" for high_severity_rate
LOW_INCOME_TOP_SHARE = 0.50  # "the top half of the queue" for low_income_coverage
LOW_INCOME_SAMPI_THRESHOLD = 0.5  # a report counts as low-income if its ward SAMPI is at least this


def high_severity_rate(ordered_reports: list[Report]) -> float | None:
    """Share of severity 4/5 reports that sit in the top 20% of the queue.

    1.0 means every high-severity report is near the front. A queue in random
    order scores about 0.2. None if the batch has no high-severity reports.
    (HIGH_SEVERITY_THRESHOLD is defined with the genetic algorithm below.)
    """
    high = [i for i, r in enumerate(ordered_reports) if r.severity >= HIGH_SEVERITY_THRESHOLD]
    if not high:
        return None
    cutoff = math.ceil(len(ordered_reports) * HIGH_SEVERITY_TOP_SHARE)
    return sum(1 for i in high if i < cutoff) / len(high)


def low_income_coverage(ordered_reports: list[Report]) -> float | None:
    """Share of low-income-ward reports that sit in the top half of the queue.

    A report is low-income if its equity_weight (the ward SAMPI score) is at
    least LOW_INCOME_SAMPI_THRESHOLD. A queue in random order scores about 0.5,
    so read the result against that. None if no report has a qualifying weight.
    """
    low = [
        i
        for i, r in enumerate(ordered_reports)
        if r.equity_weight is not None and r.equity_weight >= LOW_INCOME_SAMPI_THRESHOLD
    ]
    if not low:
        return None
    cutoff = math.ceil(len(ordered_reports) * LOW_INCOME_TOP_SHARE)
    return sum(1 for i in low if i < cutoff) / len(low)


def build_metrics(
    ordered_reports: list[Report], workers: list[Worker], processing_time_ms: float
) -> Metrics:
    """Metrics shared by every algorithm so they can be compared like for like.

    avg_response_time_estimate: mean minutes until a worker reaches each report.
    gini_coefficient: inequality of the *average* response time between wards
    (0 = every ward waits the same time on average). It measures sameness, not
    fairness: an algorithm that serves deprived wards faster on purpose raises it.
    high_severity_rate and low_income_coverage describe the queue order only,
    so they do not depend on workers.
    """
    queue_metrics = {
        "high_severity_rate": high_severity_rate(ordered_reports),
        "low_income_coverage": low_income_coverage(ordered_reports),
    }
    for key, value in queue_metrics.items():
        if value is not None:
            queue_metrics[key] = round(value, 4)

    served = simulate_response_times(ordered_reports, workers)
    if not served:
        return Metrics(processing_time_ms=round(processing_time_ms, 3), **queue_metrics)

    minutes = [m for _, _, m in served]
    by_ward: dict[str, list[float]] = {}
    for report, _, m in served:
        by_ward.setdefault(report.ward_id, []).append(m)
    ward_means = [sum(v) / len(v) for v in by_ward.values()]

    return Metrics(
        processing_time_ms=round(processing_time_ms, 3),
        gini_coefficient=round(gini(ward_means), 4),
        avg_response_time_estimate=round(sum(minutes) / len(minutes), 2),
        **queue_metrics,
    )


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# FCFS
# ---------------------------------------------------------------------------

@app.post("/prioritise/fcfs", response_model=PrioritiseResponse)
def prioritise_fcfs(payload: PrioritiseRequest):
    start = time.perf_counter()

    sorted_reports = sorted(payload.reports, key=lambda r: r.created_at)

    assignments: list[Assignment] = []
    for report in sorted_reports:
        worker = nearest_available_worker(report, payload.workers)
        if worker is not None:
            assignments.append(
                Assignment(report_id=report.id, worker_id=worker.id, score=1.0)
            )

    processing_time_ms = (time.perf_counter() - start) * 1000

    return PrioritiseResponse(
        algorithm="fcfs",
        prioritised_order=[r.id for r in sorted_reports],
        assignments=assignments,
        metrics=build_metrics(sorted_reports, payload.workers, processing_time_ms),
    )


# ---------------------------------------------------------------------------
# Greedy
# ---------------------------------------------------------------------------

@app.post("/prioritise/greedy", response_model=PrioritiseResponse)
def prioritise_greedy(payload: PrioritiseRequest):
    start = time.perf_counter()

    # score = (severity * 0.5) + (proximity * 0.5)
    #
    # Both terms are scaled to 0-1 first. The original 1/distance term is
    # unbounded and unit dependent (about 100 for a 0.01 degree gap), so it
    # swamped severity (1-5) and the ordering ignored severity. Here severity
    # is severity/5 and proximity comes from proximity_scores (see above).
    proximity = proximity_scores(payload.reports, payload.workers)
    scores = {
        r.id: (min(r.severity, 5) / 5) * 0.5 + proximity[r.id] * 0.5
        for r in payload.reports
    }
    sorted_reports = sorted(payload.reports, key=lambda r: scores[r.id], reverse=True)

    assignments: list[Assignment] = []
    for report in sorted_reports:
        worker = nearest_available_worker(report, payload.workers)
        if worker is not None:
            assignments.append(
                Assignment(report_id=report.id, worker_id=worker.id, score=round(scores[report.id], 6))
            )

    processing_time_ms = (time.perf_counter() - start) * 1000

    return PrioritiseResponse(
        algorithm="greedy",
        prioritised_order=[r.id for r in sorted_reports],
        assignments=assignments,
        metrics=build_metrics(sorted_reports, payload.workers, processing_time_ms),
    )


# ---------------------------------------------------------------------------
# Genetic algorithm (DEAP)
# ---------------------------------------------------------------------------

# High severity threshold used by the GA penalty term (severity 4 or 5 counts as high)
HIGH_SEVERITY_THRESHOLD = 4
UNSERVED_PENALTY = 1000.0  # large constant so unserved high-severity reports dominate fitness

POPULATION_SIZE = 50
DEFAULT_GENERATIONS = 50
MAX_GENERATIONS = 500
MAX_GA_REPORTS = 2000  # the pairwise distance matrix is n x n
CX_PROBABILITY = 0.7
MUT_PROBABILITY = 0.2


def build_ga_toolbox(reports: list[Report], workers: list[Worker]) -> base.Toolbox:
    """Chromosome: a permutation of report indices (the order reports are served).

    Fitness (minimised): sum over served reports of severity * minutes until a
    worker arrives, plus UNSERVED_PENALTY for every high-severity report with
    no available worker. Minutes accumulate travel along each worker's route,
    so the order of the chromosome changes the fitness: serving a severe
    report late, or zig-zagging between far apart reports, both cost more.

    Each report is attached to its nearest available worker (same rule as
    FCFS and Greedy), so the GA only decides the order.

    (The previous version summed each report's distance to its nearest worker,
    which is identical for every permutation, so the GA could not improve.)
    """
    n = len(reports)
    toolbox = base.Toolbox()

    # Locally flat km coordinates for the whole batch.
    mean_lat = sum(r.lat for r in reports) / n
    scale_x = KM_PER_DEGREE * math.cos(math.radians(mean_lat))
    xs = np.array([r.lng * scale_x for r in reports])
    ys = np.array([r.lat * KM_PER_DEGREE for r in reports])
    severity = np.array([min(r.severity, 5) for r in reports], dtype=float)

    available = [w for w in workers if w.available]
    served = np.zeros(n, dtype=bool)
    worker_idx = np.zeros(n, dtype=np.int64)
    first_leg_km = np.zeros(n)

    if available:
        wx = np.array([w.lng * scale_x for w in available])
        wy = np.array([w.lat * KM_PER_DEGREE for w in available])
        to_workers = np.hypot(xs[:, None] - wx[None, :], ys[:, None] - wy[None, :])
        worker_idx = to_workers.argmin(axis=1)
        first_leg_km = to_workers[np.arange(n), worker_idx]
        served[:] = True

    pair_km = np.hypot(xs[:, None] - xs[None, :], ys[:, None] - ys[None, :])

    unserved_high = sum(
        1
        for i, r in enumerate(reports)
        if not served[i] and r.severity >= HIGH_SEVERITY_THRESHOLD
    )
    constant_penalty = unserved_high * UNSERVED_PENALTY

    def evaluate(individual: list[int]) -> tuple[float]:
        perm = np.fromiter(individual, dtype=np.int64, count=n)
        perm = perm[served[perm]]
        if perm.size == 0:
            return (constant_penalty,)

        # Group by worker, keeping the chromosome order inside each group.
        order = np.argsort(worker_idx[perm], kind="stable")
        idx = perm[order]
        w = worker_idx[idx]

        starts = np.ones(idx.size, dtype=bool)
        starts[1:] = w[1:] != w[:-1]

        leg = first_leg_km[idx].copy()
        cont = np.nonzero(~starts)[0]
        leg[cont] = pair_km[idx[cont - 1], idx[cont]]

        cumulative = np.cumsum(leg)
        start_pos = np.nonzero(starts)[0]
        before_route = np.where(start_pos > 0, cumulative[start_pos - 1], 0.0)
        route_id = np.cumsum(starts) - 1
        minutes = (cumulative - before_route[route_id]) / TRAVEL_SPEED_KMH * 60

        return (float(np.dot(severity[idx], minutes)) + constant_penalty,)

    toolbox.register("indices", random.sample, range(n), n)
    toolbox.register("individual", tools.initIterate, creator.Individual, toolbox.indices)
    toolbox.register("population", tools.initRepeat, list, toolbox.individual)
    toolbox.register("evaluate", evaluate)
    toolbox.register("mate", tools.cxOrdered)
    toolbox.register("mutate", tools.mutShuffleIndexes, indpb=0.05)
    toolbox.register("select", tools.selTournament, tournsize=3)

    return toolbox


def run_genetic_algorithm(
    reports: list[Report], workers: list[Worker], generations: int
) -> list[int]:
    n = len(reports)
    if n < 3:
        # Too small to evolve (cxOrdered needs 2+ cut points). Try every order.
        toolbox = build_ga_toolbox(reports, workers)
        candidates = [list(range(n))] if n == 1 else [[0, 1], [1, 0]]
        return min(candidates, key=lambda c: toolbox.evaluate(c)[0])

    toolbox = build_ga_toolbox(reports, workers)

    population = toolbox.population(n=POPULATION_SIZE)
    for individual in population:
        individual.fitness.values = toolbox.evaluate(individual)

    # Elitism: the best order found so far is never lost.
    hall_of_fame = tools.HallOfFame(1)
    hall_of_fame.update(population)

    for _ in range(generations):
        offspring = toolbox.select(population, len(population))
        offspring = [toolbox.clone(ind) for ind in offspring]

        for child1, child2 in zip(offspring[::2], offspring[1::2]):
            if random.random() < CX_PROBABILITY:
                toolbox.mate(child1, child2)
                del child1.fitness.values
                del child2.fitness.values

        for mutant in offspring:
            if random.random() < MUT_PROBABILITY:
                toolbox.mutate(mutant)
                del mutant.fitness.values

        for ind in offspring:
            if not ind.fitness.valid:
                ind.fitness.values = toolbox.evaluate(ind)

        worst = max(range(len(offspring)), key=lambda k: offspring[k].fitness.values[0])
        offspring[worst] = toolbox.clone(hall_of_fame[0])

        population[:] = offspring
        hall_of_fame.update(population)

    return list(hall_of_fame[0])


@app.post("/prioritise/genetic", response_model=PrioritiseResponse)
def prioritise_genetic(payload: PrioritiseRequest):
    start = time.perf_counter()

    if not payload.reports:
        return PrioritiseResponse(
            algorithm="genetic",
            prioritised_order=[],
            assignments=[],
            metrics=Metrics(processing_time_ms=0.0),
        )

    if len(payload.reports) > MAX_GA_REPORTS:
        raise HTTPException(
            status_code=422,
            detail=f"genetic supports at most {MAX_GA_REPORTS} reports per request",
        )

    generations = payload.generations if payload.generations is not None else DEFAULT_GENERATIONS
    generations = max(0, min(generations, MAX_GENERATIONS))

    if payload.seed is not None:
        random.seed(payload.seed)

    best_order = run_genetic_algorithm(payload.reports, payload.workers, generations)
    sorted_reports = [payload.reports[i] for i in best_order]

    assignments: list[Assignment] = []
    for report in sorted_reports:
        worker = nearest_available_worker(report, payload.workers)
        if worker is not None:
            distance = euclidean_distance(report.lat, report.lng, worker.lat, worker.lng)
            # score kept consistent with a "higher is better" convention like the other endpoints
            score = 1 / distance if distance > 1e-9 else 1 / 1e-9
            assignments.append(
                Assignment(report_id=report.id, worker_id=worker.id, score=score)
            )

    processing_time_ms = (time.perf_counter() - start) * 1000

    return PrioritiseResponse(
        algorithm="genetic",
        prioritised_order=[r.id for r in sorted_reports],
        assignments=assignments,
        metrics=build_metrics(sorted_reports, payload.workers, processing_time_ms),
    )


# ---------------------------------------------------------------------------
# Hybrid (equity-aware)
# ---------------------------------------------------------------------------

DEFAULT_ALPHA = 0.4
# Efficiency weights from the agreed design: E = 0.4*severity + 0.3*waiting + 0.3*proximity.
EFFICIENCY_WEIGHTS = {"severity": 0.4, "waiting": 0.3, "proximity": 0.3}
# A report that has waited this long scores 1 on the waiting term. Fixed (not
# relative to the batch) so a lone old report is not stretched to look urgent.
WAIT_HORIZON_HOURS = 168.0  # 7 days, the length of the benchmark dataset

# Live alpha, changed through PATCH /prioritise/config. It is held in memory, so
# it returns to DEFAULT_ALPHA whenever the service restarts (Render free tier
# sleeps and redeploys). Every change is logged with a timestamp.
CONFIG_HISTORY_LIMIT = 100
config_logger = logging.getLogger("muniprioritise.config")
_config_lock = threading.Lock()
_config: dict = {"alpha": DEFAULT_ALPHA}
_config_history: list[dict] = []


def current_alpha() -> float:
    with _config_lock:
        return _config["alpha"]


def reset_config() -> None:
    """Back to the start-up state. Used by the tests."""
    with _config_lock:
        _config["alpha"] = DEFAULT_ALPHA
        _config_history.clear()


def parse_timestamp(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=422, detail=f"created_at is not an ISO 8601 timestamp: {value!r}")
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def resolve_alpha(alpha: float | None) -> float:
    """A request's own alpha wins. Otherwise use the live config value."""
    if alpha is None:
        return current_alpha()
    if not 0.0 <= alpha <= 1.0:
        raise HTTPException(status_code=422, detail="alpha must be between 0.0 and 1.0")
    return alpha


def waiting_scores(reports: list[Report]) -> dict[str, float]:
    """Hours waited as a share of WAIT_HORIZON_HOURS, capped at 1.

    "Now" is the newest created_at in the batch, not the system clock, so the
    same input always gives the same scores (benchmark runs are reproducible).
    """
    stamps = {r.id: parse_timestamp(r.created_at) for r in reports}
    now = max(stamps.values())
    return {
        rid: min(((now - ts).total_seconds() / 3600) / WAIT_HORIZON_HOURS, 1.0)
        for rid, ts in stamps.items()
    }


@app.post("/prioritise/hybrid", response_model=PrioritiseResponse)
def prioritise_hybrid(payload: PrioritiseRequest):
    start = time.perf_counter()
    alpha = resolve_alpha(payload.alpha)

    if not payload.reports:
        return PrioritiseResponse(
            algorithm="hybrid",
            prioritised_order=[],
            assignments=[],
            metrics=Metrics(processing_time_ms=0.0, equity_missing_count=0),
            alpha_used=alpha,
        )

    # Every term is on a 0 to 1 scale, so the weights mean what they say.
    proximity = proximity_scores(payload.reports, payload.workers)
    waiting = waiting_scores(payload.reports)

    efficiency: dict[str, float] = {}
    equity: dict[str, float] = {}
    final: dict[str, float] = {}
    missing = 0
    for r in payload.reports:
        efficiency[r.id] = (
            EFFICIENCY_WEIGHTS["severity"] * (min(r.severity, 5) / 5)
            + EFFICIENCY_WEIGHTS["waiting"] * waiting[r.id]
            + EFFICIENCY_WEIGHTS["proximity"] * proximity[r.id]
        )
        # Q is the ward's SAMPI score. No ward evidence means no equity boost.
        if r.equity_weight is None:
            missing += 1
            equity[r.id] = 0.0
        else:
            equity[r.id] = min(max(r.equity_weight, 0.0), 1.0)
        final[r.id] = (1 - alpha) * efficiency[r.id] + alpha * equity[r.id]

    # Highest score first. Ties go to the older report, then the id, so the order is deterministic.
    sorted_reports = sorted(
        payload.reports, key=lambda r: (-final[r.id], r.created_at, r.id)
    )

    assignments: list[Assignment] = []
    for report in sorted_reports:
        worker = nearest_available_worker(report, payload.workers)
        if worker is not None:
            assignments.append(
                Assignment(
                    report_id=report.id,
                    worker_id=worker.id,
                    score=round(final[report.id], 6),
                    efficiency_score=round(efficiency[report.id], 6),
                    equity_score=round(equity[report.id], 6),
                )
            )

    processing_time_ms = (time.perf_counter() - start) * 1000
    metrics = build_metrics(sorted_reports, payload.workers, processing_time_ms)
    metrics.equity_missing_count = missing

    return PrioritiseResponse(
        algorithm="hybrid",
        prioritised_order=[r.id for r in sorted_reports],
        assignments=assignments,
        metrics=metrics,
        alpha_used=alpha,
    )


class ConfigUpdate(BaseModel):
    alpha: float = Field(ge=0.0, le=1.0)
    changed_by: str | None = None  # who asked, for the log (the backend passes the supervisor id)


def config_view() -> dict:
    with _config_lock:
        return {
            "alpha": _config["alpha"],
            "default_alpha": DEFAULT_ALPHA,
            "efficiency_weights": dict(EFFICIENCY_WEIGHTS),
            "wait_horizon_hours": WAIT_HORIZON_HOURS,
            "history": list(_config_history),
        }


@app.get("/prioritise/config")
def get_config():
    return config_view()


@app.patch("/prioritise/config")
def patch_config(update: ConfigUpdate, x_config_key: str | None = Header(default=None)):
    # The service URL is public. If CONFIG_API_KEY is set (it should be on Render),
    # only callers that send the same value in X-Config-Key may change alpha.
    required_key = os.environ.get("CONFIG_API_KEY")
    if required_key and not secrets.compare_digest(x_config_key or "", required_key):
        raise HTTPException(status_code=403, detail="missing or invalid X-Config-Key")

    with _config_lock:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "old_alpha": _config["alpha"],
            "new_alpha": update.alpha,
            "changed_by": update.changed_by,
        }
        _config["alpha"] = update.alpha
        _config_history.append(entry)
        del _config_history[:-CONFIG_HISTORY_LIMIT]

    config_logger.info(
        "alpha changed %s -> %s by %s", entry["old_alpha"], entry["new_alpha"], entry["changed_by"]
    )
    return config_view()


@app.post("/prioritise/compare")
def prioritise_compare(payload: PrioritiseRequest):
    return {
        "fcfs": prioritise_fcfs(payload),
        "greedy": prioritise_greedy(payload),
        "genetic": prioritise_genetic(payload),
        "hybrid": prioritise_hybrid(payload),
    }