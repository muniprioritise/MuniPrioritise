# Supervisor dashboard

React and Vite web app for municipal supervisors. It shows the open request queue, the map, analytics, the override audit trail and the algorithm benchmark. Supervisors can reassign a job to another worker, with a reason that is logged.

Only accounts with the `supervisor` role can sign in. Residents and workers use the mobile app.

Live: https://muni-prioritise.vercel.app

## Run it

Node.js 20, from this folder:

```
npm install
npm run dev
```

Create a `.env` file with the backend address. Do not add `/api`, the app adds it:

```
VITE_API_BASE_URL=http://localhost:3000
```

Vite reads this at build time, so rebuild after changing it.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build into `dist` |
| `npm run lint` | ESLint |
| `npm run sync:benchmark` | Copy `database/seed/benchmark_results.json` into `src/utils` for the benchmark page |

## Pages

| Route | Content |
|---|---|
| `/overview` | KPI cards |
| `/request-table` | Request table with filters and CSV export |
| `/request-map` | Requests on a map |
| `/analytics` | Response time, requests over time, ward equity |
| `/reports` | Summary with PDF export |
| `/prioritisation-override` | Prioritised queue, worker reassignment, audit log |
| `/benchmarks` | Benchmark comparison of the four algorithms |
