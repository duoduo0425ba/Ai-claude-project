# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**零花钱记账** — A pocket money tracking app with a React frontend and Express/SQLite backend, packaged as a macOS `.app` via `build_app.sh`.

## Commands

**Run both frontend and backend (development):**
```bash
npm run dev
```

**Run server only:**
```bash
npm run server   # cd server && node index.js, port 5001
```

**Run client only:**
```bash
npm run client   # cd client && vite, port 5173
```

**Build frontend for production:**
```bash
npm run build    # outputs to client/dist/
```

**Lint frontend:**
```bash
cd client && npm run lint
```

**No tests are configured** — `server/package.json` has a placeholder test script only.

## Architecture

### Frontend (`client/`)
- React 19 + Vite, with React Router for three pages: `/` (HomePage), `/list` (ListPage), `/report` (ReportPage)
- All API calls go through `src/api/index.js`, which proxies `/api/*` to `http://localhost:5001` via Vite's dev proxy
- Charts use Chart.js via `react-chartjs-2`; Excel export uses the `xlsx` library (`src/utils/excel.js`)
- `SakuraEffect` is a decorative animation component rendered globally in `App.jsx`

### Backend (`server/`)
- Express 5 with a single router file: `routes/transactions.js`
- **All routes** (transactions CRUD, stats, and settings) are mounted under `/api/transactions`:
  - `GET/POST /api/transactions` — list with filters / create record
  - `DELETE /api/transactions/:id` — delete
  - `POST /api/transactions/batch` — bulk import
  - `GET /api/transactions/stats/daily|weekly|monthly|yearly` — aggregation stats
  - `GET /api/transactions/stats/budget` — budget status with warn/danger thresholds
  - `GET|PUT /api/transactions/settings` — app settings
- SQLite database (`server/data.db`) via `better-sqlite3`; WAL mode enabled
- `db.js` initializes the schema and seeds default settings (`monthly_income=300`, `warn_threshold=200`, `danger_threshold=270`)

### API response shape
All endpoints return `{ success: true, data: ... }` on success or `{ success: false, error: "..." }` on failure.

### macOS App
`build_app.sh` compiles an AppleScript launcher into a `.app` bundle that starts the dev server and opens the browser. Run it to regenerate the desktop app icon and launcher.
