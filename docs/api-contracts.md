# MuniPrioritise — API Contracts

> This document is the source of truth for all API endpoint shapes.
> Before building any API call in mobile or dashboard, check here first.
> Do not invent endpoint shapes — if something is missing, add it here and notify the team.

All endpoints are prefixed with `/api/v1`.

Base URL (local): `http://localhost:3000/api/v1`

---

## Authentication

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Register a new user |
| POST | `/auth/login` | No | Login, returns JWT access token |
| GET | `/auth/me` | Yes | Get own profile |

### POST /auth/register — Request body
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "Jane Smith",
  "role": "resident",
  "phone": "0821234567"
}
```

### POST /auth/login — Request body
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### POST /auth/login — Response
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "resident",
    "full_name": "Jane Smith"
  }
}
```

---

## Reports

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/reports` | Yes (resident) | Submit a new service request |
| GET | `/reports` | Yes (any) | List reports (filtered by role) |
| GET | `/reports/:id` | Yes (any) | Get a single report with full detail |
| PATCH | `/reports/:id/status` | Yes (worker) | Update report status |
| POST | `/reports/:id/evidence` | Yes (worker) | Upload completion photos and notes |
| PATCH | `/reports/:id/rating` | Yes (resident) | Submit resolution rating (1–5) |

### POST /reports — Request body
```json
{
  "category": "water",
  "description": "No water supply for 3 days",
  "severity": 4,
  "lat": -33.9249,
  "lng": 18.4241,
  "photo_urls": ["https://res.cloudinary.com/..."]
}
```

### GET /reports — Query parameters (all optional)
```
?status=pending
?category=water
?ward_id=CPT-001
?from=2025-01-01
?to=2025-12-31
```

### Report object (returned in responses)
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "category": "water",
  "description": "No water supply for 3 days",
  "severity": 4,
  "status": "pending",
  "lat": -33.9249,
  "lng": 18.4241,
  "ward_id": "CPT-001",
  "photo_urls": ["https://res.cloudinary.com/..."],
  "resolution_rating": null,
  "created_at": "2025-03-01T08:00:00Z",
  "updated_at": "2025-03-01T08:00:00Z"
}
```

### PATCH /reports/:id/status — Request body
```json
{
  "status": "in_progress",
  "notes": "On site, investigating"
}
```
Valid statuses: `pending` → `assigned` → `in_progress` → `resolved` / `escalated`

---

## Jobs (Worker)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/jobs` | Yes (worker) | Get prioritised job queue for calling worker |
| PATCH | `/jobs/:id/accept` | Yes (worker) | Accept a job |
| PATCH | `/jobs/:id/escalate` | Yes (worker) | Flag job for escalation |

### GET /jobs — Response
```json
{
  "algorithm": "hybrid",
  "jobs": [
    {
      "id": "uuid",
      "report_id": "uuid",
      "priority_score": 0.87,
      "efficiency_score": 0.75,
      "equity_score": 0.92,
      "report": { ...report object... }
    }
  ]
}
```

---

## Supervisor

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/supervisor/overview` | Yes (supervisor) | KPI summary stats |
| POST | `/supervisor/override` | Yes (supervisor) | Manually reassign a job |
| GET | `/supervisor/analytics` | Yes (supervisor) | Time-series and distribution data |
| GET | `/supervisor/audit` | Yes (supervisor) | Log of all overrides and prioritisation decisions |

### GET /supervisor/overview — Response
```json
{
  "total_open": 142,
  "avg_response_time_hours": 6.4,
  "resolution_rate_percent": 78.3,
  "equity_score": 0.61
}
```

### POST /supervisor/override — Request body
```json
{
  "job_id": "uuid",
  "new_worker_id": "uuid",
  "reason": "Specialist required for this repair type"
}
```

---

## Algorithm Service

> These endpoints are called internally by the Node.js backend — not directly by mobile or dashboard.

Base URL (local): `http://localhost:8000`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/prioritise/fcfs` | Run FCFS algorithm |
| POST | `/prioritise/greedy` | Run Greedy algorithm |
| POST | `/prioritise/genetic` | Run Genetic Algorithm |
| POST | `/prioritise/hybrid` | Run Hybrid algorithm (live system) |
| POST | `/prioritise/compare` | Run all four, return side-by-side metrics |
| GET | `/health` | Service health check |

### Input schema (all algorithms)
```json
{
  "reports": [
    {
      "id": "uuid",
      "category": "water",
      "severity": 4,
      "created_at": "2025-03-01T08:00:00Z",
      "lat": -33.9249,
      "lng": 18.4241,
      "ward_id": "CPT-001",
      "equity_weight": 0.85
    }
  ],
  "workers": [
    {
      "id": "uuid",
      "lat": -33.9100,
      "lng": 18.4100,
      "available": true
    }
  ],
  "alpha": 0.4
}
```

### Output schema (all algorithms)
```json
{
  "algorithm": "hybrid",
  "prioritised_order": ["uuid1", "uuid3", "uuid2"],
  "assignments": [
    {
      "report_id": "uuid1",
      "worker_id": "worker-uuid",
      "score": 0.87
    }
  ],
  "metrics": {
    "processing_time_ms": 12,
    "gini_coefficient": 0.31,
    "avg_response_time_estimate": 14.2,
    "high_severity_rate": 0.91,
    "low_income_coverage": 0.74
  }
}
```

---

## Status Codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created successfully |
| 400 | Bad request — missing or invalid fields |
| 401 | Unauthorised — missing or invalid JWT |
| 403 | Forbidden — correct JWT but wrong role |
| 404 | Resource not found |
| 500 | Internal server error |

---

## Auth Header Format

All authenticated requests must include:
```
Authorization: Bearer <your-jwt-token>
```

---

*Last updated: Phase 0 setup. Update this document whenever endpoints change — do not let it drift from the actual implementation.*