# PRD: Data Collection & Scraping Pipeline

> **Status:** Draft · **Target:** Post-split milestone  
> **Date:** 2026-05-12

## 1. Problem Statement

The Crux app currently fetches Riot API data on-demand when a user views a summoner profile through the backend proxy. This approach has several limitations:

- **Rate limits**: Riot API development keys are capped at 20 requests/sec and 100 req/2min. Repeated profile views burn through this quota.
- **Cold starts**: Every summoner lookup hits the live API even if the data hasn't changed.
- **No historical data**: Match data older than the last fetch is lost when the cache expires.
- **No bulk operations**: There's no way to pre-fetch data for a known set of summoners or tournaments.
- **No offline/background collection**: Users can't run scripts overnight to build a local database of match data.

## 2. Goals

Build a CLI/scraping layer into the Crux backend that lets:

1. **Users run local scripts** to batch-fetch summoner profiles and matches from the Riot API.
2. **Data persists in SQLite** indefinitely (not just in a short-TTL cache).
3. **Scripts are composable** — a user can write a simple pipeline like "fetch this list of summoners, then fetch all their matches from the last 30 days".
4. **Scraped data feeds the same API** that the frontend reads, so no code duplication.
5. **Self-contained** — everything runs locally, no external services needed.

## 3. Non-Goals

- A web UI for scraping (CLI + config files are sufficient).
- Distributed/multi-machine scraping.
- Real-time streaming of match data.
- Public data sharing or export APIs (future consideration).

## 4. Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Backend (ElysiaJS + SQLite)                                │
│                                                             │
│  ┌────────────────────┐   ┌──────────────────────────────┐  │
│  │  REST API          │   │  Scraper CLI / Script Runner │  │
│  │  (src/routes/)     │   │  (src/scripts/)              │  │
│  │                    │   │                              │  │
│  │  - GET /api/health │   │  - scrape-summoner.ts        │  │
│  │  - GET /api/summoner│  │  - scrape-matches.ts         │  │
│  │  - ...             │   │  - scrape-bulk.ts            │  │
│  └────────┬───────────┘   └────────────┬─────────────────┘  │
│           │                            │                     │
│           └──────────┬─────────────────┘                     │
│                      ▼                                       │
│           ┌────────────────────┐                             │
│           │  SQLite (Drizzle)  │                             │
│           │                    │                             │
│           │  - summoners       │                             │
│           │  - matches         │                             │
│           │  - api_cache       │                             │
│           └────────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

## 5. Detailed Requirements

### 5.1 Scraper Scripts (`backend/src/scripts/`)

Each script is a standalone `bun run`-able TypeScript file that imports the shared DB and Riot API service modules. Scripts write directly to the same SQLite database the backend serves, so scraped data is immediately available to the frontend.

| Script | Purpose | CLI Example |
|--------|---------|-------------|
| `scrape-summoner.ts` | Fetch one summoner profile + recent matches and persist to DB | `bun run src/scripts/scrape-summoner.ts --region na1 --name "Faker" --tag "KR1"` |
| `scrape-matches.ts` | Fetch additional matches for a known PUUID beyond the initial count | `bun run src/scripts/scrape-matches.ts --puuid <x> --region na1 --count 50` |
| `scrape-bulk.ts` | Read a CSV/JSON list of summoners and scrape all of them | `bun run src/scripts/scrape-bulk.ts --file summoners.json --concurrency 3` |

### 5.2 Data Model Extensions

The existing `summoners` and `matches` tables already store data indefinitely. No schema changes needed — but the scraper scripts should:

- Use `INSERT ... ON CONFLICT DO UPDATE` to upsert fresh data.
- Track `fetched_at` timestamps so the API layer can serve "young enough" cached data while the scraper refreshes in the background.
- Add a `scripts_run` table (optional) to log which scripts ran, when, and how many records they touched.

### 5.3 Rate Limiting

The scraper must respect Riot API rate limits:

- **Development key**: 20 requests/sec, 100 req/2min.
- **Production key**: 500 req/10s, 30,000 req/10min.

Implement a token-bucket rate limiter in a shared `services/rateLimiter.ts`:

```ts
class RateLimiter {
  constructor(capacity: number, refillPerSec: number)
  async acquire(): Promise<void>  // blocks until a token is available
}
```

### 5.4 Configuration

Scraper scripts should read config from:

1. CLI flags (highest priority)
2. Environment variables (`RIOT_API_KEY`, `DATABASE_URL`)
3. A config file (`packages/backend/scraper.config.json`) with defaults:

```json
{
  "concurrency": 3,
  "rateLimitPerSecond": 20,
  "rateLimitBurst": 100,
  "defaultMatchCount": 20,
  "delayBetweenRequestsMs": 50
}
```

### 5.5 Progress & Logging

- All scripts should log progress to stdout with timestamps and counts.
- Errors should be collected (not fail-fast) when `--continue-on-error` is passed.
- A summary line at the end: `"Scraped 47/50 summoners, 892 matches. Errors: 3"`

## 6. User Stories

### US-1: Fetch My Profile on Demand

```bash
cd crux/packages/backend
bun run src/scripts/scrape-summoner.ts --region na1 --name "MyName" --tag "TAG1"
```

Expected: Profile + last 20 matches stored in SQLite. Frontend can now serve this instantly.

### US-2: Batch Fetch a Tournament Roster

```bash
cat > players.json <<EOF
[
  {"region":"na1","name":"Player1","tag":"NA1"},
  {"region":"euw1","name":"Player2","tag":"EUW"}
]
EOF
cd packages/backend
bun run src/scripts/scrape-bulk.ts --file players.json --matches 10
```

Expected: All players + their last 10 matches stored. Summary printed.

### US-3: Backfill Historical Matches

```bash
cd packages/backend
bun run src/scripts/scrape-matches.ts --puuid <puuid> --region na1 --count 100 --start 50
```

Expected: 100 matches (offset 50) fetched and stored. No duplicates in DB.

## 7. Implementation Plan

1. **Phase 1** ✅ (current): Split backend/frontend — Backend (ElysiaJS + SQLite) handles all Riot API calls, frontend is a pure Electron desktop app. Monorepo with Turborepo.
2. **Phase 2**: Create `packages/backend/src/services/rateLimiter.ts` with token-bucket algorithm
3. **Phase 3**: Implement `scrape-summoner.ts` and `scrape-matches.ts`
4. **Phase 4**: Implement `scrape-bulk.ts` with JSON/CSV input, concurrency control
5. **Phase 5**: Add `GET /api/summoner/:puuid/refresh` endpoint to trigger a scrape from the frontend
6. **Phase 6**: Write documentation and add to AGENTS.md
