# CLAUDE.md

Guidance for developers working on **零花钱记账** with Claude Code or other AI assistants.

## Project Overview

**零花钱记账** (Pocket Money Tracker) — A full-featured React + Express personal finance tracking app with:
- 📱 Responsive UI with dark mode support
- 📊 Rich data visualization (charts, stats, trends)
- 💾 Excel import/export functionality
- ⚙️ Customizable categories and budget tracking
- 📦 Packagable as macOS `.app` via `build_app.sh`

## Quick Start

```bash
npm run dev          # Start both server (port 5001) + client (port 5173)
npm run server       # Backend only
npm run client       # Frontend only
npm run build        # Build for production
```

## Architecture

### Frontend (`client/`) — React 19 + Vite

**Pages (4):**
- `/` — **HomePage**: Quick transaction entry, daily summary, total balance, budget alert
- `/list` — **ListPage**: Transaction history with search, filtering, pagination, edit/delete
- `/report` — **ReportPage**: Charts (weekly/monthly/yearly), category breakdown, statistics
- `/settings` — **SettingsPage**: Budget config, initial balance, custom category management

**Key Components:**
- `CategoryPicker.jsx` — Loads categories from API (fallback to hardcoded defaults)
- `TransactionForm.jsx` & `EditTransactionForm.jsx` — Transaction CRUD
- `DailySummary.jsx` & `BalanceSummary.jsx` — Daily & cumulative balance display
- `BudgetAlert.jsx` — Monthly expense status with warn/danger thresholds
- `ToastContainer.jsx` — Global toast notifications

**Features:**
- Dark mode: responds to `@media (prefers-color-scheme: dark)`
- Smart empty states: distinguishes "no data" vs "no results" (after filtering)
- Client-side pagination: 30 items/page with prev/next buttons
- Local storage: remembers category filter preference
- Request deduplication: AbortController prevents race conditions
- Keyboard shortcuts: Escape closes modals

**Styling:**
- Design tokens (CSS custom properties) with pastel sakura/lavender/mint colors
- Glass-morphism cards, smooth animations
- Fully responsive layout

**API Layer (`src/api/index.js`):**
All requests proxied via Vite dev proxy to `http://localhost:5001`:
- Transactions: `getTransactions`, `addTransaction`, `updateTransaction`, `deleteTransaction`, `batchImport`
- Stats: `getDailySummary`, `getWeeklyStats`, `getMonthlyStats`, `getYearlyStats`, `getBudgetStatus`, `getTotalBalance`
- Categories: `getCategories`, `addCategory`, `deleteCategory`
- Settings: `getSettings`, `updateSettings`

### Backend (`server/`) — Express 5 + SQLite

**Database Schema:**
- `transactions` — type (income/expense), amount, category, emoji, note, date
- `settings` — key-value pairs (monthly_income, warn_threshold, danger_threshold, initial_balance)
- `categories` — type, name, emoji, is_default (0 for custom, 1 for seeded)

**Routers:**
- `routes/transactions.js` — CRUD operations and stats aggregation
- `routes/categories.js` — Category CRUD (add/delete only for custom categories)

**API Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/transactions` | List (with filters) / Create |
| PUT/DELETE | `/api/transactions/:id` | Update / Delete |
| POST | `/api/transactions/batch` | Bulk import |
| GET | `/api/transactions/stats/daily` | Daily summary (income, expense, balance, records) |
| GET | `/api/transactions/stats/weekly` | 7-day breakdown |
| GET | `/api/transactions/stats/monthly` | Monthly trends + category breakdown (expense & income) |
| GET | `/api/transactions/stats/yearly` | Annual summary + top 8 categories (expense & income) |
| GET | `/api/transactions/stats/budget` | Monthly budget status (progress, warn/danger levels) |
| GET | `/api/transactions/stats/balance` | Cumulative balance (initial + all income - all expense) |
| GET/POST/DELETE | `/api/categories` | Category management |
| GET/PUT | `/api/transactions/settings` | App settings |

**Database Initialization:**
- `db.js` creates tables and seeds 13 default categories (8 expense + 5 income)
- Uses `INSERT OR IGNORE` to prevent duplicates
- SQLite WAL mode enabled for concurrency

**Response Format:**
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "message" }
```

## Recent Improvements (v2.0)

✅ **Custom Categories** — Add/remove categories beyond defaults  
✅ **Income Category Charts** — Monthly report shows income breakdown  
✅ **Yearly Category Rankings** — Top 8 expense/income categories  
✅ **Total Balance Widget** — Cumulative balance on homepage  
✅ **Dark Mode** — System preference-aware styling  
✅ **Pagination** — 30 transactions per page with navigation  
✅ **Loading States** — Visual feedback during data fetch  
✅ **Smart Empty States** — Context-aware "no data" vs "no results"  
✅ **Request Deduplication** — AbortController prevents API race conditions  
✅ **Keyboard Shortcuts** — Escape closes modals  
✅ **Local Storage** — Remembers last filter selection  
✅ **Enhanced Export** — Export by current period (week/month/year)  
✅ **Category API** — Get/add/delete categories dynamically  

## Development Notes

### Patterns & Conventions

1. **State Management**: Local `useState` + `useLocalStorage` for preferences, no global store
2. **Error Handling**: Toast notifications for user-facing errors, console logs for debugging
3. **API Calls**: Always wrapped in try/catch with user feedback
4. **Components**: Functional components with hooks; CategoryPicker uses API with hardcoded fallback
5. **Styling**: CSS variables for theming, no CSS-in-JS

### Common Tasks

**Add a new report chart:**
1. Extend `routes/transactions.js` stats endpoint if needed
2. Add API function to `client/src/api/index.js`
3. Render chart in `ReportPage.jsx` using Chart.js

**Add a new setting:**
1. Add field to SettingsPage form
2. Backend automatically stores/retrieves via `GET|PUT /api/transactions/settings`

**Custom categories workflow:**
1. User adds via SettingsPage category management form
2. `POST /api/categories` stores in DB with `is_default=0`
3. CategoryPicker loads via `getCategories(type)` on next render
4. User can delete via SettingsPage, triggers `DELETE /api/categories/:id`

### File Organization

```
client/src/
├── pages/         # 4 route pages
├── components/    # Reusable UI components
├── hooks/         # Custom React hooks (useToast, useLocalStorage)
├── utils/         # Excel import/export helpers
├── api/           # API layer
└── index.css      # Global styles + dark mode

server/
├── routes/        # Express routers (transactions, categories)
├── db.js          # SQLite schema & initialization
└── index.js       # Express app setup
```

## macOS App Packaging

Run `build_app.sh` to create a `.app` bundle:
- Compiles an AppleScript launcher
- Starts Express server + opens browser automatically
- Regenerates icon/launcher on each run

## Testing

No automated tests configured. Manual QA:
- Start `npm run dev`
- Visit http://localhost:5173
- Test transaction CRUD, filtering, pagination, dark mode, category management
- Verify charts render correctly with sample data
- Check Excel import/export
