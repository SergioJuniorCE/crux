import https from "node:https";
import { db } from "../db";
import { apiCache, summoners, matches } from "../db/schema";
import { eq, lt } from "drizzle-orm";

import type {
  PlatformRegion,
  RiotAccount,
  RiotSummoner,
  RiotLeagueEntry,
  RiotMatch,
  RiotProfileBundle,
} from "../types/riot";
import { REGIONAL_BY_PLATFORM } from "../types/riot";

// ── Constants ──────────────────────────────────────────────────────────────────

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const CACHE_TTL = {
  profileBundle: 2 * MINUTE_MS,
  match: 7 * 24 * HOUR_MS,
  dataDragonVersion: 6 * HOUR_MS,
} as const;

// ── Error ──────────────────────────────────────────────────────────────────────

class RiotApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "RiotApiError";
  }
}

function getApiKey(): string {
  const key = process.env.RIOT_API_KEY?.trim();
  if (!key) {
    throw new RiotApiError(
      401,
      "Missing Riot API key. Set RIOT_API_KEY in packages/backend/.env.",
    );
  }
  return key;
}

// ── HTTP Request ────────────────────────────────────────────────────────────────

function riotRequest<T>(
  host: string,
  path: string,
  apiKey: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: host,
        path,
        method: "GET",
        headers: {
          "X-Riot-Token": apiKey,
          Accept: "application/json",
          "User-Agent": "CruxBackend/0.1",
        },
        timeout: 10_000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const status = response.statusCode ?? 0;

          if (status < 200 || status >= 300) {
            let message = `Riot API ${status}`;
            try {
              const parsed = JSON.parse(body) as {
                status?: { message?: string };
              };
              if (parsed?.status?.message) {
                message = `${message}: ${parsed.status.message}`;
              }
            } catch {
              // body wasn't JSON — keep default message
            }
            reject(new RiotApiError(status, message));
            return;
          }

          try {
            resolve(JSON.parse(body) as T);
          } catch (err) {
            reject(err);
          }
        });
      },
    );

    request.on("timeout", () => {
      request.destroy();
      reject(new Error("Riot API request timed out"));
    });
    request.on("error", (err) => reject(err));
    request.end();
  });
}

function regionalHost(platform: PlatformRegion): string {
  return `${REGIONAL_BY_PLATFORM[platform]}.api.riotgames.com`;
}

function platformHost(platform: PlatformRegion): string {
  return `${platform}.api.riotgames.com`;
}

// ── Individual API calls ───────────────────────────────────────────────────────

export function getAccountByRiotId(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  apiKey: string,
): Promise<RiotAccount> {
  const host = regionalHost(platform);
  const path = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return riotRequest<RiotAccount>(host, path, apiKey);
}

export function getSummonerByPuuid(
  platform: PlatformRegion,
  puuid: string,
  apiKey: string,
): Promise<RiotSummoner> {
  const host = platformHost(platform);
  const path = `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
  return riotRequest<RiotSummoner>(host, path, apiKey);
}

export function getLeagueEntriesByPuuid(
  platform: PlatformRegion,
  puuid: string,
  apiKey: string,
): Promise<RiotLeagueEntry[]> {
  const host = platformHost(platform);
  const path = `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`;
  return riotRequest<RiotLeagueEntry[]>(host, path, apiKey);
}

export function getMatchIdsByPuuid(
  platform: PlatformRegion,
  puuid: string,
  apiKey: string,
  count = 5,
): Promise<string[]> {
  const host = regionalHost(platform);
  const path = `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${count}`;
  return riotRequest<string[]>(host, path, apiKey);
}

export function getMatchById(
  platform: PlatformRegion,
  matchId: string,
  apiKey: string,
): Promise<RiotMatch> {
  const host = regionalHost(platform);
  const path = `/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
  return riotRequest<RiotMatch>(host, path, apiKey);
}

