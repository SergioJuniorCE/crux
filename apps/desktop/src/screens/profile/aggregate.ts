import type { RiotMatch } from '../../types/riot'
import { ROLE_ORDER } from '@/lib/leagueAssets'
import { findSelf } from './utils'

export type ChampionStats = {
  championName: string
  games: number
  wins: number
  losses: number
  kills: number
  deaths: number
  assists: number
}

export type RoleStats = {
  role: string
  games: number
  wins: number
}

export type Aggregates = {
  totals: { games: number; wins: number; losses: number; kills: number; deaths: number; assists: number }
  champions: ChampionStats[]
  roles: RoleStats[]
  recent: { win: boolean; timestamp: number }[]
}

export function aggregate(matches: RiotMatch[], puuid: string): Aggregates {
  const byChamp = new Map<string, ChampionStats>()
  const byRole = new Map<string, RoleStats>()
  const totals = { games: 0, wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 }
  const recent: { win: boolean; timestamp: number }[] = []

  for (const match of matches) {
    const self = findSelf(match, puuid)
    if (!self) continue

    totals.games += 1
    totals.kills += self.kills
    totals.deaths += self.deaths
    totals.assists += self.assists
    if (self.win) totals.wins += 1
    else totals.losses += 1

    recent.push({
      win: self.win,
      timestamp: match.info.gameEndTimestamp ?? match.info.gameCreation,
    })

    const c = byChamp.get(self.championName) ?? {
      championName: self.championName,
      games: 0,
      wins: 0,
      losses: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
    }
    c.games += 1
    c.kills += self.kills
    c.deaths += self.deaths
    c.assists += self.assists
    if (self.win) c.wins += 1
    else c.losses += 1
    byChamp.set(self.championName, c)

    const role = self.teamPosition || 'NONE'
    const r = byRole.get(role) ?? { role, games: 0, wins: 0 }
    r.games += 1
    if (self.win) r.wins += 1
    byRole.set(role, r)
  }

  const champions = Array.from(byChamp.values()).sort((a, b) => b.games - a.games)
  const roles = Array.from(byRole.values())
    .filter((r) => r.role !== 'NONE')
    .sort((a, b) => ROLE_ORDER.indexOf(a.role as (typeof ROLE_ORDER)[number]) -
      ROLE_ORDER.indexOf(b.role as (typeof ROLE_ORDER)[number]))

  return { totals, champions, roles, recent }
}
