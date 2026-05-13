#!/usr/bin/env bun
/**
 * aggregate.ts — Recompute champion item stats from stored match data.
 *
 * Usage:
 *   bun run src/scripts/aggregate.ts
 *   bun run src/scripts/aggregate.ts --patch 14.9
 */

import { db } from "../db";
import { scriptsRun } from "../db/schema";
import { eq } from "drizzle-orm";
import { aggregateAll } from "../services/statsAggregator";
import { parseCliFlags } from "./config";

async function main() {
  const flags = parseCliFlags();
  const patch = flags.patch ? String(flags.patch) : undefined;

  console.log(`\n📊 Stats Aggregation`);
  if (patch) console.log(`   Filtering to patch: ${patch}`);
  console.log("");

  const startTime = Date.now();

  const runId = await db.insert(scriptsRun).values({
    scriptName: "aggregate",
    args: JSON.stringify(flags),
    startedAt: new Date(),
  }).returning({ id: scriptsRun.id }).then((r) => r[0]?.id ?? null);

  try {
    const result = await aggregateAll(patch);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Aggregation complete in ${elapsed}s`);
    console.log(`   Matches analyzed: ${result.matchesAnalyzed}`);
    console.log(`   Champions processed: ${result.championsProcessed}`);
    console.log(`   Item entries written: ${result.totalItemsTracked}`);
    console.log(`   Matchup entries written: ${result.matchupsTracked}`);

    if (runId) {
      await db.update(scriptsRun).set({
        summonersScraped: result.championsProcessed,
        matchesScraped: result.matchesAnalyzed,
        completedAt: new Date(),
      }).where(eq(scriptsRun.id, runId));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Error: ${msg}`);
    if (runId) await db.update(scriptsRun).set({ errors: 1, completedAt: new Date() }).where(eq(scriptsRun.id, runId));
    process.exit(1);
  }
}

await main();