/** Latest Data Dragon version — used to resolve profile icon URLs. */
export async function getLatestDataDragonVersion(): Promise<string> {
  return new Promise<string[]>((resolve, reject) => {
    const req = https.request(
      {
        hostname: "ddragon.leagueoflegends.com",
        path: "/api/versions.json",
        method: "GET",
        timeout: 10_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as string[]);
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Data Dragon request timed out"));
    });
    req.on("error", reject);
    req.end();
  }).then((versions) => versions[0] ?? "14.1.1");
}

// ── Cache helpers ──────────────────────────────────────────────────────────────

/** SQLite-backed cache for API responses with TTL. */
async function getCachedFromDb<T>(key: string): Promise<T | null> {
  const row = await db
    .select()
    .from(apiCache)
    .where(eq(apiCache.key, key))
    .get();

  if (!row) return null;
  if (row.expiresAt <= new Date()) {
    await db.delete(apiCache).where(eq(apiCache.key, key));
    return null;
  }
  return JSON.parse(row.value) as T;
}

async function setCacheInDb<T>(key: string, value: T, ttlMs: number): Promise<void> {
  await db
    .insert(apiCache)
    .values({
      key,
      value: JSON.stringify(value),
      expiresAt: new Date(Date.now() + ttlMs),
    })
    .onConflictDoUpdate({
      target: apiCache.key,
      set: { value: JSON.stringify(value), expiresAt: new Date(Date.now() + ttlMs) },
    });
}

/** Clean up expired cache entries (called periodically). */
export async function cleanExpiredCache(): Promise<void> {
  await db.delete(apiCache).where(lt(apiCache.expiresAt, new Date(Date.now())));
}

// ── Bundle fetch ───────────────────────────────────────────────────────────────

function profileBundleCacheKey(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  matchCount: number,
): string {
  return [
    "profileBundle",
    platform,
    encodeURIComponent(gameName.trim().replace(/^#/, "").toLowerCase()),
    encodeURIComponent(tagLine.trim().replace(/^#/, "").toLowerCase()),
    matchCount,
  ].join(":");
}

/**
 * Fetch everything needed to render a summoner card.
 * Uses SQLite-backed caching with TTL.
 */
export async function getSummonerBundle(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  matchCount = 5,
): Promise<RiotProfileBundle> {
  const apiKey = getApiKey();
  const normalizedMatchCount = Math.max(0, Math.floor(matchCount));
  const cacheKey = profileBundleCacheKey(
    platform,
    gameName,
    tagLine,
    normalizedMatchCount,
  );

  // Try cache first
  const cached = await getCachedFromDb<RiotProfileBundle>(cacheKey);
  if (cached) return cached;

  // Fetch fresh data
  const account = await getAccountByRiotId(platform, gameName, tagLine, apiKey);
  const summoner = await getSummonerByPuuid(platform, account.puuid, apiKey);

  const [league, matchIds, dataDragonVersion] = await Promise.all([
    getLeagueEntriesByPuuid(platform, account.puuid, apiKey).catch(
      () => [] as RiotLeagueEntry[],
    ),
    getMatchIdsByPuuid(
      platform,
      account.puuid,
      apiKey,
      normalizedMatchCount,
    ).catch(() => [] as string[]),
    getLatestDataDragonVersion().catch(() => "14.1.1"),
  ]);

  const matchesData = (
    await Promise.all(
      matchIds.map((id) =>
        getMatchById(platform, id, apiKey).catch(() => null),
      ),
    )
  ).filter((m): m is RiotMatch => m !== null);

  const bundle: RiotProfileBundle = {
    account,
    summoner,
    league,
    matches: matchesData,
    dataDragonVersion,
  };

  // Persist match data individually with 7-day TTL
  for (const match of matchesData) {
    await db
      .insert(matches)
      .values({
        matchId: match.metadata.matchId,
        platform,
        dataJson: JSON.stringify(match),
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: matches.matchId,
        set: { dataJson: JSON.stringify(match), fetchedAt: new Date() },
      });
  }

  // Cache bundle with short TTL (2 minutes)
  await setCacheInDb(cacheKey, bundle, CACHE_TTL.profileBundle);

  return bundle;
}

/** Check if the backend has a Riot API key configured. */
export function hasApiKey(): boolean {
  return Boolean(process.env.RIOT_API_KEY?.trim());
}
