# Repository Guidelines

## Project Structure & Module Organization
This repository is a small full-stack app with a React client and an Express server.

- `client/src/`: frontend entry points, pages, reusable components, API helpers, and assets.
- `client/public/`: static public assets.
- `server/index.js`: Express bootstrap and production static-file serving.
- `server/routes/transactions.js`: transaction, stats, batch import, and settings-related API routes.
- `server/db.js`: SQLite initialization for `server/data.db`.

Treat `node_modules/`, `server/*.db*`, `server/server.log`, and `client/dist/` as generated artifacts, not review targets.

## Build, Test, and Development Commands
- `npm install`: install root tooling for the combined workflow.
- `cd client && npm install`: install frontend dependencies.
- `cd server && npm install`: install backend dependencies.
- `npm run dev`: run client and server together from the repo root.
- `npm run client`: start the Vite dev server only.
- `npm run server`: start the Express API only on `http://localhost:5001`.
- `npm run build`: build the frontend into `client/dist/`.
- `cd client && npm run lint`: run ESLint on frontend files.
- `cd client && npm run preview`: preview the production frontend build locally.

## Coding Style & Naming Conventions
Use 2-space indentation in the client and 2- or 4-space only when matching existing server formatting; preserve the surrounding file style. Frontend files use ES modules and PascalCase component names such as `TransactionForm.jsx` and `HomePage.jsx`. Utility modules use lower-case names like `api/index.js` and `utils/excel.js`. Keep route handlers focused and group related SQL near the endpoint that uses it.

Frontend linting is defined in `client/eslint.config.js`. Fix lint errors before opening a PR.

## Testing Guidelines
There is no automated test suite yet. For changes, run `cd client && npm run lint`, then smoke-test the main flows through `npm run dev`: create a transaction, delete one, import a batch, and verify daily/weekly/monthly reports. If you add tests, place them next to the module or under a dedicated `tests/` folder and name them `*.test.js` or `*.test.jsx`.

## Commit & Pull Request Guidelines
Current history uses short imperative Chinese commit subjects, for example `创建CLAUDE.md`. Follow that pattern or use an equally concise imperative English subject if the team prefers one language consistently.

PRs should include a short summary, affected areas (`client`, `server`, or both), manual verification steps, and screenshots for UI changes. Mention any schema or data-impacting changes explicitly.
