/**
 * Stats API routes — serve aggregated champion item stats to the frontend.
 *
 * Endpoints:
 *   GET /api/stats/items/:championId              — Top items for a champion
 *   GET /api/stats/items/:championId/vs/:enemyId  — Matchup-specific items
 *   GET /api/stats/champions                       — List champions with data
 */

import { Elysia, t } from "elysia";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { getChampionMap } from "../services/dataDragon";

export const statsRoutes = new Elysia({ prefix: "/api/stats" })

  /**
   * Get top items for a champion by win rate.
   *
   * Query params:
   *   patch     — Filter to specific patch (e.g. "14.9")
   *   order     — Purchase order: 0 (any), 1 (first), 2 (early), 3 (late)
   *   minGames  — Minimum games for an item to be considered (default 5)
   *   limit     — Max items to return (default 20)
   */
  .get(
    "/items/:championId",
    async ({ params, query }) => {
      const championId = Number(params.championId);
      const patch = query.patch ?? "";
      const order = Number(query.order ?? 0);
      const minGames = Number(query.minGames ?? 5);
      const limit = Number(query.limit ?? 20);

      let whereClause = `champion_id = ${championId} AND purchase_order = ${order}`;
      if (patch) whereClause += ` AND patch = '${patch.replace(/[^0-9.]/g, "")}'`;

      const rows = await db.run(sql`
        SELECT item_id, games_played, wins, avg_purchase_time, patch
        FROM champion_item_stats
        WHERE ${sql.raw(whereClause)} AND games_played >= ${minGames}
        ORDER BY (CAST(wins AS REAL) / CAST(games_played AS REAL)) DESC, games_played DESC
        LIMIT ${limit}
      `);

      const items = (rows.rows ?? []).map((row: any) => ({
        itemId: Number(row.item_id),
        gamesPlayed: Number(row.games_played),
        wins: Number(row.wins),
        winRate: Number(row.games_played) > 0
          ? Math.round((Number(row.wins) / Number(row.games_played)) * 100)
          : 0,
        avgPurchaseTime: row.avg_purchase_time ? Number(row.avg_purchase_time) : null,
        patch: String(row.patch ?? patch),
      }));

      return {
        success: true,
        championId,
        totalItems: items.length,
        patch: patch || "all",
        items,
      };
    },
    {
      params: t.Object({
        championId: t.String(),
      }),
      query: t.Object({
        patch: t.Optional(t.String()),
        order: t.Optional(t.String()),
        minGames: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )

  /**
   * Get matchup-specific item recommendations.
   * Shows how a champion performs with an item when facing a specific enemy champion.
   */
  .get(
    "/items/:championId/vs/:enemyId",
    async ({ params, query }) => {
      const championId = Number(params.championId);
      const enemyId = Number(params.enemyId);
      const patch = query.patch ?? "";
      const minGames = Number(query.minGames ?? 3);
      const limit = Number(query.limit ?? 20);

      let whereClause = `champion_id = ${championId} AND vs_champion_id = ${enemyId}`;
      if (patch) whereClause += ` AND patch = '${patch.replace(/[^0-9.]/g, "")}'`;

      const rows = await db.run(sql`
        SELECT item_id, games_played, wins, patch
        FROM champion_matchup_stats
        WHERE ${sql.raw(whereClause)} AND games_played >= ${minGames}
        ORDER BY (CAST(wins AS REAL) / CAST(games_played AS REAL)) DESC, games_played DESC
        LIMIT ${limit}
      `);

      const items = (rows.rows ?? []).map((row: any) => ({
        itemId: Number(row.item_id),
        gamesPlayed: Number(row.games_played),
        wins: Number(row.wins),
        winRate: Number(row.games_played) > 0
          ? Math.round((Number(row.wins) / Number(row.games_played)) * 100)
          : 0,
        patch: String(row.patch ?? patch),
      }));

      return {
        success: true,
        championId,
        vsChampionId: enemyId,
        totalItems: items.length,
        patch: patch || "all",
        items,
      };
    },
    {
      params: t.Object({
        championId: t.String(),
        enemyId: t.String(),
      }),
      query: t.Object({
        patch: t.Optional(t.String()),
        minGames: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )

  /**
   * List champions that have aggregated stats available.
   */
  .get(
    "/champions",
    async ({ query }) => {
      const patch = query.patch ?? "";

      let whereClause = "1=1";
      if (patch) whereClause = `patch = '${patch.replace(/[^0-9.]/g, "")}'`;

      const rows = await db.run(sql`
        SELECT champion_id, COUNT(DISTINCT item_id) as item_count, SUM(games_played) as total_games, MAX(patch) as latest_patch
        FROM champion_item_stats
        WHERE ${sql.raw(whereClause)}
        GROUP BY champion_id
        ORDER BY total_games DESC
      `);

      // Enrich with champion names
      let championMap: Record<number, { id: string; name: string }> = {};
      try {
        const map = await getChampionMap();
        championMap = Object.fromEntries(
          Object.entries(map).map(([key, info]) => [Number(key), { id: info.id, name: info.name }]),
        );
      } catch { /* skip names if DDragon is unavailable */ }

      const champions = (rows.rows ?? []).map((row: any) => ({
        championId: Number(row.champion_id),
        championName: championMap[Number(row.champion_id)]?.name ?? `Champion ${row.champion_id}`,
        championImageId: championMap[Number(row.champion_id)]?.id,
        itemCount: Number(row.item_count),
        totalGames: Number(row.total_games),
        latestPatch: String(row.latest_patch),
      }));

      return {
        success: true,
        total: champions.length,
        champions,
      };
    },
    {
      query: t.Object({
        patch: t.Optional(t.String()),
      }),
    },
  )

  /**
   * Get the current aggregation info (patches available, match count).
   */
  .get(
    "/info",
    async () => {
      const matchCount = await db.run(sql`SELECT COUNT(*) as count FROM matches`);
      const patches = await db.run(sql`
        SELECT DISTINCT patch FROM champion_item_stats ORDER BY patch DESC LIMIT 10
      `);
      const champCount = await db.run(sql`
        SELECT COUNT(DISTINCT champion_id) as count FROM champion_item_stats
      `);

      return {
        success: true,
        totalMatches: Number((matchCount.rows[0] as any)?.count ?? 0),
        championsWithStats: Number((champCount.rows[0] as any)?.count ?? 0),
        patchesAvailable: (patches.rows ?? []).map((r: any) => String(r.patch)),
      };
    },
  );
