
Readme · MD
# MuniPrioritise
 
Equity-aware municipal service request management for South African municipalities. Hybrid prioritisation algorithm balances operational efficiency against ward-level socioeconomic need (SAMPI), benchmarked against FCFS, Greedy, and Genetic Algorithm baselines.
 
Capstone project — ITDMA3-22 (Research Design & Methodology) and ITMDA3-34 (Project: Mobile Application and Web Services), Eduvos.
 
## Team
 
| Role | Member |
|---|---|
| Algorithm Lead | Handre |
| Backend Developer | Jordan |
| Mobile Developer 1 | Michael |
| Mobile Developer 2 | Jan |
| Frontend/QA Lead | Tristan |
 
## Project Structure
 
```
muniprioritise/
├── mobile/              # React Native + Expo (resident and worker apps)
├── dashboard/           # React + Vite + Tailwind
├── backend/              # Node.js + Express API
├── algorithm/            # Python + FastAPI microservice (DEAP genetic algorithm)
├── database/             # SQL migrations and seed files
└── docs/                 # API contracts, architecture diagrams, build plan
```
 
## Prerequisites
 
- Node.js 20 LTS
- Python 3.11+
- Docker + Docker Compose
- Expo Go app (for testing mobile on device) or Android emulator
## Quick Start
 
### 1. Clone and configure environment
 
```bash
git clone https://github.com/muniprioritise/MuniPrioritise.git
cd MuniPrioritise
cp .env.example .env
```
 
Fill in `.env` with your local values (DB credentials, JWT secret, API base URLs). Ask Handre for shared secrets if any are missing.
 
### 2. Start the database
 
```bash
docker-compose up -d
```
 
This starts PostgreSQL 15 with PostGIS 3.3 and pgAdmin. Seed ward data (SAMPI scores) loads automatically on first run. Check pgAdmin at `http://localhost:5050` to confirm.
 
### 3. Backend (Node.js + Express)
 
```bash
cd backend
npm install
npm run dev
```
 
Runs on `http://localhost:3000`. Confirm with `GET /health`.
 
### 4. Algorithm service (Python + FastAPI)
 
```bash
cd algorithm
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
 
Runs on `http://localhost:8000`. Confirm with `GET /health`.
 
### 5. Dashboard (React + Vite)
 
```bash
cd dashboard
npm install
npm run dev
```
 
Runs on `http://localhost:5173`.
 
### 6. Mobile (Expo)
 
```bash
cd mobile
npm install
npx expo start
```
 
Scan the QR code with Expo Go, or press `a` for Android emulator. Update the API base URL in `app.config.js` to point at your local backend (or the Render-hosted one — check `.env.example`).
 
## You're set up when
 
- All four services run locally without errors
- A "hello world" request travels: mobile app → backend → database → response shown in app
- `GET /health` returns 200 on both backend and algorithm service
If backend isn't ready yet and you're blocked, use `json-server` with a mock `db.json` — several sprint issues already note this fallback. Don't wait idle on a blocked dependency; flag it and work around it.
 
## Branching & Contributing
 
We use GitFlow:
 
- `main` — production-ready, protected, no direct pushes
- `develop` — integration branch, all feature branches merge here via PR
- `feature/xxx` — your work branch, e.g. `feature/p1-05-resident-submit-screen`
- `hotfix/xxx` — urgent fixes only
**Workflow:**
1. Branch off `develop`: `git checkout -b feature/p1-05-resident-submit-screen`
2. Commit and push your branch
3. Open a PR into `develop` using the PR template — fill it in, don't skip it
4. Wait for review before merging. Don't push directly to `develop` or `main`.
## Project Board
 
All remaining work is tracked as GitHub Issues on the Projects board, organised by phase (P0–P4). Each issue has an assignee, labels, milestone, and a due date. Check your assigned issues and the due date before starting — some have notes on how to work around blocked dependencies (e.g. mocking an API that isn't live yet).
 
## Documentation
 
- [`docs/api-contracts.md`](docs/api-contracts.md) — every endpoint shape, defined before building
- [`docs/MuniPrioritise_Build_Plan.md`](docs/MuniPrioritise_Build_Plan.md) — full phase-by-phase build plan
- [`docs/ALGORITHM.md`](docs/ALGORITHM.md) — hybrid algorithm design (added in Phase 4)
