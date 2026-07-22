from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


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
        "reports": [
            {"id": "r1", "category": "water", "severity": 3, "created_at": "2026-07-20T10:00:00Z", "lat": -33.92, "lng": 18.42, "ward_id": "CPT-001"},
        ],
        "workers": [
            {"id": "w1", "lat": -33.92, "lng": 18.42, "available": False},
        ],
    }

    response = client.post("/prioritise/fcfs", json=payload)
    body = response.json()
    assert body["prioritised_order"] == ["r1"]
    assert body["assignments"] == []