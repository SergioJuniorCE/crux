/**
 * Stats Aggregator — reads raw match data from the `matches` table and computes
 * per-champion item win rates, stored in the `champion_item_stats` table.
 *
 * Also computes matchup-specific item stats in `champion_matchup_stats`.
 *
 * Usage (CLI):
 *   bun run src/scripts/aggregate.ts
 *   bun run src/scripts/aggregate.ts --patch 14.9
 */

import { db } from "../db";
import { matches } from "../db/schema";
import { sql } from "drizzle-orm";
import type { RiotMatch, RiotMatchParticipant } from "../types/riot";

// Items that should be excluded from analysis
const EXCLUDED_ITEM_IDS = new Set([
  // Trinkets
  3330, 3340, 3348, 3363, 3364, 3513, 3599, 3600, 2052,
  // Starter items
  1054, 1055, 1056, 1057, 1058, 1062, 1063, 1082, 1083, 1101, 1102, 1103, 1104,
  2003, 2010, 2031, 2033, 2051, 2055, 2065, 2138, 2139, 2140,
  // Boots
  1001, 3006, 3009, 3011, 3020, 3047, 3111, 3117, 3158, 3177,
]);

const TRINKET_ITEM_IDS = new Set([
  3330, 3340, 3348, 3363, 3364, 3513, 3599, 3600, 2052,
]);

export type AggregateResult = {
  championsProcessed: number;
  totalItemsTracked: number;
  matchupsTracked: number;
  matchesAnalyzed: number;
};

/**
 * Extract patch version from a match's game version string.
 * e.g. "14.9.550.1234" → "14.9"
 */
function extractPatch(gameVersion: string): string {
  const match = gameVersion.match(/^(\d+\.\d+)/);
  return match ? match[1] : "unknown";
}

/**
 * Get a participant's items as an array of item IDs (excluding trinkets and placeholders).
 */
function getParticipantItems(p: RiotMatchParticipant): number[] {
  return [
    p.item0, p.item1, p.item2, p.item3, p.item4, p.item5,
  ].filter((id) => id > 0 && !EXCLUDED_ITEM_IDS.has(id) && !TRINKET_ITEM_IDS.has(id));
}

/**
 * Determine the purchase order of items based on participant data.
 * Since the match API doesn't include timeline, we approximate:
 * - Items are ordered by their IDs as a proxy (not perfect but reasonable)
 * - In practice, item0 is usually the first completed item
 *
 * A better approach would use the timeline API, but that's a separate endpoint.
 * For now: we count frequency of each item across all participants of that champion.
 */
function classifyItemOrder(items: number[]): { first: number[]; early: number[]; late: number[] } {
  // Simple heuristic: assume items are roughly in purchase order
  // item0 → first, item1-2 → early, item3-5 → late
  return {
    first: items.length > 0 ? [items[0]] : [],
    early: items.slice(1, 3),
    late: items.slice(3),
  };
}

/**
 * Aggregate all matches in the database.
 * Clears existing aggregated stats and recomputes them.
 */
