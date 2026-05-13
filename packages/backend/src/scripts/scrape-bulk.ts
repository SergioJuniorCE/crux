#!/usr/bin/env bun
/**
 * scrape-bulk.ts — Batch fetch summoners from a JSON/CSV file.
 *
 * Usage:
 *   bun run src/scripts/scrape-bulk.ts --file players.json
 *   bun run src/scripts/scrape-bulk.ts --file players.json --concurrency 5 --matches 10
 *
 * JSON format:
 *   [{"region":"na1","name":"Player1","tag":"NA1"}, ...]
 *
 * CSV format:
 *   region,name,tag
 *   na1,Player1,NA1
 */
import { readFileSync, existsSync } from "node:fs";
import { db } from "../db";
import { summoners, matches, scriptsRun } from "../db/schema";
import { eq } from "drizzle-orm";
import { RateLimiter } from "../services/rateLimiter";
import { loadConfig, parseCliFlags } from "./config";
import type { PlatformRegion } from "../types/riot";
import { REGIONAL_BY_PLATFORM, type RiotAccount, type RiotSummoner, type RiotLeagueEntry, type RiotMatch } from "../types/riot";
import https from "node:https";

const ALLOWED_REGIONS = new Set([
  "na1", "br1", "la1", "la2", "euw1", "eun1", "tr1", "ru",
  "kr", "jp1", "oc1", "ph2", "sg2", "th2", "tw2", "vn2",
]);

type PlayerEntry = { region: string; name: string; tag: string };

function getApiKey(): string {
  const key = process.env.RIOT_API_KEY?.trim();
  if (!key) { console.error("Error: Missing Riot API key."); process.exit(1); }
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

function readPlayerFile(filePath: string): PlayerEntry[] {
  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const content = readFileSync(filePath, "utf-8").trim();
  if (!content) return [];

  // Try JSON first
  if (content.startsWith("[") || content.startsWith("{")) {
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [data as PlayerEntry];
  }

  // CSV fallback
  const lines = content.split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const regionIdx = headers.indexOf("region");
  const nameIdx = headers.indexOf("name");
  const tagIdx = headers.indexOf("tag");
  if (regionIdx === -1 || nameIdx === -1 || tagIdx === -1) {
    console.error("Error: CSV must have headers: region,name,tag");
    process.exit(1);
  }

  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    return { region: cols[regionIdx], name: cols[nameIdx], tag: cols[tagIdx] };
  });
}

