# AGENTS.md

## Repository Defaults

- Always use `bun` for package management, scripts, installs, and one-off commands in this repository.
- Do not use `npm`, `yarn`, or `pnpm` unless the user explicitly asks for one of them.
- Prefer Bun equivalents:
  - `bun install`
  - `bun add <pkg>`
  - `bun remove <pkg>`
  - `bun run <script>`
  - `bun x <command>`

## Command Guidance

- When the repo needs dependencies installed, use `bun install`.
- When running project scripts, use `bun run <script>`.
- When invoking local CLIs, prefer `bun x <tool>` if a direct `bun run` script is not available.
- When suggesting commands to the user, default to Bun-based commands.

## Project Intent

This repository is Bun-first. Any agent working in this repo should assume Bun is the standard runtime and package manager unless the user says otherwise.

## Architecture Overview

The project is a Turborepo monorepo split into two independent packages:

### Frontend (Electron desktop app)
- **Location**: `apps/desktop/` — React + Electron desktop app
- **Stack**: React 18, Vite, Tailwind CSS 4, shadcn/ui, Electron 30
- **Desktop features**: Game recording (MediaRecorder), LCU integration (local HTTPS), champ select, video sessions
- **Riot API calls**: **None** — all Riot data is fetched from the Crux backend
- **Settings**: Stores Riot ID (gameName, tagLine), platform region, and backend URL in localStorage

### Backend (ElysiaJS server)
- **Location**: `packages/backend/`
- **Stack**: ElysiaJS, Drizzle ORM, @libsql/client (SQLite)
- **API key**: Stored in `packages/backend/.env` as `RIOT_API_KEY` (never in the frontend)
- **Role**: Proxies Riot API calls, caches responses in SQLite, exposes REST API to the frontend
- **Default port**: 3001 (configurable via `PORT` env var)
- **Auto-migration**: Runs `src/db/migrate.ts` on every startup (creates tables if missing)
- **Cache cleanup**: Expired `api_cache` entries are pruned every 10 minutes

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check + reports `hasApiKey` status |
| GET | `/api/summoner/:platform/:gameName/:tagLine?matchCount=N` | Fetch summoner profile bundle (account, summoner, league, matches, DataDragon version) |

### Data Flow
```
User Input → Electron Renderer → fetch() → Backend (ElysiaJS) → Riot API
                                                ↓
                                            SQLite cache (Drizzle ORM)
```

### Running Locally
```bash
# Single command (both frontend + backend via Turborepo):
bun run dev

# Or run individually:
bun run dev --filter=crux-desktop    # Frontend only
bun run dev --filter=crux-backend    # Backend only
```

### Backend Setup
1. Copy `packages/backend/.env.example` to `packages/backend/.env`
2. Set `RIOT_API_KEY` to your Riot Games API key (get one at https://developer.riotgames.com/)
3. The database auto-migrates on startup — no manual migration needed

## Database

- **Engine**: SQLite via @libsql/client (Turso-compatible)
- **ORM**: Drizzle ORM
- **Schema**: `packages/backend/src/db/schema.ts`
- **Tables**: `summoners`, `matches`, `api_cache`
- **Migrations**: Auto on startup via `packages/backend/src/db/migrate.ts`
  - Standalone: `bun run db:migrate` in packages/backend/
- **DB file**: `packages/backend/data/crux.db` (configurable via `DATABASE_URL` env var)

## Settings
- The Riot API key is stored ONLY in the backend's `.env` file (`RIOT_API_KEY`).
- The frontend settings store: backend URL, Riot ID (gameName + tagLine), platform region.
- Users configure the backend URL in the app's Settings panel (default: `http://localhost:3001`).

## UI / UX Defaults

- Prioritize compact, information-dense overview screens over large hero/marketing-style layouts.
- Optimize for quick scanning: small cards, tight spacing, concise labels, and multiple useful data points visible without scrolling.
- In game-assistant views, put actionable gameplay information first (builds, runes, spells, stats, confidence/sample source) and keep explanatory text minimal.
- Avoid oversized typography or imagery unless the user explicitly asks for a presentation-style page.
- Avoid overusing separate card containers; group related data into fewer panels with subtle internal dividers/spacing.
- Center text and key content inside small overview cards unless a list/table layout clearly benefits from left alignment.