export async function aggregateAll(patch?: string): Promise<AggregateResult> {
  const result: AggregateResult = {
    championsProcessed: 0,
    totalItemsTracked: 0,
    matchupsTracked: 0,
    matchesAnalyzed: 0,
  };

  // Fetch all matches from the DB
  const allMatches = await db.select({
    matchId: matches.matchId,
    dataJson: matches.dataJson,
  }).from(matches);

  console.log(`   Reading ${allMatches.length} matches from DB...`);

  // Per-champion-item aggregation maps
  type ItemStat = { games: number; wins: number; totalPurchaseTime: number };
  type MatchupItemStat = { games: number; wins: number };

  const championStats = new Map<string, Map<number, ItemStat>>(); // "championId:patch" → itemId → stats
  const orderStats = new Map<string, Map<number, Map<number, ItemStat>>>(); // "championId:patch" → order → itemId → stats
  const matchupStats = new Map<string, Map<number, Map<number, MatchupItemStat>>>(); // "championId:patch" → itemId → vsChampionId → stats

  for (const row of allMatches) {
    let match: RiotMatch;
    try {
      match = JSON.parse(row.dataJson) as RiotMatch;
    } catch {
      continue; // Skip corrupt data
    }

    // Skip non-standard game modes
    const queueId = match.info.queueId;
    if (queueId !== 420 && queueId !== 440 && queueId !== 0) {
      // 420 = Summoner's Rift Solo/Duo, 440 = Flex
      // Only analyze SR games
      if (![420, 440].includes(queueId)) continue;
    }

    const patchVersion = extractPatch(match.info.gameVersion ?? "0.0");
    if (patch && patchVersion !== patch) continue;

    result.matchesAnalyzed++;

    for (const participant of match.info.participants) {
      const championId = participant.championId;
      const items = getParticipantItems(participant);
      const wasWin = participant.win;
      const key = `${championId}:${patchVersion}`;

      // Per-item stats (any order)
      let itemMap = championStats.get(key);
      if (!itemMap) {
        itemMap = new Map();
        championStats.set(key, itemMap);
      }

      for (const itemId of items) {
        let stat = itemMap.get(itemId);
        if (!stat) {
          stat = { games: 0, wins: 0, totalPurchaseTime: 0 };
          itemMap.set(itemId, stat);
        }
        stat.games++;
        if (wasWin) stat.wins++;
        // Note: gameDuration is total match duration, not item purchase time.
        // Actual purchase time requires timeline API.
        stat.totalPurchaseTime += match.info.gameDuration;
      }

      // Per-order stats
      const order = classifyItemOrder(items);
      let orderMap = orderStats.get(key);
      if (!orderMap) {
        orderMap = new Map();
        orderStats.set(key, orderMap);
      }

      for (const [orderLabel, orderItems] of Object.entries(order)) {
        const orderNum = orderLabel === "first" ? 1 : orderLabel === "early" ? 2 : 3;
        let orderItemMap = orderMap.get(orderNum);
        if (!orderItemMap) {
          orderItemMap = new Map();
          orderMap.set(orderNum, orderItemMap);
        }

        for (const itemId of orderItems) {
          let stat = orderItemMap.get(itemId);
          if (!stat) {
            stat = { games: 0, wins: 0, totalPurchaseTime: 0 };
            orderItemMap.set(itemId, stat);
          }
          stat.games++;
          if (wasWin) stat.wins++;
          stat.totalPurchaseTime += match.info.gameDuration;
        }
      }

      // Matchup stats — track against each enemy
      const enemyTeam = match.info.participants.filter(
        (p) => p.teamId !== participant.teamId,
      );

      let mItemMap = matchupStats.get(key);
      if (!mItemMap) {
        mItemMap = new Map();
        matchupStats.set(key, mItemMap);
      }

      for (const itemId of items) {
        let mChampMap = mItemMap.get(itemId);
        if (!mChampMap) {
          mChampMap = new Map();
          mItemMap.set(itemId, mChampMap);
        }

        for (const enemy of enemyTeam) {
          let mStat = mChampMap.get(enemy.championId);
          if (!mStat) {
            mStat = { games: 0, wins: 0 };
            mChampMap.set(enemy.championId, mStat);
          }
          mStat.games++;
          if (wasWin) mStat.wins++;
        }
      }
    }
  }

  // Clear existing stats
  console.log("   Clearing old stats...");
  await db.run(sql`DELETE FROM champion_item_stats`);
  await db.run(sql`DELETE FROM champion_matchup_stats`);

  // Write champion_item_stats (any-order)
  console.log("   Writing champion item stats...");
  let itemsWritten = 0;

  for (const [key, itemMap] of championStats) {
    const [championIdStr, patch] = key.split(":");
    const championId = Number(championIdStr);

    for (const [itemId, stat] of itemMap) {
      await db.run(sql`
        INSERT INTO champion_item_stats (champion_id, item_id, purchase_order, games_played, wins, avg_purchase_time, patch)
        VALUES (${championId}, ${itemId}, 0, ${stat.games}, ${stat.wins}, ${stat.games > 0 ? Math.round(stat.totalPurchaseTime / stat.games) : 0}, ${patch})
        ON CONFLICT(champion_id, item_id, purchase_order, patch)
        DO UPDATE SET games_played = ${stat.games}, wins = ${stat.wins}, avg_purchase_time = ${stat.games > 0 ? Math.round(stat.totalPurchaseTime / stat.games) : 0}
      `);
      itemsWritten++;
    }
  }

  // Write order-specific stats
  for (const [key, orderMap] of orderStats) {
    const [championIdStr, patch] = key.split(":");
    const championId = Number(championIdStr);

    for (const [orderNum, itemMap] of orderMap) {
      for (const [itemId, stat] of itemMap) {
        await db.run(sql`
          INSERT INTO champion_item_stats (champion_id, item_id, purchase_order, games_played, wins, avg_purchase_time, patch)
          VALUES (${championId}, ${itemId}, ${orderNum}, ${stat.games}, ${stat.wins}, ${stat.games > 0 ? Math.round(stat.totalPurchaseTime / stat.games) : 0}, ${patch})
          ON CONFLICT(champion_id, item_id, purchase_order, patch)
          DO UPDATE SET games_played = ${stat.games}, wins = ${stat.wins}, avg_purchase_time = ${stat.games > 0 ? Math.round(stat.totalPurchaseTime / stat.games) : 0}
        `);
        itemsWritten++;
      }
    }
  }

  // Write matchup stats
  console.log("   Writing matchup stats...");
  let matchupsWritten = 0;

  for (const [key, mItemMap] of matchupStats) {
    const [championIdStr, patch] = key.split(":");
    const championId = Number(championIdStr);

    for (const [itemId, mChampMap] of mItemMap) {
      for (const [vsChampionId, stat] of mChampMap) {
        await db.run(sql`
          INSERT INTO champion_matchup_stats (champion_id, item_id, vs_champion_id, games_played, wins, patch)
          VALUES (${championId}, ${itemId}, ${vsChampionId}, ${stat.games}, ${stat.wins}, ${patch})
          ON CONFLICT(champion_id, item_id, vs_champion_id, patch)
          DO UPDATE SET games_played = ${stat.games}, wins = ${stat.wins}
        `);
        matchupsWritten++;
      }
    }
  }

  result.championsProcessed = championStats.size;
  result.totalItemsTracked = itemsWritten;
  result.matchupsTracked = matchupsWritten;

  console.log(`   Analyzed ${result.matchesAnalyzed} matches`);
  console.log(`   Processed ${result.championsProcessed} champion-patch combinations`);
  console.log(`   Tracked ${result.totalItemsTracked} item entries`);
  console.log(`   Tracked ${result.matchupsTracked} matchup entries`);

  return result;
}
