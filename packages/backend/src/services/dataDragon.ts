/**
 * DataDragon service — fetches and caches static data from Riot's DataDragon.
 *
 * Provides:
 * - Champion name/id mappings
 * - Item name/id mappings with gold costs and stats
 * - Item icon URLs
 * - Rune name/id mappings
 */

import { db } from "../db";
import { apiCache } from "../db/schema";
import { eq } from "drizzle-orm";
import https from "node:https";

const CACHE_TTL = {
  championMap: 24 * 60 * 60 * 1000, // 24 hours
  itemMap: 24 * 60 * 60 * 1000,
  runeMap: 24 * 60 * 60 * 1000,
};

// ── HTTP Helper ────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: "GET", timeout: 15_000 },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
            reject(new Error(`DataDragon ${res.statusCode}: ${body.substring(0, 100)}`));
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

// ── Champion Data ──────────────────────────────────────────────────────────────

export type ChampionInfo = {
  id: string;
  key: string;
  name: string;
  title: string;
  image: { full: string };
};

export type ChampionMap = Record<number, ChampionInfo>;

let cachedChampionMap: ChampionMap | null = null;

/** Fetch champion data from DataDragon, cached in memory + SQLite. */
export async function getChampionMap(version?: string): Promise<ChampionMap> {
  if (cachedChampionMap) return cachedChampionMap;

  // Check SQLite cache
  const cacheKey = `ddragon:champions:${version ?? "latest"}`;
  const cached = await db.select().from(apiCache).where(eq(apiCache.key, cacheKey)).get();
  if (cached && cached.expiresAt > new Date()) {
    cachedChampionMap = JSON.parse(cached.value) as ChampionMap;
    return cachedChampionMap!;
  }

  // Fetch fresh
  const v = version ?? await getLatestVersion();
  const url = `https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/champion.json`;
  const json = await fetchJson<{ data: Record<string, ChampionInfo> }>(url);

  const map: ChampionMap = {};
  for (const champion of Object.values(json.data)) {
    map[Number(champion.key)] = champion;
  }

  // Cache
  cachedChampionMap = map;
  await db.insert(apiCache).values({
    key: cacheKey,
    value: JSON.stringify(map),
    expiresAt: new Date(Date.now() + CACHE_TTL.championMap),
  }).onConflictDoUpdate({
    target: apiCache.key,
    set: { value: JSON.stringify(map), expiresAt: new Date(Date.now() + CACHE_TTL.championMap) },
  });

  return map;
}

// ── Item Data ──────────────────────────────────────────────────────────────────

export type ItemInfo = {
  name: string;
  description: string;
  gold: { base: number; total: number; sell: number; purchasable: boolean };
  tags: string[];
  image: { full: string };
  /** Maps to item stats like { FlatPhysicalDamageMod: 30 } */
  stats?: Record<string, number>;
  into?: string[]; // builds into
  from?: string[]; // builds from
};

let cachedItemMap: Record<number, ItemInfo> | null = null;

/** Fetch item data from DataDragon, cached in memory + SQLite. */
export async function getItemMap(version?: string): Promise<Record<number, ItemInfo>> {
  if (cachedItemMap) return cachedItemMap;

  const cacheKey = `ddragon:items:${version ?? "latest"}`;
  const cached = await db.select().from(apiCache).where(eq(apiCache.key, cacheKey)).get();
  if (cached && cached.expiresAt > new Date()) {
    cachedItemMap = JSON.parse(cached.value) as Record<number, ItemInfo>;
    return cachedItemMap!;
  }

  const v = version ?? await getLatestVersion();
  const url = `https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/item.json`;
  const json = await fetchJson<{ data: Record<string, ItemInfo> }>(url);

  const map: Record<number, ItemInfo> = {};
  for (const [id, item] of Object.entries(json.data)) {
    map[Number(id)] = item;
  }

  cachedItemMap = map;
  await db.insert(apiCache).values({
    key: cacheKey,
    value: JSON.stringify(map),
    expiresAt: new Date(Date.now() + CACHE_TTL.itemMap),
  }).onConflictDoUpdate({
    target: apiCache.key,
    set: { value: JSON.stringify(map), expiresAt: new Date(Date.now() + CACHE_TTL.itemMap) },
  });

  return map;
}

/** Get icon URL for an item ID. */
export function itemIconUrl(version: string, itemId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`;
}

/** Get champion square icon URL. */
export function championIconUrl(version: string, championId: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${encodeURIComponent(championId)}.png`;
}

// ── Rune Data ──────────────────────────────────────────────────────────────────

export type RuneInfo = {
  id: number;
  key: string;
  name: string;
  icon: string;
  slots: { runes: { id: number; key: string; name: string; icon: string }[] }[];
};

let cachedRuneMap: Record<number, string> | null = null;

/** Fetch rune data. Returns a map of rune ID → rune name. */
export async function getRuneMap(version?: string): Promise<Record<number, string>> {
  if (cachedRuneMap) return cachedRuneMap;

  const cacheKey = `ddragon:runes:${version ?? "latest"}`;
  const cached = await db.select().from(apiCache).where(eq(apiCache.key, cacheKey)).get();
  if (cached && cached.expiresAt > new Date()) {
    cachedRuneMap = JSON.parse(cached.value) as Record<number, string>;
    return cachedRuneMap!;
  }

  const v = version ?? await getLatestVersion();
  const url = `https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/runesReforged.json`;
  const json = await fetchJson<RuneInfo[]>(url);

  const map: Record<number, string> = {};
  for (const tree of json) {
    for (const slot of tree.slots) {
      for (const rune of slot.runes) {
        map[rune.id] = rune.name;
      }
    }
  }

  cachedRuneMap = map;
  await db.insert(apiCache).values({
    key: cacheKey,
    value: JSON.stringify(map),
    expiresAt: new Date(Date.now() + CACHE_TTL.runeMap),
  }).onConflictDoUpdate({
    target: apiCache.key,
    set: { value: JSON.stringify(map), expiresAt: new Date(Date.now() + CACHE_TTL.runeMap) },
  });

  return map;
}

// ── Version ────────────────────────────────────────────────────────────────────

let cachedVersion: string | null = null;

export async function getLatestVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;

  const cacheKey = "ddragon:version";
  const cached = await db.select().from(apiCache).where(eq(apiCache.key, cacheKey)).get();
  if (cached && cached.expiresAt > new Date()) {
    cachedVersion = cached.value;
    return cachedVersion;
  }

  const versions = await fetchJson<string[]>("https://ddragon.leagueoflegends.com/api/versions.json");
  const v = versions[0] ?? "14.1.1";

  cachedVersion = v;
  await db.insert(apiCache).values({
    key: cacheKey,
    value: v,
    expiresAt: new Date(Date.now() + CACHE_TTL.championMap),
  }).onConflictDoUpdate({
    target: apiCache.key,
    set: { value: v, expiresAt: new Date(Date.now() + CACHE_TTL.championMap) },
  });

  return v;
}
