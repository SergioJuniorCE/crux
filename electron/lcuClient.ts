import { spawn } from 'node:child_process'
import https from 'node:https'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { PlatformRegion } from './riotApi'

/**
 * Minimal client for the League Client (LCU) local API.
 *
 * Authentication:
 *   - LeagueClientUx.exe is launched with `--app-port` and
 *     `--remoting-auth-token` on its command line.
 *   - Alternatively, those same values are persisted to a `lockfile` under
 *     the install directory in the format `name:pid:port:password:protocol`.
 *   - Requests use HTTP Basic auth (username `riot`, password = token) over
 *     HTTPS against a self-signed cert.
 *
 * This module tries the process lookup first (most portable across installs)
 * and falls back to the common lockfile locations.
 */

export type LcuCredentials = {
  port: number
  token: string
}

export type LcuSummoner = {
  accountId: number
  displayName: string
  gameName: string
  internalName: string
  profileIconId: number
  puuid: string
  summonerId: number
  summonerLevel: number
  tagLine: string
}

type LcuChatMe = {
  gameName?: string
  gameTag?: string
  icon?: number
  name?: string
  puuid?: string
  lol?: {
    platformId?: string
    region?: string
    summonerId?: string
    summonerName?: string
  }
}

type LcuRegionLocale = {
  locale?: string
  region?: string
  webLanguage?: string
  webRegion?: string
}

export type CurrentSummonerPayload = {
  summoner: LcuSummoner
  platform: PlatformRegion | null
  regionCode: string | null
}

/**
 * Map LCU/client region codes (NA, EUW, KR…) to Riot platform values.
 * LCU can report either the web region (lowercase) or the classic region
 * (uppercase) depending on locale, so we normalize before lookup.
 */
const REGION_TO_PLATFORM: Record<string, PlatformRegion> = {
  NA: 'na1',
  NA1: 'na1',
  BR: 'br1',
  BR1: 'br1',
  LAN: 'la1',
  LA1: 'la1',
  LAS: 'la2',
  LA2: 'la2',
  EUW: 'euw1',
  EUW1: 'euw1',
  EUNE: 'eun1',
  EUN1: 'eun1',
  TR: 'tr1',
  TR1: 'tr1',
  RU: 'ru',
  KR: 'kr',
  JP: 'jp1',
  JP1: 'jp1',
  OCE: 'oc1',
  OC1: 'oc1',
  PH: 'ph2',
  PH2: 'ph2',
  SG: 'sg2',
  SG2: 'sg2',
  TH: 'th2',
  TH2: 'th2',
  TW: 'tw2',
  TW2: 'tw2',
  VN: 'vn2',
  VN2: 'vn2',
}

function normalizeRegion(input: string | undefined): PlatformRegion | null {
  if (!input) return null
  const upper = input.toUpperCase()
  return REGION_TO_PLATFORM[upper] ?? null
}

function cleanString(input: unknown): string {
  return typeof input === 'string' ? input.trim() : ''
}

function parseRiotId(input: string): { gameName: string; tagLine: string } | null {
  const trimmed = input.trim()
  const hashIndex = trimmed.lastIndexOf('#')
  if (hashIndex <= 0 || hashIndex === trimmed.length - 1) return null
  return {
    gameName: trimmed.slice(0, hashIndex).trim(),
    tagLine: trimmed.slice(hashIndex + 1).trim(),
  }
}

function mergeSummonerIdentity(summoner: LcuSummoner, chatMe: LcuChatMe | null): LcuSummoner {
  const parsedDisplayName = parseRiotId(summoner.displayName)
  const gameName =
    cleanString(summoner.gameName) ||
    cleanString(chatMe?.gameName) ||
    parsedDisplayName?.gameName ||
    cleanString(summoner.displayName) ||
    cleanString(chatMe?.name)
  const tagLine =
    cleanString(summoner.tagLine) ||
    cleanString(chatMe?.gameTag) ||
    parsedDisplayName?.tagLine ||
    ''

  return {
    ...summoner,
    displayName: cleanString(summoner.displayName) || cleanString(chatMe?.name) || gameName,
    gameName,
    tagLine,
  }
}

function summonerFromChatMe(chatMe: LcuChatMe): LcuSummoner | null {
  const gameName = cleanString(chatMe.gameName) || cleanString(chatMe.name)
  const tagLine = cleanString(chatMe.gameTag)
  const displayName =
    gameName && tagLine ? `${gameName}#${tagLine}` : cleanString(chatMe.name) || gameName

  if (!gameName && !displayName) return null

  return {
    accountId: 0,
    displayName,
    gameName,
    internalName: cleanString(chatMe.name) || gameName,
    profileIconId: typeof chatMe.icon === 'number' ? chatMe.icon : 0,
    puuid: cleanString(chatMe.puuid),
    summonerId: Number.parseInt(cleanString(chatMe.lol?.summonerId), 10) || 0,
    summonerLevel: 0,
    tagLine,
  }
}

function parseCredentialsFromCommandLine(cmdLine: string): LcuCredentials | null {
  const portMatch = cmdLine.match(/--app-port=(\d+)/)
  const tokenMatch = cmdLine.match(/--remoting-auth-token=([\w-]+)/)
  if (!portMatch || !tokenMatch) return null
  return { port: Number.parseInt(portMatch[1], 10), token: tokenMatch[1] }
}

function parseLockfile(contents: string): LcuCredentials | null {
  // Format: <name>:<pid>:<port>:<password>:<protocol>
  const parts = contents.trim().split(':')
  if (parts.length < 5) return null
  const port = Number.parseInt(parts[2], 10)
  const token = parts[3]
  if (!Number.isFinite(port) || !token) return null
  return { port, token }
}