async function scrapeOne(player: PlayerEntry, limiter: RateLimiter, apiKey: string): Promise<{ matches: number; error?: string }> {
  const region = player.region.toLowerCase();
  if (!ALLOWED_REGIONS.has(region)) return { matches: 0, error: `Invalid region: ${region}` };

  try {
    // Account
    await limiter.acquire();
    const account = await riotRequest<RiotAccount>(
      regionalHost(region),
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(player.name)}/${encodeURIComponent(player.tag)}`,
      apiKey,
    );

    // Summoner
    await limiter.acquire();
    const summoner = await riotRequest<RiotSummoner>(
      platformHost(region),
      `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(account.puuid)}`,
      apiKey,
    );

    // League
    await limiter.acquire();
    let league: RiotLeagueEntry[] = [];
    try { league = await riotRequest<RiotLeagueEntry[]>(platformHost(region), `/lol/league/v4/entries/by-puuid/${encodeURIComponent(account.puuid)}`, apiKey); } catch { /* unranked */ }

    // DataDragon
    await limiter.acquire();
    const dataDragonVersion = await new Promise<string>((resolve) => {
      const req = https.request({ hostname: "ddragon.leagueoflegends.com", path: "/api/versions.json", method: "GET", timeout: 10_000 }, (res) => {
        const chunks: Buffer[] = []; res.on("data", (c) => chunks.push(c));
        res.on("end", () => { try { resolve((JSON.parse(Buffer.concat(chunks).toString()) as string[])[0] ?? "14.1.1"); } catch { resolve("14.1.1"); } });
      });
      req.on("error", () => resolve("14.1.1")); req.end();
    });

    // Upsert summoner
    await db.insert(summoners).values({
      puuid: account.puuid, gameName: account.gameName, tagLine: account.tagLine, platform: region,
      accountJson: JSON.stringify(account), summonerJson: JSON.stringify(summoner),
      leagueJson: league.length ? JSON.stringify(league) : null, dataDragonVersion, fetchedAt: new Date(),
    }).onConflictDoUpdate({
      target: summoners.puuid,
      set: { gameName: account.gameName, tagLine: account.tagLine, accountJson: JSON.stringify(account), summonerJson: JSON.stringify(summoner), leagueJson: league.length ? JSON.stringify(league) : null, dataDragonVersion, fetchedAt: new Date() },
    });

    // Match IDs
    await limiter.acquire();
    const matchIds = await riotRequest<string[]>(
      regionalHost(region),
      `/lol/match/v5/matches/by-puuid/${encodeURIComponent(account.puuid)}/ids?start=0&count=5`,
      apiKey,
    );

    // Matches
    let matchCount = 0;
    for (const matchId of matchIds) {
      await limiter.acquire();
      try {
        const match = await riotRequest<RiotMatch>(regionalHost(region), `/lol/match/v5/matches/${encodeURIComponent(matchId)}`, apiKey);
        await db.insert(matches).values({ matchId: match.metadata.matchId, platform: region, dataJson: JSON.stringify(match), fetchedAt: new Date() })
          .onConflictDoUpdate({ target: matches.matchId, set: { dataJson: JSON.stringify(match), fetchedAt: new Date() } });
        matchCount++;
      } catch { /* skip failed match */ }
    }

    return { matches: matchCount };
  } catch (err) {
    return { matches: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const config = loadConfig();
  const flags = parseCliFlags();
  const apiKey = getApiKey();

  const filePath = String(flags.file ?? flags.f ?? "");
  const concurrency = Number(flags.concurrency ?? flags.concurrent ?? config.concurrency);
  const continueOnError = Boolean(flags["continue-on-error"] ?? flags.continueOnError ?? true);

  if (!filePath) {
    console.error("Error: --file is required.");
    console.error("  bun run src/scripts/scrape-bulk.ts --file players.json");
    process.exit(1);
  }

  const players = readPlayerFile(filePath);
  if (players.length === 0) {
    console.log("No players found in file.");
    return;
  }

  console.log(`\n📋 Bulk scraping ${players.length} summoners (concurrency: ${concurrency})`);

  const limiter = new RateLimiter({
    capacity: config.rateLimitBurst,
    refillPerSec: config.rateLimitPerSecond,
  });

  const startTime = Date.now();
  const runId = await db.insert(scriptsRun).values({
    scriptName: "scrape-bulk",
    args: JSON.stringify(flags),
    startedAt: new Date(),
  }).returning({ id: scriptsRun.id }).then((r) => r[0]?.id ?? null);

  let completed = 0;
  let totalMatches = 0;
  let errors = 0;

  // Process with concurrency control
  const queue = [...players];
  const inProgress = new Set<Promise<void>>();

  while (queue.length > 0 || inProgress.size > 0) {
    while (queue.length > 0 && inProgress.size < concurrency) {
      const player = queue.shift()!;
      const promise = (async () => {
        process.stdout.write(`\r   [${completed + 1}/${players.length}] ${player.name}#${player.tag}...`);
        const result = await scrapeOne(player, limiter, apiKey);
        completed++;
        totalMatches += result.matches;
        if (result.error) {
          errors++;
          if (!continueOnError) throw new Error(result.error);
          process.stdout.write(`\r   [${completed}/${players.length}] ${player.name}#${player.tag} ✗ ${result.error.substring(0, 50)}\n`);
        } else {
          process.stdout.write(`\r   [${completed}/${players.length}] ${player.name}#${player.tag} ✓ (${result.matches} matches)\n`);
        }
      })();
      inProgress.add(promise);
      promise.finally(() => inProgress.delete(promise));
    }

    if (inProgress.size > 0) {
      await Promise.race(inProgress);
    }
  }

  if (runId) {
    await db.update(scriptsRun).set({
      summonersScraped: completed,
      matchesScraped: totalMatches,
      errors,
      completedAt: new Date(),
    }).where(eq(scriptsRun.id, runId));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Done! ${completed}/${players.length} summoners, ${totalMatches} matches, ${errors} errors in ${elapsed}s`);
}

await main();
