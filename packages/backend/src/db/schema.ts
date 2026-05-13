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
