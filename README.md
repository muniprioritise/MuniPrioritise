# MuniPrioritise

**Equity-Aware Municipal Service Request Management App**

A mobile application for South African municipalities to manage service delivery requests across water, electricity, roads, refuse collection, and sanitation. The system uses a hybrid prioritisation algorithm that balances operational efficiency with socioeconomic equity, weighting historically underserved areas using SAMPI-derived indicators.

Built as a group capstone project for ITDMA3-22 — Research Design and Methodology, Eduvos.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native + Expo |
| Web Dashboard | React + Vite + Tailwind CSS |
| Backend API | Node.js + Express |
| Database | PostgreSQL + PostGIS |
| Algorithm Service | Python + FastAPI |
| Authentication | JWT + bcrypt |
| Maps (mobile) | react-native-maps |
| Maps (dashboard) | React Leaflet + OpenStreetMap |
| Hosting | Render (backend + algorithm), Vercel (dashboard) |

---

## Project Structure

```
muniprioritise/
├── mobile/          # React Native + Expo (resident + worker app)
├── dashboard/       # React + Vite + Tailwind (supervisor web dashboard)
├── backend/         # Node.js + Express (REST API)
├── algorithm/       # Python + FastAPI (prioritisation microservice)
├── docs/            # API contracts, architecture diagrams, documentation
└── database/        # SQL migration files and seed data
```

---

## Prerequisites

Make sure you have the following installed before running any service:

- [Node.js 20 LTS](https://nodejs.org/)
- [Python 3.11+](https://www.python.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL)
- [Expo Go](https://expo.dev/client) on your phone, or an Android/iOS emulator
- Git

---

## Running the Project Locally

### 1. Clone the repo

```bash
git clone https://github.com/muniprioritise/muniprioritise.git
cd muniprioritise
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your local values. See `.env.example` for descriptions of each variable.

### 3. Start the database

```bash
docker-compose up -d
```

This starts a PostgreSQL + PostGIS instance on port 5432. Make sure Docker Desktop is running first.

### 4. Start the backend API

```bash
cd backend
npm install
npm run dev
```

Runs on `http://localhost:3000`

### 5. Start the algorithm service

```bash
cd algorithm
python -m venv venv
source venv/bin/activate        # Mac/Linux
# venv\Scripts\activate         # Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

Runs on `http://localhost:8000`

### 6. Start the mobile app

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `a` for Android emulator / `i` for iOS simulator.

### 7. Start the dashboard

```bash
cd dashboard
npm install
npm run dev
```

Runs on `http://localhost:5173`

---

## Team

| Role | Responsibility |
|---|---|
| Project Lead / Algorithm Researcher | Algorithm design, benchmarking, research writing |
| Mobile Developer — Resident App | React Native resident-facing screens |
| Mobile Developer — Worker App | React Native worker-facing screens |
| Backend Developer | Node.js API, database, authentication |
| Frontend / Integration / QA Lead | Web dashboard, system integration, testing |

---

## Branching Strategy

This project uses GitFlow:

- `main` — stable, submission-ready code only
- `develop` — integration branch, all features merge here
- `feature/description` — individual feature branches, branched off develop
- `hotfix/description` — urgent fixes to main only

All changes go through a Pull Request. No direct pushes to `main` or `develop`.

---

## Documentation

- [API Contracts](./docs/api-contracts.md) — full endpoint reference
- [Algorithm Design](./docs/algorithm.md) — hybrid algorithm explanation and equity weighting
- [Database Schema](./docs/schema.sql) — full PostgreSQL schema

---

## Notes

- No real municipal data is used. All data is synthetic, based on publicly available StatsSA / SAMPI 2022 datasets.
- This is a research prototype. It is not deployed to a live municipality.
- All submissions go through Turnitin. Do not use AI tools to generate proposal or dissertation content.