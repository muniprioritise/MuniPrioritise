import time
import math
import random

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
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


class Metrics(BaseModel):
    processing_time_ms: float
    gini_coefficient: float | None = None
    avg_response_time_estimate: float | None = None  # minutes
    # Defined in Phase 3 (P3-05). Kept here so the output matches docs/api-contracts.md.
    high_severity_rate: float | None = None
    low_income_coverage: float | None = None


class PrioritiseResponse(BaseModel):
    algorithm: str
    prioritised_order: list[str]
    assignments: list[Assignment]
    metrics: Metrics


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


def build_metrics(
    ordered_reports: list[Report], workers: list[Worker], processing_time_ms: float
) -> Metrics:
    """Metrics shared by every algorithm so they can be compared like for like.

    avg_response_time_estimate: mean minutes until a worker reaches each report.
    gini_coefficient: inequality of the *average* response time between wards
    (0 = every ward waits the same time on average).
    """
    served = simulate_response_times(ordered_reports, workers)
    if not served:
        return Metrics(processing_time_ms=round(processing_time_ms, 3))

    minutes = [m for _, _, m in served]
    by_ward: dict[str, list[float]] = {}
    for report, _, m in served:
        by_ward.setdefault(report.ward_id, []).append(m)
    ward_means = [sum(v) / len(v) for v in by_ward.values()]

    return Metrics(
        processing_time_ms=round(processing_time_ms, 3),
        gini_coefficient=round(gini(ward_means), 4),
        avg_response_time_estimate=round(sum(minutes) / len(minutes), 2),
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
    # is severity/5 and proximity is 1 for the closest report in the batch and
    # 0 for the furthest. Reports with no available worker get proximity 0.
    distances: dict[str, float | None] = {}
    for report in payload.reports:
        worker = nearest_available_worker(report, payload.workers)
        distances[report.id] = (
            None
            if worker is None
            else euclidean_distance(report.lat, report.lng, worker.lat, worker.lng)
        )

    known = [d for d in distances.values() if d is not None]
    d_min = min(known) if known else 0.0
    d_max = max(known) if known else 0.0
    spread = d_max - d_min

    def greedy_score(report: Report) -> float:
        d = distances[report.id]
        if d is None:
            proximity = 0.0
        elif spread <= 1e-9:
            proximity = 1.0
        else:
            proximity = 1.0 - (d - d_min) / spread
        return (min(report.severity, 5) / 5) * 0.5 + proximity * 0.5

    scores = {r.id: greedy_score(r) for r in payload.reports}
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


@app.post("/prioritise/compare")
def prioritise_compare(payload: PrioritiseRequest):
    return {
        "fcfs": prioritise_fcfs(payload),
        "greedy": prioritise_greedy(payload),
        "genetic": prioritise_genetic(payload),
    }
