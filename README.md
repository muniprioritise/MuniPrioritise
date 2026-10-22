# MuniPrioritise

Equity-aware service request management for South African municipalities. Residents report problems such as water leaks, potholes and missed refuse collection. A hybrid prioritisation algorithm orders the work queue by severity, waiting time and distance, and by how deprived the ward is (the ward's SAMPI score). The hybrid is benchmarked against first come first served (FCFS), Greedy and Genetic baselines.

Capstone project for ITDMA3-22 and ITMDA3-34 at Eduvos.

## Live system

| Part | Address |
|---|---|
| Supervisor dashboard | https://muni-prioritise.vercel.app |
| Backend API | https://muniprioritise-1vgj.onrender.com (`GET /health`) |
| Algorithm service | https://muniprioritise.onrender.com (`GET /health`, `/docs`) |

Demo video: https://youtu.be/KZBVOa8-HuQ

The backend and algorithm service run on a free tier. The first request after a quiet period can take up to a minute.

## What it does

- **Residents** (mobile app) submit a report with category, severity, location and photos, follow its status and rate the resolution.
- **Workers** (mobile app) get a prioritised queue, accept jobs, resolve them with photo evidence or escalate them.
- **Supervisors** (web dashboard) see the queue, a map, analytics and the benchmark, and can reassign a job. Every override is logged with a reason.

## How the prioritisation works

```
E     = 0.4 * severity/5 + 0.3 * waiting + 0.3 * proximity
Q     = the ward's SAMPI score (0 to 1)
score = (1 - alpha) * E + alpha * Q          default alpha = 0.4
```

On 10 synthetic datasets of 500 requests, the hybrid at alpha 0.4 placed 71% of low-income-ward requests in the top half of the queue, against about 50% for the three baselines. It serves severe requests later than Greedy and is slower on average response than the Genetic algorithm. That is the cost of weighting equity. The full method, results and limitations are in [`docs/ALGORITHM.md`](docs/ALGORITHM.md).

## Structure

| Folder | Content |
|---|---|
| [`mobile/`](mobile/README.md) | Expo (React Native) app for residents and workers |
| [`dashboard/`](dashboard/README.md) | React, Vite and Tailwind supervisor dashboard |
| [`backend/`](backend/README.md) | Node.js and Express API |
| [`algorithm/`](algorithm/README.md) | Python and FastAPI service with the four algorithms and the benchmark |
| `database/` | PostgreSQL schema, ward data and the benchmark dataset |
| `docs/` | [API contracts](docs/api-contracts.md) and [algorithm write-up](docs/ALGORITHM.md) |

## Run it locally

You need Node.js 20, Python 3.11 and Docker. Start each part in its own terminal.

**1. Environment.** `.env.example` lists every variable. Copy the backend section to `backend/.env` and the dashboard section to `dashboard/.env`.

**2. Database.**

```
docker-compose up -d
```

This starts PostgreSQL with PostGIS and creates the schema and the ward data. pgAdmin is at `http://localhost:5050`.

**3. Algorithm service.**

```
cd algorithm
python -m venv venv
venv\Scripts\activate           # macOS and Linux: source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

**4. Backend.**

```
cd backend
npm install
npm start
```

It listens on `http://localhost:3000`.

**5. Dashboard.**

```
cd dashboard
npm install
npm run dev
```

Set `VITE_API_BASE_URL=http://localhost:3000` in `dashboard/.env`. It opens on `http://localhost:5173`.

**6. Mobile app.**

```
cd mobile
npm install
npx expo start
```

The app uses the hosted backend. To use a local one, change `API_BASE_URL` in `mobile/config/api.ts`. On an Android emulator the host machine is `10.0.2.2`.

## Tests

```
cd algorithm && python -m pytest -q          # algorithm and benchmark
python -m pytest database/seed -q            # benchmark dataset
```

## Accounts

Residents register in the mobile app. Worker and supervisor accounts are created through `POST /api/auth/register` with a `role` field. Demo accounts for marking are listed in the submission document.

## Known limitations

- All request data and ward SAMPI scores are synthetic. The scores are illustrative and are not published StatsSA values.
- In the live system the worker positions used for the proximity term are fixed stand-ins, because the app does not track worker locations.
- Registration does not restrict the `worker` and `supervisor` roles.
- The alpha setting is held in memory and resets to 0.4 when the algorithm service restarts.

## Contributing

Work happens on `feature/...` or `chore/...` branches off `develop`, merged by pull request. Commits follow `type(scope): description`.