export type PlatformRegion =
  | "na1"
  | "br1"
  | "la1"
  | "la2"
  | "euw1"
  | "eun1"
  | "tr1"
  | "ru"
  | "kr"
  | "jp1"
  | "oc1"
  | "ph2"
  | "sg2"
  | "th2"
  | "tw2"
  | "vn2";

export type RegionalRoute = "americas" | "europe" | "asia" | "sea";

export const REGIONAL_BY_PLATFORM: Record<PlatformRegion, RegionalRoute> = {
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  kr: "asia",
  jp1: "asia",
  oc1: "sea",
  ph2: "sea",
  sg2: "sea",
  th2: "sea",
  tw2: "sea",
  vn2: "sea",
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
  puuid?: string;
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
    gameVersion?: string;
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
