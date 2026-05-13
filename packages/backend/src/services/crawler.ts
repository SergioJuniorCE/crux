/**
 * Crawler service — manages a PUUID queue for crawling the Riot API.
 *
 * The crawler:
 * 1. Picks a PUUID from the queue (status = 'queued')
 * 2. Sets it to 'in_progress'
 * 3. Fetches their match list
 * 4. Fetches each match detail
 * 5. Extracts other participants, checks their rank, enqueues Master+ PUUIDs
 * 6. Marks the original PUUID as 'done'
 *
 * The queue is SQLite-backed for crash recovery.
 */

import { db } from "../db";
import { crawlerQueue, matches, scriptsRun } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { RateLimiter } from "./rateLimiter";
import type { PlatformRegion } from "../types/riot";
import { REGIONAL_BY_PLATFORM } from "../types/riot";
import type { RiotMatch, RiotLeagueEntry } from "../types/riot";
import https from "node:https";

export type CrawlerOptions = {
  /** Maximum number of PUUIDs to process in this run (0 = unlimited) */
  maxPuuids?: number;
  /** Maximum matches to fetch per PUUID */
  matchesPerPuuid?: number;
  /** Rate limiter instance */
  limiter?: RateLimiter;
  /** Called after each PUUID is processed */
  onProgress?: (stats: CrawlerProgress) => void;
  /** Called after each batch of N new matches for auto-aggregation */
  autoAggregateInterval?: number;
  /** Function to call for auto-aggregation */
  onAutoAggregate?: () => Promise<void>;
};

export type CrawlerProgress = {
  totalProcessed: number;
  totalMatchesFetched: number;
  totalEnqueued: number;
  errors: number;
  elapsedMs: number;
};

const TIER_RANK: Record<string, number> = {
  IRON: 0, BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4, EMERALD: 5,
  DIAMOND: 6, MASTER: 7, GRANDMASTER: 8, CHALLENGER: 9,
};

function getApiKey(): string {
  const key = process.env.RIOT_API_KEY?.trim();
  if (!key) throw new Error("Missing Riot API key");
  return key;
}

function regionalHost(platform: string): string {
  return `${REGIONAL_BY_PLATFORM[platform as PlatformRegion]}.api.riotgames.com`;
}

function platformHost(platform: string): string {
  return `${platform}.api.riotgames.com`;
}

async function riotRequest<T>(host: string, path: string, apiKey: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: host, path, method: "GET", headers: { "X-Riot-Token": apiKey, Accept: "application/json", "User-Agent": "CruxCrawler/0.1" }, timeout: 15_000 },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          const status = res.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            let msg = `Riot API ${status}`;
            try { const p = JSON.parse(body) as { status?: { message?: string } }; if (p?.status?.message) msg += `: ${p.status.message}`; } catch { /* */ }
            reject(new Error(msg)); return;
          }
          resolve(JSON.parse(body) as T);
        });
      },
    );
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
    req.on("error", reject);
    req.end();
  });
}

/**
 * Check if a player is Master+ by their league entries.
 */
function isMasterOrHigher(entries: RiotLeagueEntry[]): boolean {
  return entries.some((entry) => {
    const tier = entry.tier?.toUpperCase() ?? "";
    return (TIER_RANK[tier] ?? 0) >= (TIER_RANK.MASTER ?? 7);
  });
}

/**
 * Enqueue a PUUID for crawling.
 */
export async function enqueuePuuid(puuid: string, platform: string): Promise<void> {
  await db.insert(crawlerQueue).values({
    puuid,
    platform,
    status: "queued",
    enqueuedAt: new Date(),
  }).onConflictDoNothing();
}

/**
 * Get the count of queued PUUIDs.
 */
export async function getQueueLength(): Promise<number> {
  const result = await db.select({ count: db.$count(crawlerQueue) }).from(crawlerQueue).where(eq(crawlerQueue.status, "queued"));
  return result[0]?.count ?? 0;
}

/**
 * Seed the crawler queue from a Challenger league.
 */
