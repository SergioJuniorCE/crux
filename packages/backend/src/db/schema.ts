import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Cached summoner profiles fetched from the Riot API.
 * Stores everything needed to render a summoner card without re-fetching.
 */
export const summoners = sqliteTable("summoners", {
  puuid: text("puuid").primaryKey(),
  gameName: text("game_name").notNull(),
  tagLine: text("tag_line").notNull(),
  platform: text("platform").notNull(),

  /** JSON: RiotAccount */
  accountJson: text("account_json").notNull(),

  /** JSON: RiotSummoner */
  summonerJson: text("summoner_json").notNull(),

  /** JSON: RiotLeagueEntry[] (nullable — unranked players) */
  leagueJson: text("league_json"),

  /** Data Dragon version used when this profile was cached */
  dataDragonVersion: text("data_dragon_version").notNull(),

  /** When this row was last refreshed from the Riot API */
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

/**
 * Cached match details from the Riot API.
 * Matches rarely change, so they can be cached indefinitely.
 */
export const matches = sqliteTable("matches", {
  matchId: text("match_id").primaryKey(),
  platform: text("platform").notNull(),

  /** JSON: RiotMatch */
  dataJson: text("data_json").notNull(),

  /** When this row was last refreshed from the Riot API */
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

/**
 * Generic key-value cache for miscellaneous API responses
 * (e.g. DataDragon versions, API responses with TTL).
 */
export const apiCache = sqliteTable("api_cache", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

// ── Aggregated Stats Tables ──────────────────────────────────────────────────

/**
 * Per-champion item win rates aggregated across all scraped matches.
 * One row per (champion, item, purchase_order, patch) combination.
 */
export const championItemStats = sqliteTable("champion_item_stats", {
  championId: integer("champion_id").notNull(),
  itemId: integer("item_id").notNull(),
  /** 1 = first completed item, 2 = second, 3+ = later items, 0 = any order */
  purchaseOrder: integer("purchase_order").notNull().default(0),
  gamesPlayed: integer("games_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  avgPurchaseTime: integer("avg_purchase_time").default(0),
  patch: text("patch").notNull(),
});

/**
 * Matchup-specific item stats: how a champion performs with an item
 * against a specific enemy champion.
 */
export const championMatchupStats = sqliteTable("champion_matchup_stats", {
  championId: integer("champion_id").notNull(),
  itemId: integer("item_id").notNull(),
  vsChampionId: integer("vs_champion_id").notNull(),
  gamesPlayed: integer("games_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  patch: text("patch").notNull(),
});

// ── Crawler State ────────────────────────────────────────────────────────────

/** Tracks PUUIDs queued for crawling to enable crash recovery. */
export const crawlerQueue = sqliteTable("crawler_queue", {
  puuid: text("puuid").primaryKey(),
  platform: text("platform").notNull(),
  /** 'queued' | 'in_progress' | 'done' | 'error' */
  status: text("status").notNull().default("queued"),
  enqueuedAt: integer("enqueued_at", { mode: "timestamp" }).notNull(),
  lastAttemptAt: integer("last_attempt_at", { mode: "timestamp" }),
  errorMessage: text("error_message"),
  attempts: integer("attempts").notNull().default(0),
});

/** Optional log of scraper runs. */
export const scriptsRun = sqliteTable("scripts_run", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scriptName: text("script_name").notNull(),
  args: text("args"),
  summonersScraped: integer("summoners_scraped").default(0),
  matchesScraped: integer("matches_scraped").default(0),
  errors: integer("errors").default(0),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});
