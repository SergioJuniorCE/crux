/**
 * Static asset helpers for Riot/DataDragon imagery and small lookup tables
 * that would otherwise require fetching DataDragon JSON.
 */

export function ddragonProfileIcon(version: string, iconId: number) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconId}.png`;
}

export function ddragonChampionSquare(version: string, championName: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championName}.png`;
}

export function ddragonItem(version: string, itemId: number) {
  if (!itemId) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`;
}

export function ddragonRuneIcon(perkId?: number) {
  if (!perkId) return null;
  const path = RUNE_ICON_PATHS[perkId];
  return path ? `https://ddragon.leagueoflegends.com/cdn/img/${path}` : null;
}

export function ddragonRuneStyleIcon(styleId?: number) {
  if (!styleId) return null;
  const path = RUNE_STYLE_ICON_PATHS[styleId];
  return path ? `https://ddragon.leagueoflegends.com/cdn/img/${path}` : null;
}

export function runeName(perkId?: number) {
  return perkId ? RUNE_NAMES[perkId] : undefined;
}

export function runeStyleName(styleId?: number) {
  return styleId ? RUNE_STYLE_NAMES[styleId] : undefined;
}

export function rankedEmblem(tier: string) {
  const normalized = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  return `/ranked-emblems/Season_2023_-_${normalized}.png`;
}

/**
 * Community Dragon hosts summoner spell icons by numeric id directly — much
 * simpler than DataDragon which requires resolving id → spell key via
 * summoner.json.
 */
