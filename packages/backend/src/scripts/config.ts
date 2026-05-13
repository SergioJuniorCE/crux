/**
 * Scraper configuration loader.
 * Reads from scraper.config.json, CLI flags, and environment variables.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "../../scraper.config.json");

export type CronConfig = {
  enabled: boolean;
  schedule: string;
  maxPuuidsPerRun: number;
  matchesPerPuuid: number;
  autoAggregate: boolean;
};

export type ScraperConfig = {
  concurrency: number;
  rateLimitPerSecond: number;
  rateLimitBurst: number;
  defaultMatchCount: number;
  delayBetweenRequestsMs: number;
  crawlerTargetRank: string;
  crawlerQueueSize: number;
  crawlerAutoAggregateInterval: number;
  cron: CronConfig;
};

const DEFAULT_CONFIG: ScraperConfig = {
  concurrency: 3,
  rateLimitPerSecond: 20,
  rateLimitBurst: 100,
  defaultMatchCount: 20,
  delayBetweenRequestsMs: 50,
  crawlerTargetRank: "MASTER",
  crawlerQueueSize: 1_000,
  crawlerAutoAggregateInterval: 100,
  cron: {
    enabled: false,
    schedule: "0 6 * * *",
    maxPuuidsPerRun: 50,
    matchesPerPuuid: 20,
    autoAggregate: true,
  },
};

export function loadConfig(): ScraperConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      const fileConfig = JSON.parse(raw) as Partial<ScraperConfig>;
      return { ...DEFAULT_CONFIG, ...fileConfig };
    }
  } catch (err) {
    console.warn(`Warning: could not read scraper config: ${err}`);
  }
  return { ...DEFAULT_CONFIG };
}

export function parseCliFlags(): Record<string, string | number | boolean> {
  const flags: Record<string, string | number | boolean> = {};
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const next = args[i + 1];

    // Boolean flag (no value following, or next is another flag)
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    // String or numeric value
    const num = Number(next);
    flags[key] = Number.isFinite(num) ? num : next;
    i++; // skip value
  }

  return flags;
}
