#!/usr/bin/env bun
/**
 * scrape-seed.ts — Start the crawler from Challenger/Master+ players.
 *
 * Usage:
 *   bun run src/scripts/scrape-seed.ts --region na1 --queue RANKED_SOLO_5x5
 *   bun run src/scripts/scrape-seed.ts --region na1 --queue RANKED_SOLO_5x5 --max-puuids 50 --matches-per-puuid 20
 *   bun run src/scripts/scrape-seed.ts --region na1 --seed-only  (just seed, don't crawl)
 */

import { db } from "../db";
import { scriptsRun } from "../db/schema";
import { eq } from "drizzle-orm";
import { RateLimiter } from "../services/rateLimiter";
import { crawl, seedFromMasterPlus } from "../services/crawler";
import { loadConfig, parseCliFlags } from "./config";
import { aggregateAll } from "../services/statsAggregator";
import type { PlatformRegion } from "../types/riot";

const ALLOWED_REGIONS = [
  "na1", "br1", "la1", "la2", "euw1", "eun1", "tr1", "ru",
  "kr", "jp1", "oc1", "ph2", "sg2", "th2", "tw2", "vn2",
] as const;

async function main() {
  const config = loadConfig();
  const flags = parseCliFlags();
  const apiKey = process.env.RIOT_API_KEY?.trim();

  if (!apiKey) {
    console.error("Error: Missing Riot API key. Set RIOT_API_KEY in .env.");
    process.exit(1);
  }

  const region = (String(flags.region || "") || "na1").toLowerCase() as PlatformRegion;
  if (!(ALLOWED_REGIONS as readonly string[]).includes(region)) {
    console.error(`Error: Invalid region "${region}".`);
    process.exit(1);
  }

  const queueType = String(flags.queue ?? flags["queue-type"] ?? "RANKED_SOLO_5x5");
  const maxPuuids = Number(flags["max-puuids"] ?? flags.maxPuuids ?? 0);
  const matchesPerPuuid = Number(flags["matches-per-puuid"] ?? flags.matchesPerPuuid ?? config.defaultMatchCount);
  const seedOnly = Boolean(flags["seed-only"] ?? flags.seedOnly ?? false);
  const skipAggregate = Boolean(flags["skip-aggregate"] ?? flags.skipAggregate ?? false);

  const startTime = Date.now();

  console.log(`\n🌱 Crawler Seed Script`);
  console.log(`   Region: ${region}, Queue: ${queueType}`);
  console.log(`   Max PUUIDs: ${maxPuuids || 'unlimited'}, Matches/PUUID: ${matchesPerPuuid}`);

  const runId = await db.insert(scriptsRun).values({
    scriptName: "scrape-seed",
    args: JSON.stringify(flags),
    startedAt: new Date(),
  }).returning({ id: scriptsRun.id }).then((r) => r[0]?.id ?? null);

  try {
    // 1. Seed Master+ players
    console.log("\n📡 Seeding Master+ players...");
    const seeded = await seedFromMasterPlus(region, queueType);
    console.log(`   Total seeded: ${seeded}`);

    if (seedOnly) {
      console.log("\n✅ Seed-only mode. Queue populated. Run without --seed-only to crawl.");
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   Completed in ${elapsed}s`);
      if (runId) await db.update(scriptsRun).set({ completedAt: new Date() }).where(eq(scriptsRun.id, runId));
      return;
    }

    // 2. Crawl
    console.log("\n🕷️ Starting crawl...");
    const limiter = new RateLimiter({
      capacity: config.rateLimitBurst,
      refillPerSec: config.rateLimitPerSecond,
    });

    // Auto-aggregation handler
    const onAutoAggregate = skipAggregate
      ? undefined
      : async () => {
          console.log("   📊 Auto-aggregating stats...");
          try {
            const stats = await aggregateAll();
            console.log(`   📊 Aggregated ${stats.championsProcessed} champions, ${stats.totalItemsTracked} item entries`);
          } catch (err) {
            console.warn(`   ⚠ Auto-aggregation failed: ${err}`);
          }
        };

    // Run initial aggregation
    if (!skipAggregate && onAutoAggregate) {
      console.log("   📊 Initial aggregation...");
      await onAutoAggregate();
    }

    const progress = await crawl({
      maxPuuids,
      matchesPerPuuid,
      limiter,
      autoAggregateInterval: config.crawlerAutoAggregateInterval,
      onAutoAggregate: skipAggregate ? undefined : onAutoAggregate,
      onProgress: (stats) => {
        const rate = stats.elapsedMs > 0
          ? Math.round((stats.totalProcessed / stats.elapsedMs) * 1000)
          : 0;
        console.log(`   Progress: ${stats.totalProcessed} PUUIDs, ${stats.totalMatchesFetched} matches, ${stats.totalEnqueued} enqueued, ${rate}/min`);
      },
    });

    // Final aggregation
    if (!skipAggregate) {
      console.log("\n📊 Final aggregation...");
      try {
        const stats = await aggregateAll();
        console.log(`   Aggregated ${stats.championsProcessed} champions, ${stats.totalItemsTracked} item entries`);
      } catch (err) {
        console.warn(`   ⚠ Final aggregation failed: ${err}`);
      }
    }

    if (runId) {
      await db.update(scriptsRun).set({
        summonersScraped: progress.totalProcessed,
        matchesScraped: progress.totalMatchesFetched,
        completedAt: new Date(),
      }).where(eq(scriptsRun.id, runId));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Crawl complete!`);
    console.log(`   Processed: ${progress.totalProcessed} PUUIDs`);
    console.log(`   Matches fetched: ${progress.totalMatchesFetched}`);
    console.log(`   New PUUIDs enqueued: ${progress.totalEnqueued}`);
    console.log(`   Errors: ${progress.errors}`);
    console.log(`   Time: ${elapsed}s`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Error: ${msg}`);
    if (runId) await db.update(scriptsRun).set({ errors: 1, completedAt: new Date() }).where(eq(scriptsRun.id, runId));
    process.exit(1);
  }
}

await main();
