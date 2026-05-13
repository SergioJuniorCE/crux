#!/usr/bin/env bun
/**
 * cron.ts — Standalone cron runner for Windows Task Scheduler.
 *
 * Runs one crawl-and-aggregate cycle, then exits.
 *
 * Task Scheduler setup (PowerShell as Admin):
 *   $action = New-ScheduledTaskAction -Execute "bun" -Argument "run src/scripts/cron.ts" -WorkingDirectory "C:\full\path\to\crux\packages\backend"
 *   $trigger = New-ScheduledTaskTrigger -Daily -At 06:00AM
 *   Register-ScheduledTask -TaskName "CruxCrawler" -Action $action -Trigger $trigger -RunLevel Highest
 *
 * Or run manually:
 *   bun run src/scripts/cron.ts
 *   bun run src/scripts/cron.ts --max-puuids 20 --no-aggregate
 */

import { runCronCycle } from "../services/scheduler";
import { parseCliFlags } from "./config";

const flags = parseCliFlags();

const maxPuuids = Number(flags["max-puuids"] ?? flags.maxPuuids ?? 50);
const matchesPerPuuid = Number(flags["matches-per-puuid"] ?? flags.matchesPerPuuid ?? 20);
const autoAggregate = !(flags["no-aggregate"] ?? flags.noAggregate ?? false);

await runCronCycle({
  maxPuuids,
  matchesPerPuuid,
  autoAggregate,
  logToDb: true,
});
