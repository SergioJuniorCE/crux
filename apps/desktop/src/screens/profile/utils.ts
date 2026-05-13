import type { RiotLeagueEntry, RiotMatch, RiotMatchParticipant } from '../../types/riot'

export function winRate(wins: number, losses: number) {
  const total = wins + losses
  if (total === 0) return 0
  return Math.round((wins / total) * 100)
}

export function formatTier(entry: RiotLeagueEntry) {
  const tier = entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase()
  return `${tier} ${entry.rank}`
}

export function formatQueue(queueType: string) {
  switch (queueType) {
    case 'RANKED_SOLO_5x5':
      return 'Ranked Solo / Duo'
    case 'RANKED_FLEX_SR':
      return 'Ranked Flex'
    case 'RANKED_FLEX_TT':
      return 'Ranked Flex 3v3'
    default:
      return queueType.replace(/_/g, ' ')
  }
}

export function relativeTime(ms: number) {
  const diff = Date.now() - ms
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function findSelf(match: RiotMatch, puuid: string): RiotMatchParticipant | null {
  return match.info.participants.find((p) => p.puuid === puuid) ?? null
}

export function formatKda(kills: number, deaths: number, assists: number) {
  if (deaths === 0) return 'Perfect'
  return ((kills + assists) / deaths).toFixed(2)
}
