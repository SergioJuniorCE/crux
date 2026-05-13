/**
 * Database migration — creates tables if they don't exist.
 *
 * Can be:
 *   - Imported and called at startup (auto-migration in src/index.ts)
 *   - Run standalone: `bun run src/db/migrate.ts`
 */

import { createClient } from "@libsql/client";

const DATABASE_URL = process.env.DATABASE_URL ?? "file:./data/crux.db";

export async function migrate() {
  const client = createClient({ url: DATABASE_URL });

  console.log(`Migrating database: ${DATABASE_URL}`);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS summoners (
      puuid TEXT PRIMARY KEY,
      game_name TEXT NOT NULL,
      tag_line TEXT NOT NULL,
      platform TEXT NOT NULL,
      account_json TEXT NOT NULL,
      summoner_json TEXT NOT NULL,
      league_json TEXT,
      data_dragon_version TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS matches (
      match_id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      data_json TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS api_cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  console.log("Migration complete.");
  await client.close();
}

// Allow standalone execution: `bun run src/db/migrate.ts`
const isMainModule =
  import.meta.path === Bun.main || process.argv[1]?.endsWith("migrate.ts");
if (isMainModule) {
  await migrate();
}
