# Crux

**A League of Legends companion app** — smart builds, champ select tools, and a local data pipeline powered by the Riot API.

Crux is a two-part application:
- **Desktop app** (`apps/desktop/`): Electron + React + Tailwind CSS — champ select overlays, match history, video sessions, and build recommendations.
- **Backend** (`packages/backend/`): ElysiaJS + SQLite (Drizzle ORM) — proxies Riot API calls, caches everything locally, and runs a scraper/data aggregator for offline-friendly stats.

All Riot data flows through your own backend. Your API key stays in `.env` — never exposed to the frontend.

---

## Features

- **Champion build stats** — item win rates, purchase order data, and matchup-specific recommendations computed from cached match data
- **Champ select tools** — real-time summoner lookup, suggested counters, and optimal builds during draft
- **Game recording** — built-in video session capture via MediaRecorder + FFmpeg
- **LCU integration** — reads live game data from the League Client
- **Master+ crawler** — auto-discovers high-ELO players, backfills their matches, and aggregates stats
- **Offline-friendly** — everything is cached in local SQLite; no external services required

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Monorepo (Turborepo + Bun)                                  │
│                                                              │
│  ┌─────────────────────────┐   ┌──────────────────────────┐  │
│  │  Desktop (Electron)      │   │  Backend (ElysiaJS)     │  │
│  │  apps/desktop/           │   │  packages/backend/      │  │
│  │                         │   │                          │  │
│  │  - React 18 + Vite      │──→│  - REST API proxy        │  │
│  │  - shadcn/ui components │   │  - SQLite (Drizzle ORM)  │  │
│  │  - Tailwind CSS 4       │   │  - Stats aggregator      │  │
│  │  - LCU client reader    │   │  - Master+ crawler       │  │
│  │  - Video recording      │   │  - Auto rate limiting    │  │
│  └─────────────────────────┘   └────────┬─────────────────┘  │
│                                          │                   │
│                                          ▼                   │
│                               ┌────────────────────┐         │
│                               │  SQLite (data/)     │         │
│                               │  - summoners        │         │
│                               │  - matches          │         │
│                               │  - cached API       │         │
│                               │  - aggregated stats │         │
│                               └────────────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **No Riot API calls from the frontend** — every request goes through the backend proxy, keeping your API key server-side and enabling local caching
- **Auto-migrating database** — SQLite schema is created/updated on every backend startup (no manual migrations)
- **Cache-first** — responses are cached with TTL; stale data is served while the background refreshes
- **Scraper pipeline** — CLI scripts for batch-fetching summoners, backfilling matches, and running bulk imports from CSV/JSON

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) 1.3+
- A [Riot Games API key](https://developer.riotgames.com/) (free development key works for local use)

### Setup

```bash
# Clone the repo
git clone https://github.com/<your-org>/crux
cd crux

# Install dependencies
bun install

# Configure the backend API key
cp packages/backend/.env.example packages/backend/.env
# Edit packages/backend/.env — set RIOT_API_KEY to your key
```

### Run

```bash
# Start both frontend + backend (via Turborepo)
bun run dev

# Or run individually:
bun run dev --filter=crux-backend   # Backend on :3001
bun run dev --filter=crux-desktop   # Frontend (Electron)
```

The backend auto-migrates the database on first launch.

---

## Scripts & Data Pipeline

See [packages/backend/README.md](packages/backend/README.md) for the full scraper reference.

| Script | Command | What it does |
|--------|---------|-------------|
| Fetch summoner | `bun run scrape:summoner -- --region na1 --name "Faker" --tag "KR1"` | Fetch one profile + matches |
| Backfill matches | `bun run scrape:matches -- --puuid <x> --region na1 --count 50` | Fetch more matches for a known PUUID |
| Bulk import | `bun run scrape:bulk -- --file players.json` | Batch fetch from JSON/CSV |
| Seed crawler | `bun run scrape:seed -- --region na1` | Start Master+ spider from Challenger league |
| Aggregate stats | `bun run aggregate` | Recompute item win rates from stored matches |
| Cron runner | `bun run cron -- --max-puuids 50 --matches-per-puuid 20` | Standalone scheduled scrape |

Run all of these from `packages/backend/`.

---

## Project Structure

```
crux/
├── apps/
│   └── desktop/          # Electron desktop app (React + Vite)
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   └── hooks/
│       └── electron/     # Electron main process
├── packages/
│   └── backend/          # ElysiaJS server + data pipeline
│       ├── src/
│       │   ├── db/       # Drizzle schema + migrations
│       │   ├── routes/   # REST API endpoints
│       │   ├── services/ # Rate limiter, crawler, aggregator
│       │   ├── scripts/  # CLI scraper scripts
│       │   └── types/    # Shared TypeScript types
│       └── data/         # SQLite database (auto-created)
├── package.json          # Turborepo root
└── turbo.json
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS 4, shadcn/ui, Electron 30 |
| Backend | ElysiaJS, Drizzle ORM, @libsql/client (SQLite) |
| Monorepo | Turborepo + Bun workspaces |
| Data | SQLite (local), Riot API v5 |

---

## Contributing

Contributions are welcome! Here's how to get started:

### Development Workflow

1. **Fork and clone** the repository
2. **Install dependencies**: `bun install`
3. **Set up your environment**: copy `.env.example` → `.env` and add your Riot API key
4. **Create a branch**: `git checkout -b feature/my-feature`
5. **Make your changes** — keep code style consistent with the existing codebase
6. **Test locally** — run both frontend and backend to verify nothing is broken
7. **Push and open a pull request**

### Guidelines

- **Bun-first** — this repo uses Bun for everything: `bun install`, `bun run`, `bun x`. Avoid npm/yarn.
- **TypeScript** — all code should be typed. No `any` unless absolutely necessary.
- **Riot API key** — never commit your API key. It belongs in `.env` only.
- **Rate limits** — always respect Riot API rate limits. Use the shared rate limiter (`services/rateLimiter.ts`) for any batch operations.
- **Commit style** — follow Conventional Commits (e.g., `feat: add match history pagination`, `fix: handle expired cache entries`).
- **SQLite schema** — if you add tables or columns, update `packages/backend/src/db/schema.ts` and run `bun run db:generate` to create the migration.
- **No web UI for scraping** — the scraper is CLI-only. Keep it scriptable.

### What Needs Help

- New stat aggregations (runes, skills order, team comp analysis)
- More Riot region support
- Electron app polish (native menus, auto-updater, tray)
- Test coverage (we don't have tests yet — great place to start!)
- Better error handling in scraper scripts
- UI for reviewing scraped data / crawler status

---

## License

MIT
