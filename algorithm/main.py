import time
import math
import random

from fastapi import FastAPI
from pydantic import BaseModel
from deap import base, creator, tools

app = FastAPI()

# DEAP requires these to be created once at module level, not per-request.
# FitnessMin because we're minimising total distance + penalty.
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


class Assignment(BaseModel):
    report_id: str
    worker_id: str
    score: float


class Metrics(BaseModel):
    processing_time_ms: float
    gini_coefficient: float | None = None
    avg_response_time_estimate: float | None = None


class PrioritiseResponse(BaseModel):
    algorithm: str
    prioritised_order: list[str]
    assignments: list[Assignment]
    metrics: Metrics


# Shared helpers used by every algorithm endpoint

def euclidean_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    return math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2)


def nearest_available_worker(report: Report, workers: list[Worker]) -> Worker | None:
    available = [w for w in workers if w.available]
    if not available:
        return None
    return min(
        available,
        key=lambda w: euclidean_distance(report.lat, report.lng, w.lat, w.lng),
    )


@app.get("/health")
def health():
    return {"status": "ok"}


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
        metrics=Metrics(processing_time_ms=round(processing_time_ms, 3)),
    )


@app.post("/prioritise/greedy", response_model=PrioritiseResponse)
def prioritise_greedy(payload: PrioritiseRequest):
    start = time.perf_counter()

    def greedy_score(report: Report) -> float:
        worker = nearest_available_worker(report, payload.workers)
        if worker is None:
            distance = float("inf")
        else:
            distance = euclidean_distance(report.lat, report.lng, worker.lat, worker.lng)

        # avoid divide-by-zero if report and worker share the same coordinates
        distance_component = 1 / distance if distance > 1e-9 else 1 / 1e-9

        return (report.severity * 0.5) + (distance_component * 0.5)

    sorted_reports = sorted(payload.reports, key=greedy_score, reverse=True)

    assignments: list[Assignment] = []
    for report in sorted_reports:
        worker = nearest_available_worker(report, payload.workers)
        if worker is not None:
            assignments.append(
                Assignment(report_id=report.id, worker_id=worker.id, score=greedy_score(report))
            )

    processing_time_ms = (time.perf_counter() - start) * 1000

    return PrioritiseResponse(
        algorithm="greedy",
        prioritised_order=[r.id for r in sorted_reports],
        assignments=assignments,
        metrics=Metrics(processing_time_ms=round(processing_time_ms, 3)),
    )


# High severity threshold used by the GA penalty term (severity 4 or 5 counts as high)
HIGH_SEVERITY_THRESHOLD = 4
UNSERVED_PENALTY = 1000.0  # large constant so unserved high-severity reports dominate fitness

POPULATION_SIZE = 50
DEFAULT_GENERATIONS = 50
CX_PROBABILITY = 0.7
MUT_PROBABILITY = 0.2


def build_ga_toolbox(reports: list[Report], workers: list[Worker]) -> base.Toolbox:
    toolbox = base.Toolbox()
    n = len(reports)

    toolbox.register("indices", random.sample, range(n), n)
    toolbox.register("individual", tools.initIterate, creator.Individual, toolbox.indices)
    toolbox.register("population", tools.initRepeat, list, toolbox.individual)

    def evaluate(individual: list[int]) -> tuple[float]:
        total_distance = 0.0
        unserved_high_severity = 0

        for idx in individual:
            report = reports[idx]
            worker = nearest_available_worker(report, workers)

            if worker is None:
                if report.severity >= HIGH_SEVERITY_THRESHOLD:
                    unserved_high_severity += 1
                continue

            total_distance += euclidean_distance(report.lat, report.lng, worker.lat, worker.lng)

        fitness = total_distance + (unserved_high_severity * UNSERVED_PENALTY)
        return (fitness,)

    toolbox.register("evaluate", evaluate)
    toolbox.register("mate", tools.cxOrdered)
    toolbox.register("mutate", tools.mutShuffleIndexes, indpb=0.05)
    toolbox.register("select", tools.selTournament, tournsize=3)

    return toolbox


def run_genetic_algorithm(
    reports: list[Report], workers: list[Worker], generations: int
) -> list[int]:
    toolbox = build_ga_toolbox(reports, workers)

    population = toolbox.population(n=POPULATION_SIZE)
    for individual in population:
        individual.fitness.values = toolbox.evaluate(individual)

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

        invalid = [ind for ind in offspring if not ind.fitness.valid]
        for ind in invalid:
            ind.fitness.values = toolbox.evaluate(ind)

        population[:] = offspring

    best = tools.selBest(population, 1)[0]
    return list(best)


@app.post("/prioritise/genetic", response_model=PrioritiseResponse)
def prioritise_genetic(payload: PrioritiseRequest):
    start = time.perf_counter()

    generations = payload.generations if payload.generations is not None else DEFAULT_GENERATIONS

    if not payload.reports:
        return PrioritiseResponse(
            algorithm="genetic",
            prioritised_order=[],
            assignments=[],
            metrics=Metrics(processing_time_ms=0.0),
        )

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
        metrics=Metrics(processing_time_ms=round(processing_time_ms, 3)),
    )