export function communityDragonSummonerSpell(spellId: number) {
  if (!spellId) return null;
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/summoner_${summonerSpellKey(spellId)}.png`;
}

const SUMMONER_SPELL_KEYS: Record<number, string> = {
  1: "boost", // Cleanse
  3: "exhaust",
  4: "flash",
  6: "haste", // Ghost
  7: "heal",
  11: "smite",
  12: "teleport",
  13: "mana", // Clarity
  14: "dot", // Ignite
  21: "barrier",
  32: "snowball", // ARAM Mark
  39: "snowurfsnowball_mark", // URF
};

function summonerSpellKey(id: number) {
  return SUMMONER_SPELL_KEYS[id] ?? "flash";
}

const RUNE_STYLE_ICON_PATHS: Record<number, string> = {
  8000: "perk-images/Styles/7201_Precision.png",
  8100: "perk-images/Styles/7200_Domination.png",
  8200: "perk-images/Styles/7202_Sorcery.png",
  8300: "perk-images/Styles/7203_Whimsy.png",
  8400: "perk-images/Styles/7204_Resolve.png",
};

const RUNE_STYLE_NAMES: Record<number, string> = {
  8000: "Precision",
  8100: "Domination",
  8200: "Sorcery",
  8300: "Inspiration",
  8400: "Resolve",
};

const RUNE_ICON_PATHS: Record<number, string> = {
  8005: "perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png",
  8008: "perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png",
  8021: "perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png",
  8010: "perk-images/Styles/Precision/Conqueror/Conqueror.png",
  8112: "perk-images/Styles/Domination/Electrocute/Electrocute.png",
  8124: "perk-images/Styles/Domination/Predator/Predator.png",
  8128: "perk-images/Styles/Domination/DarkHarvest/DarkHarvest.png",
  9923: "perk-images/Styles/Domination/HailOfBlades/HailOfBlades.png",
  8214: "perk-images/Styles/Sorcery/SummonAery/SummonAery.png",
  8229: "perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png",
  8230: "perk-images/Styles/Sorcery/PhaseRush/PhaseRush.png",
  8437: "perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png",
  8439: "perk-images/Styles/Resolve/VeteranAftershock/VeteranAftershock.png",
  8465: "perk-images/Styles/Resolve/Guardian/Guardian.png",
  8351: "perk-images/Styles/Inspiration/GlacialAugment/GlacialAugment.png",
  8360: "perk-images/Styles/Inspiration/UnsealedSpellbook/UnsealedSpellbook.png",
  8369: "perk-images/Styles/Inspiration/FirstStrike/FirstStrike.png",
};

const RUNE_NAMES: Record<number, string> = {
  8005: "Press the Attack",
  8008: "Lethal Tempo",
  8021: "Fleet Footwork",
  8010: "Conqueror",
  8112: "Electrocute",
  8124: "Predator",
  8128: "Dark Harvest",
  9923: "Hail of Blades",
  8214: "Summon Aery",
  8229: "Arcane Comet",
  8230: "Phase Rush",
  8437: "Grasp of the Undying",
  8439: "Aftershock",
  8465: "Guardian",
  8351: "Glacial Augment",
  8360: "Unsealed Spellbook",
  8369: "First Strike",
};

/**
 * Color + emblem style hints for each tier. Lets us render a tier pill
 * that reads at a glance without downloading emblem PNGs.
 */
export const TIER_STYLE: Record<
  string,
  { gradient: string; ring: string; text: string }
> = {
  IRON: {
    gradient: "from-zinc-600 to-zinc-800",
    ring: "ring-zinc-500/30",
    text: "text-zinc-200",
  },
  BRONZE: {
    gradient: "from-amber-800 to-orange-900",
    ring: "ring-amber-700/40",
    text: "text-amber-200",
  },
  SILVER: {
    gradient: "from-slate-300 to-slate-500",
    ring: "ring-slate-300/30",
    text: "text-slate-50",
  },
  GOLD: {
    gradient: "from-yellow-400 to-amber-600",
    ring: "ring-amber-400/40",
    text: "text-amber-950",
  },
  PLATINUM: {
    gradient: "from-teal-300 to-cyan-600",
    ring: "ring-cyan-400/40",
    text: "text-cyan-950",
  },
  EMERALD: {
    gradient: "from-emerald-400 to-emerald-700",
    ring: "ring-emerald-400/40",
    text: "text-emerald-950",
  },
  DIAMOND: {
    gradient: "from-sky-300 via-blue-400 to-indigo-500",
    ring: "ring-sky-300/40",
    text: "text-slate-950",
  },
  MASTER: {
    gradient: "from-fuchsia-400 to-purple-700",
    ring: "ring-fuchsia-400/40",
    text: "text-fuchsia-50",
  },
  GRANDMASTER: {
    gradient: "from-rose-400 to-red-700",
    ring: "ring-rose-400/40",
    text: "text-rose-50",
  },
  CHALLENGER: {
    gradient: "from-amber-200 via-cyan-300 to-indigo-400",
    ring: "ring-cyan-300/50",
    text: "text-slate-950",
  },
};

export function tierStyle(tier: string) {
  return TIER_STYLE[tier.toUpperCase()] ?? TIER_STYLE.IRON;
}

/** Human-readable role labels keyed by `teamPosition`. */
export const ROLE_LABELS: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "ADC",
  UTILITY: "Support",
};

export const ROLE_ORDER = [
  "TOP",
  "JUNGLE",
  "MIDDLE",
  "BOTTOM",
  "UTILITY",
] as const;

/** Short queue labels for filter pills + match row chips. */
export function queueName(queueId: number) {
  switch (queueId) {
    case 420:
      return "Ranked Solo";
    case 440:
      return "Ranked Flex";
    case 400:
      return "Normal Draft";
    case 430:
      return "Normal Blind";
    case 450:
      return "ARAM";
    case 700:
      return "Clash";
    case 830:
    case 840:
    case 850:
      return "Co-op vs AI";
    case 900:
      return "URF";
    case 1020:
      return "One for All";
    case 1300:
      return "Nexus Blitz";
    case 1700:
      return "Arena";
    case 1900:
      return "URF";
    default:
      return `Queue ${queueId}`;
  }
}

/** Short queue key used by the filter pills — collapses many queues. */
export function queueGroup(queueId: number): QueueGroup {
  if (queueId === 420) return "solo";
  if (queueId === 440) return "flex";
  if (queueId === 450) return "aram";
  if ([400, 430].includes(queueId)) return "normal";
  return "other";
}

export type QueueGroup = "solo" | "flex" | "normal" | "aram" | "other";
export const QUEUE_FILTERS: { id: QueueGroup | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "solo", label: "Ranked Solo" },
  { id: "flex", label: "Flex" },
  { id: "normal", label: "Normal" },
  { id: "aram", label: "ARAM" },
  { id: "other", label: "Other" },
];
