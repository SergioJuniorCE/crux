#!/usr/bin/env bun
/**
 * scrape-summoner.ts — Fetch one summoner profile + recent matches.
 *
 * Usage:
 *   bun run src/scripts/scrape-summoner.ts --region na1 --name "Faker" --tag "KR1"
 *   bun run src/scripts/scrape-summoner.ts --region na1 --name "Faker" --tag "KR1" --match-count 50
 */

import { db } from "../db";
import { summoners, matches, scriptsRun } from "../db/schema";
import { eq } from "drizzle-orm";
import { RateLimiter } from "../services/rateLimiter";
import { loadConfig, parseCliFlags } from "./config";
import type { PlatformRegion } from "../types/riot";
import {
  REGIONAL_BY_PLATFORM,
  type RiotAccount,
  type RiotSummoner,
  type RiotLeagueEntry,
  type RiotMatch,
} from "../types/riot";
import https from "node:https";

const ALLOWED_REGIONS = [
  "na1", "br1", "la1", "la2", "euw1", "eun1", "tr1", "ru",
  "kr", "jp1", "oc1", "ph2", "sg2", "th2", "tw2", "vn2",
] as const;

function getApiKey(): string {
  const key = process.env.RIOT_API_KEY?.trim();
  if (!key) {
    console.error("Error: Missing Riot API key. Set RIOT_API_KEY in .env.");
    process.exit(1);
  }
  return key;
}

function regionalHost(platform: PlatformRegion): string {
  return `${REGIONAL_BY_PLATFORM[platform]}.api.riotgames.com`;
}

function platformHost(platform: PlatformRegion): string {
  return `${platform}.api.riotgames.com`;
}

async function riotRequest<T>(host: string, path: string, apiKey: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path,
        method: "GET",
        headers: {
          "X-Riot-Token": apiKey,
          Accept: "application/json",
          "User-Agent": "CruxScraper/0.1",
        },
        timeout: 15_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          const status = res.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            let msg = `Riot API ${status}`;
            try {
              const parsed = JSON.parse(body) as { status?: { message?: string } };
              if (parsed?.status?.message) msg += `: ${parsed.status.message}`;
            } catch { /* ignore */ }
            reject(new Error(msg));
            return;
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

  const region = (String(flags.region || "") || "na1").toLowerCase() as PlatformRegion;
  if (!(ALLOWED_REGIONS as readonly string[]).includes(region)) {
    console.error(`Error: Invalid region "${region}". Use one of: ${ALLOWED_REGIONS.join(", ")}`);
    process.exit(1);
  }

  const gameName = String(flags.name || flags.gameName || "");
  const tagLine = String(flags.tag || flags.tagLine || "");
  const matchCount = Number(flags["match-count"] ?? flags.matchCount ?? config.defaultMatchCount);

  if (!gameName || !tagLine) {
    console.error("Error: --name and --tag are required. Usage:");
    console.error("  bun run src/scripts/scrape-summoner.ts --region na1 --name \"Faker\" --tag \"KR1\"");
    process.exit(1);
  }

  const limiter = new RateLimiter({
    capacity: config.rateLimitBurst,
    refillPerSec: config.rateLimitPerSecond,
  });

  const startTime = Date.now();
  console.log(`\n🔍 Scraping summoner: ${gameName}#${tagLine} (${region})`);
  console.log(`   Match count: ${matchCount}`);

  // Log script run
  const runId = await db.insert(scriptsRun).values({
    scriptName: "scrape-summoner",
    args: JSON.stringify(flags),
    startedAt: new Date(),
  }).returning({ id: scriptsRun.id }).then((r) => r[0]?.id ?? null);

  try {
    // 1. Fetch account
    await limiter.acquire();
    console.log("   Fetching account...");
    const account = await riotRequest<RiotAccount>(
      regionalHost(region),
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      apiKey,
    );
    console.log(`   → PUUID: ${account.puuid}`);

    // 2. Fetch summoner
    await limiter.acquire();
    console.log("   Fetching summoner...");
    const summoner = await riotRequest<RiotSummoner>(
      platformHost(region),
      `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(account.puuid)}`,
      apiKey,
    );

    // 3. Fetch league entries
    await limiter.acquire();
    console.log("   Fetching league entries...");
    let league: RiotLeagueEntry[] = [];
    try {
      league = await riotRequest<RiotLeagueEntry[]>(
        platformHost(region),
        `/lol/league/v4/entries/by-puuid/${encodeURIComponent(account.puuid)}`,
        apiKey,
      );
    } catch (err) {
      console.warn("   ⚠ No league data (player may be unranked)");
    }

    // 4. Fetch DataDragon version
    await limiter.acquire();
    console.log("   Fetching DataDragon version...");
    const dataDragonVersion = await new Promise<string>((resolve) => {
      const req = https.request(
        { hostname: "ddragon.leagueoflegends.com", path: "/api/versions.json", method: "GET", timeout: 10_000 },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            try { resolve((JSON.parse(Buffer.concat(chunks).toString()) as string[])[0] ?? "14.1.1"); }
            catch { resolve("14.1.1"); }
          });
        },
      );
      req.on("error", () => resolve("14.1.1"));
      req.end();
    });

    // 5. Upsert summoner
    await db.insert(summoners).values({
      puuid: account.puuid,
      gameName: account.gameName,
      tagLine: account.tagLine,
      platform: region,
      accountJson: JSON.stringify(account),
      summonerJson: JSON.stringify(summoner),
      leagueJson: league.length ? JSON.stringify(league) : null,
      dataDragonVersion,
      fetchedAt: new Date(),
    }).onConflictDoUpdate({
      target: summoners.puuid,
      set: {
        gameName: account.gameName,
        tagLine: account.tagLine,
        accountJson: JSON.stringify(account),
        summonerJson: JSON.stringify(summoner),
        leagueJson: league.length ? JSON.stringify(league) : null,
        dataDragonVersion,
        fetchedAt: new Date(),
      },
    });

    // 6. Fetch match IDs
    await limiter.acquire();
    console.log(`   Fetching ${matchCount} match IDs...`);
    const matchIds = await riotRequest<string[]>(
      regionalHost(region),
      `/lol/match/v5/matches/by-puuid/${encodeURIComponent(account.puuid)}/ids?start=0&count=${matchCount}`,
      apiKey,
    );
    console.log(`   → Got ${matchIds.length} match IDs`);

    // 7. Fetch each match detail
    let matchesScraped = 0;
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
        process.stdout.write(`\r   Match ${i + 1}/${matchIds.length} ✓`);
      } catch (err) {
        process.stdout.write(`\r   Match ${i + 1}/${matchIds.length} ✗ (${(err as Error).message})`);
      }
    }
    console.log("");

    // Update script run log
    if (runId) {
      await db.update(scriptsRun).set({
        summonersScraped: 1,
        matchesScraped,
        completedAt: new Date(),
      }).where(eq(scriptsRun.id, runId));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Done! ${matchesScraped} matches scraped in ${elapsed}s`);
    console.log(`   ${gameName}#${tagLine} stored in DB.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Error: ${msg}`);
    if (runId) {
      await db.update(scriptsRun).set({
        errors: 1,
        completedAt: new Date(),
      }).where(eq(scriptsRun.id, runId));
    }
    process.exit(1);
  }
}

await main();
