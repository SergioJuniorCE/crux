/**
 * Scheduler service — runs scraper/aggregator on a cron schedule.
 *
 * Uses node-cron with standard cron syntax (e.g. "0 6 * * *" = 6 AM daily).
 *
 * Can be:
 *   - Started inside the backend server (auto-starts with the app)
 *   - Run standalone via `bun run src/scripts/cron.ts` for Task Scheduler
 */

import nodeCron from "node-cron";
import type { ScheduledTask } from "node-cron";
import { db } from "../db";
import { scriptsRun } from "../db/schema";
import { eq } from "drizzle-orm";
import { crawl, seedFromMasterPlus } from "./crawler";
import { aggregateAll } from "./statsAggregator";
import { loadConfig } from "../scripts/config";
import { RateLimiter } from "./rateLimiter";

export type SchedulerOptions = {
  /** Cron expression (default: "0 6 * * *" = daily at 6 AM) */
  schedule?: string;
  /** Max PUUIDs to process per cron run (default: 50) */
  maxPuuids?: number;
  /** Matches to fetch per PUUID (default: 20) */
  matchesPerPuuid?: number;
  /** Whether to auto-aggregate after crawling (default: true) */
  autoAggregate?: boolean;
  /** Whether to log to the scripts_run table (default: true) */
  logToDb?: boolean;
};

const DEFAULT_OPTIONS: Required<SchedulerOptions> = {
  schedule: "0 6 * * *",
  maxPuuids: 50,
  matchesPerPuuid: 20,
  autoAggregate: true,
  logToDb: true,
};

/**
 * Run one crawl-and-aggregate cycle. Returns a summary string.
 */
export async function runCronCycle(options: SchedulerOptions = {}): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const config = loadConfig();
  const startTime = Date.now();

  console.log(`\n⏰ Cron cycle starting at ${new Date().toISOString()}`);
  console.log(`   Max PUUIDs: ${opts.maxPuuids}, Matches/PUUID: ${opts.matchesPerPuuid}`);

  let runId: number | null = null;
  if (opts.logToDb) {
    runId = await db.insert(scriptsRun).values({
      scriptName: "cron",
      args: JSON.stringify(opts),
      startedAt: new Date(),
    }).returning({ id: scriptsRun.id }).then((r) => r[0]?.id ?? null);
  }

  try {
    // 1. Seed fresh Master+ players
    console.log("\n📡 Seeding Master+ players...");
    const seeded = await seedFromMasterPlus("na1", "RANKED_SOLO_5x5");
    console.log(`   Seeded: ${seeded} players into the crawler queue`);

    // 2. Crawl
    console.log("\n🕷️ Crawling...");
    const limiter = new RateLimiter({
      capacity: config.rateLimitBurst,
      refillPerSec: config.rateLimitPerSecond,
    });

    const progress = await crawl({
      maxPuuids: opts.maxPuuids,
      matchesPerPuuid: opts.matchesPerPuuid,
      limiter,
      onProgress: (stats) => {
        const rate = stats.elapsedMs > 0
          ? Math.round((stats.totalProcessed / stats.elapsedMs) * 60000)
          : 0;
        console.log(`   ${stats.totalProcessed} PUUIDs, ${stats.totalMatchesFetched} matches, ${rate}/min`);
      },
    });

    // 3. Aggregate
    if (opts.autoAggregate) {
      console.log("\n📊 Aggregating stats...");
      const aggResult = await aggregateAll();
      console.log(`   ${aggResult.championsProcessed} champions, ${aggResult.totalItemsTracked} items`);
    }

    // Update script log
    if (runId) {
      await db.update(scriptsRun).set({
        summonersScraped: progress.totalProcessed,
        matchesScraped: progress.totalMatchesFetched,
        errors: progress.errors,
        completedAt: new Date(),
      }).where(eq(scriptsRun.id, runId));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const summary =
      `✅ Cron cycle complete in ${elapsed}s · ` +
      `${progress.totalProcessed} PUUIDs, ${progress.totalMatchesFetched} matches, ` +
      `${progress.totalEnqueued} enqueued, ${progress.errors} errors`;

    console.log(`\n${summary}`);
    return summary;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Cron cycle failed: ${msg}`);
    if (runId) {
      await db.update(scriptsRun).set({ errors: 1, completedAt: new Date() }).where(eq(scriptsRun.id, runId));
    }
    throw err;
  }
}

let cronTask: ScheduledTask | null = null;

/**
 * Start the cron scheduler. This should be called during server startup.
 */
export function startScheduler(options: SchedulerOptions = {}): void {
  const config = loadConfig();
  const cronConfig = config.cron;

  // Config file overrides defaults, options override config
  const schedule = options.schedule ?? cronConfig?.schedule ?? DEFAULT_OPTIONS.schedule;
  const maxPuuids = options.maxPuuids ?? cronConfig?.maxPuuidsPerRun ?? DEFAULT_OPTIONS.maxPuuids;
  const matchesPerPuuid = options.matchesPerPuuid ?? cronConfig?.matchesPerPuuid ?? DEFAULT_OPTIONS.matchesPerPuuid;
  const autoAggregate = options.autoAggregate ?? cronConfig?.autoAggregate ?? DEFAULT_OPTIONS.autoAggregate;

  // Check if enabled
  const enabled = cronConfig?.enabled ?? false;
  if (!enabled && !options.schedule) {
    console.log("⏰ Cron scheduler disabled (set cron.enabled=true in scraper.config.json)");
    return;
  }

  if (!nodeCron.validate(schedule)) {
    console.error(`⏰ Invalid cron expression: "${schedule}"`);
    return;
  }

  cronTask = nodeCron.schedule(schedule, () => {
    runCronCycle({ maxPuuids, matchesPerPuuid, autoAggregate }).catch((err) => {
      console.error("Cron cycle error:", err);
    });
  });

  console.log(`⏰ Cron scheduler started: "${schedule}" (${maxPuuids} PUUIDs/run)`);
}

/**
 * Stop the cron scheduler.
 */
export function stopScheduler(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log("⏰ Cron scheduler stopped");
  }
}