async function readLockfile(installDir: string): Promise<LcuCredentials | null> {
  try {
    const contents = await fs.readFile(path.join(installDir, 'lockfile'), 'utf8')
    return parseLockfile(contents)
  } catch {
    return null
  }
}

function runPowerShell(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // `spawn` with an args array avoids the quoting pitfalls that `exec`
    // hits when PowerShell expressions contain quotes.
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { windowsHide: true },
    )

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('PowerShell query timed out'))
    }, 5000)

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderrChunks).toString('utf8') || `PowerShell exited with ${code}`))
        return
      }
      resolve(Buffer.concat(stdoutChunks).toString('utf8'))
    })
  })
}

async function findCredentialsFromProcessWindows(): Promise<{
  credentials: LcuCredentials | null
  installDir: string | null
}> {
  try {
    // Query both CommandLine (for port/token) and ExecutablePath so we can
    // derive the install directory for the lockfile fallback. Emit one
    // compact JSON object per line for robust parsing.
    const script = [
      "Get-CimInstance Win32_Process -Filter \"name = 'LeagueClientUx.exe'\" |",
      'ForEach-Object { [pscustomobject]@{ CommandLine = $_.CommandLine; ExecutablePath = $_.ExecutablePath } |',
      'ConvertTo-Json -Compress }',
    ].join(' ')
    const raw = await runPowerShell(script)
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as { CommandLine?: string; ExecutablePath?: string }
        const credentials = obj.CommandLine ? parseCredentialsFromCommandLine(obj.CommandLine) : null
        const installDir = obj.ExecutablePath ? path.dirname(obj.ExecutablePath) : null
        if (credentials) {
          return { credentials, installDir }
        }
        if (installDir) {
          return { credentials: null, installDir }
        }
      } catch {
        // Skip malformed JSON lines.
      }
    }
  } catch {
    // PowerShell not available or query failed — fall through.
  }
  return { credentials: null, installDir: null }
}

const COMMON_INSTALL_DIRS = [
  'C:\\Riot Games\\League of Legends',
  'D:\\Riot Games\\League of Legends',
  'E:\\Riot Games\\League of Legends',
]

async function findCredentials(): Promise<LcuCredentials | null> {
  if (process.platform === 'win32') {
    const { credentials, installDir } = await findCredentialsFromProcessWindows()
    if (credentials) return credentials
    if (installDir) {
      const fromLockfile = await readLockfile(installDir)
      if (fromLockfile) return fromLockfile
    }
    for (const dir of COMMON_INSTALL_DIRS) {
      const fromLockfile = await readLockfile(dir)
      if (fromLockfile) return fromLockfile
    }
    return null
  }

  // On macOS/Linux the default install paths differ; we only fall back to
  // lockfile lookups here since process.platform is primarily 'win32' for
  // this app's target.
  const macPath = '/Applications/League of Legends.app/Contents/LoL'
  const fromMac = await readLockfile(macPath)
  return fromMac
}

function lcuRequest<T>(creds: LcuCredentials, apiPath: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`riot:${creds.token}`).toString('base64')
    const req = https.request(
      {
        hostname: '127.0.0.1',
        port: creds.port,
        path: apiPath,
        method: 'GET',
        rejectUnauthorized: false,
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
        timeout: 5000,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          const status = res.statusCode ?? 0
          if (status < 200 || status >= 300) {
            reject(new Error(`LCU ${status}: ${body.slice(0, 200)}`))
            return
          }
          try {
            resolve(JSON.parse(body) as T)
          } catch (err) {
            reject(err)
          }
        })
      },
    )
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('LCU request timed out'))
    })
    req.on('error', reject)
    req.end()
  })
}

export async function getCurrentSummonerFromClient(): Promise<CurrentSummonerPayload> {
  const creds = await findCredentials()
  if (!creds) {
    throw new Error(
      'League client not detected. Open the League of Legends client and try again.',
    )
  }

  let chatMe: LcuChatMe | null = null
  try {
    chatMe = await lcuRequest<LcuChatMe>(creds, '/lol-chat/v1/me')
  } catch {
    // The summoner endpoint below is still the source of truth when chat is unavailable.
  }

  let summoner: LcuSummoner
  try {
    summoner = await lcuRequest<LcuSummoner>(
      creds,
      '/lol-summoner/v1/current-summoner',
    )
  } catch (err) {
    const fallbackSummoner = chatMe ? summonerFromChatMe(chatMe) : null
    if (!fallbackSummoner) throw err
    summoner = fallbackSummoner
  }

  // Region/locale is best-effort — failures here shouldn't block the lookup.
  let platform: PlatformRegion | null = null
  let regionCode: string | null = null
  try {
    const region = await lcuRequest<LcuRegionLocale>(creds, '/riotclient/region-locale')
    const candidates = [
      region.region,
      region.webRegion,
      chatMe?.lol?.region,
      chatMe?.lol?.platformId,
    ]
    for (const candidate of candidates) {
      const normalized = normalizeRegion(candidate)
      if (normalized) {
        regionCode = cleanString(candidate).toUpperCase()
        platform = normalized
        break
      }
    }
  } catch {
    const candidates = [chatMe?.lol?.region, chatMe?.lol?.platformId]
    for (const candidate of candidates) {
      const normalized = normalizeRegion(candidate)
      if (normalized) {
        regionCode = cleanString(candidate).toUpperCase()
        platform = normalized
        break
      }
    }
  }

  return { summoner: mergeSummonerIdentity(summoner, chatMe), platform, regionCode }
}
