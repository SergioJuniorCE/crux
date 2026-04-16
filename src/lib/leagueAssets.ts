/**
 * Static asset helpers for Riot/DataDragon imagery and small lookup tables
 * that would otherwise require fetching DataDragon JSON.
 */

export function ddragonProfileIcon(version: string, iconId: number) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconId}.png`
}

export function ddragonChampionSquare(version: string, championName: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championName}.png`
}

export function ddragonItem(version: string, itemId: number) {
  if (!itemId) return null
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`
}

/**
 * Community Dragon hosts summoner spell icons by numeric id directly — much
 * simpler than DataDragon which requires resolving id → spell key via
 * summoner.json.
 */
export function communityDragonSummonerSpell(spellId: number) {
  if (!spellId) return null
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/summoner_${summonerSpellKey(spellId)}.png`
}

const SUMMONER_SPELL_KEYS: Record<number, string> = {
  1: 'boost', // Cleanse
  3: 'exhaust',
  4: 'flash',
  6: 'haste', // Ghost
  7: 'heal',
  11: 'smite',
  12: 'teleport',
  13: 'mana', // Clarity
  14: 'dot', // Ignite
  21: 'barrier',
  32: 'snowball', // ARAM Mark
  39: 'snowurfsnowball_mark', // URF
}

function summonerSpellKey(id: number) {
  return SUMMONER_SPELL_KEYS[id] ?? 'flash'
}

/**
 * Color + emblem style hints for each tier. Lets us render a tier pill
 * that reads at a glance without downloading emblem PNGs.
 */
export const TIER_STYLE: Record<
  string,
  { gradient: string; ring: string; text: string }
> = {
  IRON: {
    gradient: 'from-zinc-600 to-zinc-800',
    ring: 'ring-zinc-500/30',
    text: 'text-zinc-200',
  },
  BRONZE: {
    gradient: 'from-amber-800 to-orange-900',
    ring: 'ring-amber-700/40',
    text: 'text-amber-200',
  },
  SILVER: {
    gradient: 'from-slate-300 to-slate-500',
    ring: 'ring-slate-300/30',
    text: 'text-slate-50',
  },
  GOLD: {
    gradient: 'from-yellow-400 to-amber-600',
    ring: 'ring-amber-400/40',
    text: 'text-amber-950',
  },
  PLATINUM: {
    gradient: 'from-teal-300 to-cyan-600',
    ring: 'ring-cyan-400/40',
    text: 'text-cyan-950',
  },
  EMERALD: {
    gradient: 'from-emerald-400 to-emerald-700',
    ring: 'ring-emerald-400/40',
    text: 'text-emerald-950',
  },
  DIAMOND: {
    gradient: 'from-sky-300 via-blue-400 to-indigo-500',
    ring: 'ring-sky-300/40',
    text: 'text-slate-950',
  },
  MASTER: {
    gradient: 'from-fuchsia-400 to-purple-700',
    ring: 'ring-fuchsia-400/40',
    text: 'text-fuchsia-50',
  },
  GRANDMASTER: {
    gradient: 'from-rose-400 to-red-700',
    ring: 'ring-rose-400/40',
    text: 'text-rose-50',
  },
  CHALLENGER: {
    gradient: 'from-amber-200 via-cyan-300 to-indigo-400',
    ring: 'ring-cyan-300/50',
    text: 'text-slate-950',
  },
}

export function tierStyle(tier: string) {
  return TIER_STYLE[tier.toUpperCase()] ?? TIER_STYLE.IRON
}

/** Human-readable role labels keyed by `teamPosition`. */
export const ROLE_LABELS: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'ADC',
  UTILITY: 'Support',
}

export const ROLE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const

/** Short queue labels for filter pills + match row chips. */
export function queueName(queueId: number) {
  switch (queueId) {
    case 420:
      return 'Ranked Solo'
    case 440:
      return 'Ranked Flex'
    case 400:
      return 'Normal Draft'
    case 430:
      return 'Normal Blind'
    case 450:
      return 'ARAM'
    case 700:
      return 'Clash'
    case 830:
    case 840:
    case 850:
      return 'Co-op vs AI'
    case 900:
      return 'URF'
    case 1020:
      return 'One for All'
    case 1300:
      return 'Nexus Blitz'
    case 1700:
      return 'Arena'
    case 1900:
      return 'URF'
    default:
      return `Queue ${queueId}`
  }
}

/** Short queue key used by the filter pills — collapses many queues. */
export function queueGroup(queueId: number): QueueGroup {
  if (queueId === 420) return 'solo'
  if (queueId === 440) return 'flex'
  if (queueId === 450) return 'aram'
  if ([400, 430].includes(queueId)) return 'normal'
  return 'other'
}

export type QueueGroup = 'solo' | 'flex' | 'normal' | 'aram' | 'other'
export const QUEUE_FILTERS: { id: QueueGroup | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'solo', label: 'Ranked Solo' },
  { id: 'flex', label: 'Flex' },
  { id: 'normal', label: 'Normal' },
  { id: 'aram', label: 'ARAM' },
  { id: 'other', label: 'Other' },
]
