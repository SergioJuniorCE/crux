#!/usr/bin/env bun
/**
 * scrape-matches.ts — Fetch additional matches for a known PUUID.
 *
 * Usage:
 *   bun run src/scripts/scrape-matches.ts --puuid <x> --region na1 --count 50
 *   bun run src/scripts/scrape-matches.ts --puuid <x> --region na1 --count 100 --start 50
 */

import { db } from "../db";
import { matches, scriptsRun } from "../db/schema";
import { eq } from "drizzle-orm";
import { RateLimiter } from "../services/rateLimiter";
import { loadConfig, parseCliFlags } from "./config";
import type { PlatformRegion } from "../types/riot";
import { REGIONAL_BY_PLATFORM, type RiotMatch } from "../types/riot";
import https from "node:https";

const ALLOWED_REGIONS = [
  "na1", "br1", "la1", "la2", "euw1", "eun1", "tr1", "ru",
  "kr", "jp1", "oc1", "ph2", "sg2", "th2", "tw2", "vn2",
] as const;

function getApiKey(): string {
  const key = process.env.RIOT_API_KEY?.trim();
  if (!key) { console.error("Error: Missing Riot API key."); process.exit(1); }
  return key;
}

function regionalHost(platform: PlatformRegion): string {
  return `${REGIONAL_BY_PLATFORM[platform]}.api.riotgames.com`;
}

async function riotRequest<T>(host: string, path: string, apiKey: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: host, path, method: "GET", headers: { "X-Riot-Token": apiKey, Accept: "application/json", "User-Agent": "CruxScraper/0.1" }, timeout: 15_000 },
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

async function main() {
  const config = loadConfig();
  const flags = parseCliFlags();
  const apiKey = getApiKey();

  const puuid = String(flags.puuid || "");
  const region = (String(flags.region || "") || "na1").toLowerCase() as PlatformRegion;
  const count = Number(flags.count ?? flags["match-count"] ?? config.defaultMatchCount);
  const start = Number(flags.start ?? 0);

  if (!puuid) {
    console.error("Error: --puuid is required.");
    console.error("  bun run src/scripts/scrape-matches.ts --puuid <x> --region na1 --count 50");
    process.exit(1);
  }
  if (!(ALLOWED_REGIONS as readonly string[]).includes(region)) {
    console.error(`Error: Invalid region "${region}".`);
    process.exit(1);
  }

  const limiter = new RateLimiter({
    capacity: config.rateLimitBurst,
    refillPerSec: config.rateLimitPerSecond,
  });

  const startTime = Date.now();
  console.log(`\n🔍 Backfilling matches for PUUID: ${puuid.substring(0, 12)}...`);
  console.log(`   Region: ${region}, Start: ${start}, Count: ${count}`);

  const runId = await db.insert(scriptsRun).values({
    scriptName: "scrape-matches",
    args: JSON.stringify(flags),
    startedAt: new Date(),
  }).returning({ id: scriptsRun.id }).then((r) => r[0]?.id ?? null);

  try {
    // 1. Fetch match IDs
    await limiter.acquire();
    console.log("   Fetching match IDs...");
    const matchIds = await riotRequest<string[]>(
      regionalHost(region),
      `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=${start}&count=${count}`,
      apiKey,
    );
    console.log(`   → Got ${matchIds.length} match IDs`);

    if (matchIds.length === 0) {
      console.log("   No matches found.");
      if (runId) await db.update(scriptsRun).set({ completedAt: new Date() }).where(eq(scriptsRun.id, runId));
      return;
    }

    // 2. Fetch each match detail
    let matchesScraped = 0;
    let errors = 0;

    for (let i = 0; i < matchIds.length; i++) {
      const matchId = matchIds[i];
      await limiter.acquire();

      try {
        const match = await riotRequest<RiotMatch>(
          regionalHost(region),
          `/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
          apiKey,
        );

        await db.insert(matches).values({
          matchId: match.metadata.matchId,
          platform: region,
          dataJson: JSON.stringify(match),
          fetchedAt: new Date(),
        }).onConflictDoUpdate({
          target: matches.matchId,
          set: { dataJson: JSON.stringify(match), fetchedAt: new Date() },
        });

        matchesScraped++;
        process.stdout.write(`\r   Match ${i + 1}/${matchIds.length} ✓ (${matchesScraped} total)`);
      } catch (err) {
        errors++;
        process.stdout.write(`\r   Match ${i + 1}/${matchIds.length} ✗ (${(err as Error).message.substring(0, 40)})`);
      }
    }
    console.log("");

    if (runId) {
      await db.update(scriptsRun).set({
        matchesScraped,
        errors,
        completedAt: new Date(),
      }).where(eq(scriptsRun.id, runId));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Done! ${matchesScraped} matches scraped, ${errors} errors in ${elapsed}s`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Error: ${msg}`);
    if (runId) await db.update(scriptsRun).set({ errors: 1, completedAt: new Date() }).where(eq(scriptsRun.id, runId));
    process.exit(1);
  }
}

await main();
