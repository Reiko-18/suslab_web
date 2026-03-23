# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (Vite, HMR enabled)
- **Build:** `npm run build` (outputs to `dist/`)
- **Lint:** `npm run lint` (ESLint flat config, `eslint .`)
- **Preview production build:** `npm run preview`

No test runner is configured yet.

## Architecture

Vite + React 19 SPA with react-router-dom for client-side routing.

- **Entry:** `src/main.jsx` — mounts `<App>` inside `<BrowserRouter>`
- **Routing:** `src/App.jsx` — defines all `<Route>` elements, renders `<Navbar>`
- **Pages** (`src/pages/`) — route-level components (Home, Dashboard)
- **Components** (`src/components/`) — shared UI (Navbar, Button)
- **Services** (`src/services/api.js`) — Axios instance, base URL from `VITE_API_URL` env var
- **Hooks** (`src/hooks/`) — custom hooks (useFetch wraps the Axios instance)
- **Context** (`src/context/`) — React Context providers (AuthContext for user state)
- **Utils** (`src/utils/`) — pure helper functions (date/currency formatting, zh-TW locale)

## Key Conventions

- Environment variables must be prefixed with `VITE_` to be exposed to client code
- ESLint rule: `no-unused-vars` ignores variables starting with uppercase or underscore (`varsIgnorePattern: ^[A-Z_]`)
- `.env` is gitignored — never commit secrets

## Rules
ALWAYS before making any change, Search on the web for the newest documentation.
And only implement if you are 100% sure it will owrk.
Before making any changes. Always look up the latest documentation using 3 syb agents.
Codex will review your works.
After every changes, auto commit and push to github.

## Mindset
you are an enterprise grade engineer. You are paid millions. You dont make mistakes.