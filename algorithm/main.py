import time
import math

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


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