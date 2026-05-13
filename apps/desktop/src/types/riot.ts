export const PLATFORM_REGIONS = [
  "na1",
  "br1",
  "la1",
  "la2",
  "euw1",
  "eun1",
  "tr1",
  "ru",
  "kr",
  "jp1",
  "oc1",
  "ph2",
  "sg2",
  "th2",
  "tw2",
  "vn2",
] as const;

export type PlatformRegion = (typeof PLATFORM_REGIONS)[number];

/** Human-readable labels for the region dropdown. */
export const REGION_LABELS: Record<PlatformRegion, string> = {
  na1: "North America",
  br1: "Brazil",
  la1: "LAN",
  la2: "LAS",
  euw1: "EU West",
  eun1: "EU Nordic & East",
  tr1: "Turkey",
  ru: "Russia",
  kr: "Korea",
  jp1: "Japan",
  oc1: "Oceania",
  ph2: "Philippines",
  sg2: "Singapore",
  th2: "Thailand",
  tw2: "Taiwan",
  vn2: "Vietnam",
};

export type RiotAccount = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

export type RiotSummoner = {
  id: string;
  accountId: string;
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
};

export type RiotLeagueEntry = {
  leagueId: string;
  queueType: string;
  tier: string;
  rank: string;
  summonerId: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  veteran: boolean;
  inactive: boolean;
  freshBlood: boolean;
  hotStreak: boolean;
};

export type RiotMatchPerks = {
  styles: {
    style: number;
    description: string;
    selections: { perk: number; var1: number; var2: number; var3: number }[];
  }[];
};

export type RiotMatchParticipant = {
  puuid: string;
  summonerName: string;
  riotIdGameName?: string;
  riotIdTagline?: string;
  championName: string;
  championId: number;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  teamId: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  champLevel: number;
  teamPosition?: string;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  summoner1Id: number;
  summoner2Id: number;
  perks?: RiotMatchPerks;
  totalDamageDealtToChampions: number;
  visionScore: number;
  wardsPlaced: number;
  wardsKilled: number;
};

export type RiotMatch = {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: {
    gameCreation: number;
    gameDuration: number;
    gameEndTimestamp?: number;
    gameMode: string;
    gameType: string;
    queueId: number;
    participants: RiotMatchParticipant[];
  };
};

export type RiotProfileBundle = {
  account: RiotAccount;
  summoner: RiotSummoner;
  league: RiotLeagueEntry[];
  matches: RiotMatch[];
  dataDragonVersion: string;
};

export type LcuSummoner = {
  accountId: number;
  displayName: string;
  gameName: string;
  internalName: string;
  profileIconId: number;
  puuid: string;
  summonerId: number;
  summonerLevel: number;
  tagLine: string;
};

export type LcuCurrentSummoner = {
  summoner: LcuSummoner;
  platform: PlatformRegion | null;
  regionCode: string | null;
};

export type LcuCurrentSummonerResult =
  | { success: true; data: LcuCurrentSummoner }
  | { success: false; error: string };

export type LcuChampSelectParticipant = {
  cellId: number;
  championId: number;
  assignedPosition?: string;
  summonerId?: number;
  puuid?: string;
  team?: number;
};

export type LcuChampSelectAction = {
  actorCellId: number;
  championId: number;
  completed: boolean;
  id: number;
  isAllyAction: boolean;
  type: "pick" | "ban" | string;
};

export type LcuChampSelectSession = {
  localPlayerCellId: number;
  myTeam: LcuChampSelectParticipant[];
  theirTeam: LcuChampSelectParticipant[];
  actions: LcuChampSelectAction[][];
};

export type LcuChampSelectSessionResult =
  | { success: true; data: LcuChampSelectSession }
  | { success: false; error: string };

// ── Global Stats Types ────────────────────────────────────────────────────────

export type ChampionItemStat = {
  itemId: number;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  avgPurchaseTime: number | null;
  patch: string;
};

export type ChampionStatsResponse = {
  success: boolean;
  championId: number;
  totalItems: number;
  patch: string;
  items: ChampionItemStat[];
};

export type ChampionInfo = {
  championId: number;
  championName: string;
  championImageId?: string;
  itemCount: number;
  totalGames: number;
  latestPatch: string;
};

export type ChampionsListResponse = {
  success: boolean;
  total: number;
  champions: ChampionInfo[];
};

export type StatsInfoResponse = {
  success: boolean;
  totalMatches: number;
  championsWithStats: number;
  patchesAvailable: string[];
};
