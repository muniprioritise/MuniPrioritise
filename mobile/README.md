# Mobile app

Expo (React Native) app for residents and workers. Both sign in on the same screen and land on different home screens.

- **Residents** submit a report with a category, severity, location and photos, follow its status, get notified of changes and rate the resolution.
- **Workers** see their prioritised job queue, accept a job, resolve it with photo evidence, or escalate it with a note.

Supervisors use the [web dashboard](../dashboard/README.md). A supervisor account that signs in here is sent to a page that points them to the dashboard.

## Run it

Node.js 20, from this folder:

```
npm install
npx expo start
```

Press `a` for an Android emulator, or scan the QR code with Expo Go. The app talks to the live backend at `https://muniprioritise-1vgj.onrender.com`. To use a local backend, change `API_BASE_URL` in `config/api.ts`.

The first request after a quiet period can take up to a minute while the free-tier server wakes up.

## Structure

| Folder | Content |
|---|---|
| `app/` | Screens, using Expo Router file-based routes. `(tabs)` is the resident area, `jobs` is the worker area |
| `components/` | Shared UI |
| `services/` | API calls for auth, reports, jobs and notifications |
| `contexts/` | Auth state |
| `config/api.ts` | Axios instance that attaches the login token |
| `types/`, `utils/`, `constants/` | Types, helpers and theme |

## Limitations

- Push notifications need a development or production build. They do not work in Expo Go.
- The notification list is built from the status changes on the resident's own reports. The backend does not store notifications.