export async function seedFromChallenger(queueType: string = "RANKED_SOLO_5x5", platform: PlatformRegion = "na1"): Promise<number> {
  const apiKey = getApiKey();
  const limiter = new RateLimiter({ capacity: 20, refillPerSec: 20 });

  await limiter.acquire();
  const leagueUrl = `/lol/league/v4/challengerleagues/by-queue/${queueType}`;
  const league = await riotRequest<{ entries: { puuid: string; summonerName: string; tier: string; rank: string; leaguePoints: number }[] }>(
    platformHost(platform),
    leagueUrl,
    apiKey,
  );

  let enqueued = 0;
  for (const entry of league.entries) {
    await enqueuePuuid(entry.puuid, platform);
    enqueued++;
  }

  console.log(`   Seeded ${enqueued} Challenger players into the queue (${platform}, ${queueType})`);
  return enqueued;
}

/**
 * Seed Master+ players from all league pages.
 */
export async function seedFromMasterPlus(platform: PlatformRegion = "na1", queueType: string = "RANKED_SOLO_5x5"): Promise<number> {
  const apiKey = getApiKey();
  const limiter = new RateLimiter({ capacity: 20, refillPerSec: 20 });

  let enqueued = 0;
  const tiers = ["MASTER", "GRANDMASTER", "CHALLENGER"];
  const divisions = ["I", "II", "III", "IV"];

  for (const tier of tiers) {
    if (tier === "CHALLENGER") {
      // Challenger uses a different endpoint
      await limiter.acquire();
      try {
        const league = await riotRequest<{ entries: { puuid: string }[] }>(
          platformHost(platform),
          `/lol/league/v4/challengerleagues/by-queue/${queueType}`,
          apiKey,
        );
        for (const entry of league.entries) {
          await enqueuePuuid(entry.puuid, platform);
          enqueued++;
        }
        console.log(`   ${tier}: ${league.entries.length} players enqueued`);
      } catch (err) {
        console.warn(`   ⚠ Failed to fetch ${tier}: ${(err as Error).message}`);
      }
      continue;
    }

    if (tier === "GRANDMASTER") {
      await limiter.acquire();
      try {
        const league = await riotRequest<{ entries: { puuid: string }[] }>(
          platformHost(platform),
          `/lol/league/v4/grandmasterleagues/by-queue/${queueType}`,
          apiKey,
        );
        for (const entry of league.entries) {
          await enqueuePuuid(entry.puuid, platform);
          enqueued++;
        }
        console.log(`   ${tier}: ${league.entries.length} players enqueued`);
      } catch (err) {
        console.warn(`   ⚠ Failed to fetch ${tier}: ${(err as Error).message}`);
      }
      continue;
    }

    // Master — paginated
    for (const division of divisions) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        await limiter.acquire();
        try {
          const entries = await riotRequest<RiotLeagueEntry[]>(
            platformHost(platform),
            `/lol/league/v4/entries/${queueType}/${tier}/${division}?page=${page}`,
            apiKey,
          );

          if (entries.length === 0) {
            hasMore = false;
            continue;
          }

          for (const entry of entries) {
            await enqueuePuuid(entry.puuid ?? entry.summonerId, platform);
            enqueued++;
          }

          console.log(`   ${tier} ${division} page ${page}: ${entries.length} players`);
          page++;
        } catch {
          hasMore = false;
        }
      }
    }
  }

  console.log(`\n✅ Seeded ${enqueued} Master+ players into the queue`);
  return enqueued;
}

/**
 * Process the next PUUID from the queue.
 * Returns the number of matches fetched, or -1 if queue is empty.
 */
