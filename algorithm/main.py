import time
import math

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


# ── Schemas (match docs/api-contracts.md — do not change without updating that file) ──

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


# ── Helpers ──

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


# ── Endpoints ──

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