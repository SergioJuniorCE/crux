import https from 'node:https'

/**
 * Minimal wrapper over the public Riot Games API.
 * Docs: https://developer.riotgames.com/docs/lol
 *
 * Platform routes (summoner-v4, league-v4) and regional routes
 * (account-v1, match-v5) use different hosts. See REGIONAL_BY_PLATFORM.
 */

export type PlatformRegion =
  | 'na1'
  | 'br1'
  | 'la1'
  | 'la2'
  | 'euw1'
  | 'eun1'
  | 'tr1'
  | 'ru'
  | 'kr'
  | 'jp1'
  | 'oc1'
  | 'ph2'
  | 'sg2'
  | 'th2'
  | 'tw2'
  | 'vn2'

export type RegionalRoute = 'americas' | 'europe' | 'asia' | 'sea'

const REGIONAL_BY_PLATFORM: Record<PlatformRegion, RegionalRoute> = {
  na1: 'americas',
  br1: 'americas',
  la1: 'americas',
  la2: 'americas',
  euw1: 'europe',
  eun1: 'europe',
  tr1: 'europe',
  ru: 'europe',
  kr: 'asia',
  jp1: 'asia',
  oc1: 'sea',
  ph2: 'sea',
  sg2: 'sea',
  th2: 'sea',
  tw2: 'sea',
  vn2: 'sea',
}

export type RiotAccount = {
  puuid: string
  gameName: string
  tagLine: string
}

export type RiotSummoner = {
  id: string
  accountId: string
  puuid: string
  profileIconId: number
  revisionDate: number
  summonerLevel: number
}

export type RiotLeagueEntry = {
  leagueId: string
  queueType: string
  tier: string
  rank: string
  summonerId: string
  leaguePoints: number
  wins: number
  losses: number
  veteran: boolean
  inactive: boolean
  freshBlood: boolean
  hotStreak: boolean
}

export type RiotMatchParticipant = {
  puuid: string
  summonerName: string
  riotIdGameName?: string
  riotIdTagline?: string
  championName: string
  championId: number
  kills: number
  deaths: number
  assists: number
  win: boolean
  teamId: number
  totalMinionsKilled: number
  neutralMinionsKilled: number
  goldEarned: number
  champLevel: number
  teamPosition?: string
  item0: number
  item1: number
  item2: number
  item3: number
  item4: number
  item5: number
  item6: number
  summoner1Id: number
  summoner2Id: number
  totalDamageDealtToChampions: number
  visionScore: number
  wardsPlaced: number
  wardsKilled: number
}

export type RiotMatch = {
  metadata: {
    matchId: string
    participants: string[]
  }
  info: {
    gameCreation: number
    gameDuration: number
    gameEndTimestamp?: number
    gameMode: string
    gameType: string
    queueId: number
    participants: RiotMatchParticipant[]
  }
}

class RiotApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'RiotApiError'
  }
}

function riotRequest<T>(host: string, path: string, apiKey: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: host,
        path,
        method: 'GET',
        headers: {
          'X-Riot-Token': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'CruxLeagueApp/0.1',
        },
        timeout: 10_000,
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          const status = response.statusCode ?? 0

          if (status < 200 || status >= 300) {
            let message = `Riot API ${status}`
            try {
              const parsed = JSON.parse(body) as { status?: { message?: string } }
              if (parsed?.status?.message) {
                message = `${message}: ${parsed.status.message}`
              }
            } catch {
              // body wasn't JSON — keep default message
            }
            reject(new RiotApiError(status, message))
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

    request.on('timeout', () => {
      request.destroy()
      reject(new Error('Riot API request timed out'))
    })
    request.on('error', (err) => reject(err))
    request.end()
  })
}

function regionalHost(platform: PlatformRegion): string {
  return `${REGIONAL_BY_PLATFORM[platform]}.api.riotgames.com`
}

function platformHost(platform: PlatformRegion): string {
  return `${platform}.api.riotgames.com`
}

export function getAccountByRiotId(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  apiKey: string,
): Promise<RiotAccount> {
  const host = regionalHost(platform)
  const path = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  return riotRequest<RiotAccount>(host, path, apiKey)
}

export function getSummonerByPuuid(
  platform: PlatformRegion,
  puuid: string,
  apiKey: string,
): Promise<RiotSummoner> {
  const host = platformHost(platform)
  const path = `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`
  return riotRequest<RiotSummoner>(host, path, apiKey)
}

export function getLeagueEntriesByPuuid(
  platform: PlatformRegion,
  puuid: string,
  apiKey: string,
): Promise<RiotLeagueEntry[]> {
  const host = platformHost(platform)
  const path = `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`
  return riotRequest<RiotLeagueEntry[]>(host, path, apiKey)
}

export function getMatchIdsByPuuid(
  platform: PlatformRegion,
  puuid: string,
  apiKey: string,
  count = 5,
): Promise<string[]> {
  const host = regionalHost(platform)
  const path = `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${count}`
  return riotRequest<string[]>(host, path, apiKey)
}

export function getMatchById(
  platform: PlatformRegion,
  matchId: string,
  apiKey: string,
): Promise<RiotMatch> {
  const host = regionalHost(platform)
  const path = `/lol/match/v5/matches/${encodeURIComponent(matchId)}`
  return riotRequest<RiotMatch>(host, path, apiKey)
}

/** Latest Data Dragon version — used to resolve profile icon URLs. */
export async function getLatestDataDragonVersion(): Promise<string> {
  const versions = await new Promise<string[]>((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'ddragon.leagueoflegends.com',
        path: '/api/versions.json',
        method: 'GET',
        timeout: 10_000,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as string[])
          } catch (err) {
            reject(err)
          }
        })
      },
    )
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Data Dragon request timed out'))
    })
    req.on('error', reject)
    req.end()
  })
  return versions[0] ?? '14.1.1'
}

export type RiotProfileBundle = {
  account: RiotAccount
  summoner: RiotSummoner
  league: RiotLeagueEntry[]
  matches: RiotMatch[]
  dataDragonVersion: string
}

/**
 * Fetch everything needed to render a summoner card in a single call.
 * Fails fast on the account/summoner lookup; ranked + match fetches are
 * tolerated so a missing ranked history doesn't break the whole card.
 */
export async function getSummonerBundle(
  platform: PlatformRegion,
  gameName: string,
  tagLine: string,
  apiKey: string,
  matchCount = 5,
): Promise<RiotProfileBundle> {
  const account = await getAccountByRiotId(platform, gameName, tagLine, apiKey)
  const summoner = await getSummonerByPuuid(platform, account.puuid, apiKey)

  const [league, matchIds, dataDragonVersion] = await Promise.all([
    getLeagueEntriesByPuuid(platform, account.puuid, apiKey).catch(() => [] as RiotLeagueEntry[]),
    getMatchIdsByPuuid(platform, account.puuid, apiKey, matchCount).catch(() => [] as string[]),
    getLatestDataDragonVersion().catch(() => '14.1.1'),
  ])

  const matches = (
    await Promise.all(
      matchIds.map((id) => getMatchById(platform, id, apiKey).catch(() => null)),
    )
  ).filter((m): m is RiotMatch => m !== null)

  return { account, summoner, league, matches, dataDragonVersion }
}