async function processNextPuuid(
  limiter: RateLimiter,
  apiKey: string,
  matchesPerPuuid: number,
  autoAggregateInterval: number,
  onAutoAggregate?: () => Promise<void>,
  progress?: CrawlerProgress,
): Promise<number> {
  // Find next queued PUUID
  const next = await db.select().from(crawlerQueue)
    .where(eq(crawlerQueue.status, "queued"))
    .limit(1)
    .get();

  if (!next) return -1;

  // Mark as in_progress
  await db.update(crawlerQueue).set({
    status: "in_progress",
    lastAttemptAt: new Date(),
    attempts: next.attempts + 1,
  }).where(eq(crawlerQueue.puuid, next.puuid));

  const puuid = next.puuid;
  const platform = next.platform as PlatformRegion;

  try {
    // Fetch match IDs
    await limiter.acquire();
    const matchIds = await riotRequest<string[]>(
      regionalHost(platform),
      `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${matchesPerPuuid}`,
      apiKey,
    );

    let matchesFetched = 0;

    for (const matchId of matchIds) {
      await limiter.acquire();

      try {
        const match = await riotRequest<RiotMatch>(
          regionalHost(platform),
          `/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
          apiKey,
        );

        await db.insert(matches).values({
          matchId: match.metadata.matchId,
          platform,
          dataJson: JSON.stringify(match),
          fetchedAt: new Date(),
        }).onConflictDoUpdate({
          target: matches.matchId,
          set: { dataJson: JSON.stringify(match), fetchedAt: new Date() },
        });

        matchesFetched++;

        // Extract other participants — check and enqueue
        for (const participant of match.info.participants) {
          const otherPuuid = participant.puuid;
          if (otherPuuid === puuid) continue;

          // Check if already in queue or processed
          const existing = await db.select({ status: crawlerQueue.status })
            .from(crawlerQueue)
            .where(eq(crawlerQueue.puuid, otherPuuid))
            .get();

          if (existing) continue;

          // Check rank — fetch league entries
          await limiter.acquire();
          try {
            const leagueEntries = await riotRequest<RiotLeagueEntry[]>(
              platformHost(platform),
              `/lol/league/v4/entries/by-puuid/${encodeURIComponent(otherPuuid)}`,
              apiKey,
            );

            if (isMasterOrHigher(leagueEntries)) {
              await enqueuePuuid(otherPuuid, platform);
              if (progress) progress.totalEnqueued++;
            }
          } catch {
            // Couldn't get rank — skip this participant
          }
        }
      } catch {
        // Failed to fetch match detail — skip
      }
    }

    // Mark as done
    await db.update(crawlerQueue).set({
      status: "done",
    }).where(eq(crawlerQueue.puuid, puuid));

    if (progress) {
      progress.totalProcessed++;
      progress.totalMatchesFetched += matchesFetched;
    }

    // Auto-aggregate if needed
    if (autoAggregateInterval > 0 && onAutoAggregate && matchesFetched > 0) {
      const totalMatches = await db.select({ count: db.$count(matches) }).from(matches);
      const totalCount = totalMatches[0]?.count ?? 0;
      if (totalCount % autoAggregateInterval < matchesFetched) {
        await onAutoAggregate();
      }
    }

    return matchesFetched;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(crawlerQueue).set({
      status: "error",
      errorMessage: msg,
    }).where(eq(crawlerQueue.puuid, puuid));

    if (progress) progress.errors++;
    return 0;
  }
}

/**
 * Main crawl loop. Processes PUUIDs from the queue until empty or maxPuuids reached.
 */
export async function crawl(options: CrawlerOptions = {}): Promise<CrawlerProgress> {
  const {
    maxPuuids = 0,
    matchesPerPuuid = 20,
    limiter: externalLimiter,
    onProgress,
    autoAggregateInterval = 0,
    onAutoAggregate,
  } = options;

  const apiKey = getApiKey();
  const limiter = externalLimiter ?? new RateLimiter({ capacity: 20, refillPerSec: 20 });
  const startTime = Date.now();

  const progress: CrawlerProgress = {
    totalProcessed: 0,
    totalMatchesFetched: 0,
    totalEnqueued: 0,
    errors: 0,
    elapsedMs: 0,
  };

  let processed = 0;

  while (true) {
    if (maxPuuids > 0 && processed >= maxPuuids) break;

    const result = await processNextPuuid(
      limiter, apiKey, matchesPerPuuid,
      autoAggregateInterval, onAutoAggregate, progress,
    );

    if (result === -1) break; // Queue empty

    processed++;
    progress.elapsedMs = Date.now() - startTime;

    if (onProgress) onProgress(progress);

    // Log every 10 PUUIDs
    if (processed % 10 === 0) {
      console.log(`   Crawled ${processed} PUUIDs, ${progress.totalMatchesFetched} matches, ${progress.totalEnqueued} enqueued, ${progress.errors} errors`);
    }
  }

  progress.elapsedMs = Date.now() - startTime;
  return progress;
}
