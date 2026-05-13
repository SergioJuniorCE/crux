# AGENTS.md

## Critical Rules

- **NEVER start the dev server** — the user always has `bun run dev` running already. Querying the API should be done against the already-running server at `http://localhost:3001`.
- **NEVER run `git commit`, `git push`, or any git mutation** unless the user explicitly asks.

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
| GET | `/api/stats/items/:championId` | Top items for a champion by win rate (query: `patch`, `order`, `minGames`, `limit`) |
| GET | `/api/stats/items/:championId/vs/:enemyId` | Matchup-specific item recommendations |
| GET | `/api/stats/champions` | List champions with aggregated stats available |
| GET | `/api/stats/info` | Aggregation metadata (total matches, patches, champ count) |

### Data Flow
```
User Input → Electron Renderer → fetch() → Backend (ElysiaJS) → Riot API
                                                ↓
                                            SQLite cache (Drizzle ORM)
                                                ↓
                                     Stats Aggregator (cron + manual)
                                                ↓
                                     champion_item_stats table
                                     champion_matchup_stats table
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
- **Tables**:
  - `summoners` — cached summoner profiles (account, summoner, league, DataDragon version)
  - `matches` — raw match data (full JSON) from the Riot API
  - `api_cache` — generic key-value cache with TTL
  - `champion_item_stats` — per-champion item win rates (by champion, item, purchase order, patch)
  - `champion_matchup_stats` — matchup-specific item stats (by champion, item, enemy champion, patch)
  - `crawler_queue` — PUUID queue for crash-recoverable crawling
  - `scripts_run` — log of scraper/aggregator script executions
- **Migrations**: Auto on startup via `packages/backend/src/db/migrate.ts`
  - Standalone: `bun run db:migrate` in packages/backend/
- **DB file**: `packages/backend/data/crux.db` (configurable via `DATABASE_URL` env var)

## Scraper & Data Pipeline

The backend includes CLI scripts for batch-fetching Riot API data and computing aggregated stats:

| Script | Command | Purpose |
|--------|---------|---------|
| `scrape-summoner.ts` | `bun run scrape:summoner -- --region na1 --name "Faker" --tag "KR1"` | Fetch one summoner profile + recent matches |
| `scrape-matches.ts` | `bun run scrape:matches -- --puuid <x> --region na1 --count 50` | Backfill additional matches for a known PUUID |
| `scrape-bulk.ts` | `bun run scrape:bulk -- --file players.json` | Batch fetch from JSON/CSV file with concurrency control |
| `scrape-seed.ts` | `bun run scrape:seed -- --region na1` | Start the Master+ crawler (seeds from Challenger, crawls outward) |
| `aggregate.ts` | `bun run aggregate` | Recompute champion item stats from stored matches |

Run from the `packages/backend/` directory.

### Crawler
The crawler (`services/crawler.ts`) implements a spider pattern:
1. Seeds from Challenger/Grandmaster/Master league entries via `seedFromMasterPlus()`
2. For each PUUID: fetch match list → fetch match details → extract other participants
3. Check each participant's rank via the League API → enqueue if Master+
4. SQLite-backed queue enables crash recovery
5. Auto-aggregates stats every N matches (configurable in `scraper.config.json`)

### Rate Limiting
The token-bucket rate limiter (`services/rateLimiter.ts`) respects Riot API limits:
- Dev key: 20 req/s, burst 100
- Prod key: 500 req/10s, burst 30,000
- All scraper scripts and the crawler use the rate limiter

### Aggregation
The stats aggregator (`services/statsAggregator.ts`) reads from the `matches` table and writes to `champion_item_stats` and `champion_matchup_stats`. It:
- Analyzes Summoner's Rift games (queue IDs 420, 440)
- Extracts items per participant, excluding trinkets and starter items
- Tracks purchase order (first/early/late based on item position)
- Computes win rates and average purchase times per champion-item combination
- Tracks matchup-specific stats per enemy champion
- Groups by patch version for patch-filtered queries

### Cron / Scheduling
The scheduler (`services/scheduler.ts`) uses `node-cron` to run the crawler on a schedule.

**In-server scheduler** (auto-starts with the backend):
- Enabled by setting `cron.enabled: true` in `scraper.config.json`
- Default schedule: `0 6 * * *` (daily at 6 AM)
- Reads `cron.maxPuuidsPerRun` and `cron.matchesPerPuuid` from config
- Auto-aggregates after each crawl run

**Standalone runner** (for Windows Task Scheduler / cron):
```bash
bun run cron --max-puuids 50 --matches-per-puuid 20
```

**Windows Task Scheduler setup** (PowerShell as Admin):
```powershell
$action = New-ScheduledTaskAction -Execute "bun" `
  -Argument "run src/scripts/cron.ts" `
  -WorkingDirectory "C:\full\path\to\crux\packages\backend"
$trigger = New-ScheduledTaskTrigger -Daily -At 06:00AM
Register-ScheduledTask -TaskName "CruxCrawler" `
  -Action $action -Trigger $trigger -RunLevel Highest
```

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