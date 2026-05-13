import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  BarChart3,
  Flame,
  RefreshCw,
  Shield,
  Sparkles,
  Sword,
  Trophy,
} from "lucide-react";

import type {
  LcuChampSelectSession,
  RiotMatchParticipant,
  RiotProfileBundle,
} from "../types/riot";
import {
  ROLE_LABELS,
  communityDragonSummonerSpell,
  ddragonChampionSquare,
  ddragonItem,
  ddragonRuneIcon,
  ddragonRuneStyleIcon,
  runeName,
  runeStyleName,
} from "@/lib/leagueAssets";
import { cn } from "@/lib/utils";

type ChampSelectViewProps = {
  status: "idle" | "loading" | "active" | "error";
  session: LcuChampSelectSession | null;
  error: string | null;
  profileStatus: "idle" | "loading" | "success" | "error";
  profileData: RiotProfileBundle | null;
  profileConfigured: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
};

type ChampionRecord = {
  id: string;
  key: string;
  name: string;
  image: { full: string };
};

type ChampionLookup = {
  version: string;
  byKey: Record<number, ChampionRecord>;
};

type BuildSource = "champion" | "role" | "recent";

type BuildVariant = {
  name: string;
  description: string;
  count: number;
  wins: number;
  winRate: number;
  items: { id: number; count: number }[];
  accent: string;
};

type RuneSet = {
  primaryStyle?: number;
  secondaryStyle?: number;
  keystone?: number;
};

const ROLE_FALLBACK_LABELS: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "ADC",
  UTILITY: "Support",
  UNSELECTED: "Any role",
};

const TRINKET_ITEM_IDS = new Set([
  3330, 3340, 3348, 3363, 3364, 3513, 3599, 3600, 2052,
]);

const TANK_ITEMS = new Set([
  3068, 3075, 3083, 3110, 3143, 3190, 3742, 4401, 6662, 6664, 6665, 8020,
]);
const AP_ITEMS = new Set([
  3003, 3020, 3089, 3100, 3102, 3115, 3116, 3135, 3157, 4636, 4644, 4645, 6653,
  6655, 6656, 6657,
]);
const LETHALITY_ITEMS = new Set([
  3142, 3814, 6692, 6694, 6695, 6696, 6697, 6698, 6701,
]);
const CRIT_ITEMS = new Set([
  3031, 3033, 3036, 3085, 3087, 3094, 3095, 6672, 6673, 6675, 6676,
]);
const BRUISER_ITEMS = new Set([
  3053, 3071, 3074, 3078, 3156, 3161, 6333, 6609, 6610, 6630, 6631, 6632, 6699,
  3748,
]);

function normalizeRole(role?: string) {
  return role?.trim().toUpperCase() || "UNSELECTED";
}

function findLocalChampionId(session: LcuChampSelectSession | null) {
  if (!session) return 0;

  const participant = session.myTeam.find(
    (member) => member.cellId === session.localPlayerCellId,
  );
  if (participant?.championId) return participant.championId;

  const actions = session.actions
    .flat()
    .filter(
      (action) =>
        action.actorCellId === session.localPlayerCellId &&
        action.type === "pick" &&
        action.championId,
    );

  return actions[actions.length - 1]?.championId ?? 0;
}

function findLocalRole(session: LcuChampSelectSession | null) {
  const participant = session?.myTeam.find(
    (member) => member.cellId === session.localPlayerCellId,
  );
  return normalizeRole(participant?.assignedPosition);
}

function participantForSelf(
  match: RiotProfileBundle["matches"][number],
  puuid: string,
) {
  return match.info.participants.find(
    (participant) => participant.puuid === puuid,
  );
}

function collectSelfParticipants(data: RiotProfileBundle | null) {
  if (!data) return [];
  return data.matches
    .map((match) => participantForSelf(match, data.account.puuid))
    .filter(Boolean) as RiotMatchParticipant[];
}

function getParticipantItems(participant: RiotMatchParticipant) {
  return [
    participant.item0,
    participant.item1,
    participant.item2,
    participant.item3,
    participant.item4,
    participant.item5,
  ].filter((itemId) => itemId && !TRINKET_ITEM_IDS.has(itemId));
}

function countItems(matches: RiotMatchParticipant[]) {
  const counts = new Map<number, number>();
  for (const participant of matches) {
    for (const itemId of getParticipantItems(participant)) {
      counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, count }));
}

function pickMostCommon<T>(values: T[], key: (value: T) => string) {
  const counts = new Map<string, { value: T; count: number }>();
  for (const value of values) {
    const id = key(value);
    const next = counts.get(id) ?? { value, count: 0 };
    counts.set(id, { value, count: next.count + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0];
}

function classifyBuildStyle(participant: RiotMatchParticipant) {
  const items = getParticipantItems(participant);
  const score = (set: Set<number>) =>
    items.filter((itemId) => set.has(itemId)).length;
  const scores = [
    {
      name: "Tank",
      score: score(TANK_ITEMS),
      description: "Durable frontline setup",
      accent: "from-emerald-400/25 to-cyan-400/10",
    },
    {
      name: "AP",
      score: score(AP_ITEMS),
      description: "Magic damage setup",
      accent: "from-violet-400/25 to-fuchsia-400/10",
    },
    {
      name: "Lethality",
      score: score(LETHALITY_ITEMS),
      description: "Burst damage setup",
      accent: "from-red-400/25 to-orange-400/10",
    },
    {
      name: "Crit",
      score: score(CRIT_ITEMS),
      description: "Carry damage setup",
      accent: "from-sky-400/25 to-blue-400/10",
    },
    {
      name: "Bruiser / AD",
      score: score(BRUISER_ITEMS),
      description: "Fighter and skirmish setup",
      accent: "from-primary/25 to-amber-400/10",
    },
  ].sort((a, b) => b.score - a.score);

  if (scores[0].score <= 0) {
    return {
      name: "Common",
      description: "Most frequent recent setup",
      accent: "from-primary/20 to-white/5",
    };
  }

  return scores[0];
}

function deriveBuildVariants(matches: RiotMatchParticipant[]): BuildVariant[] {
  const groups = new Map<
    string,
    {
      description: string;
      accent: string;
      matches: RiotMatchParticipant[];
    }
  >();

  for (const participant of matches) {
    const style = classifyBuildStyle(participant);
    const group = groups.get(style.name) ?? {
      description: style.description,
      accent: style.accent,
      matches: [],
    };
    group.matches.push(participant);
    groups.set(style.name, group);
  }

  return [...groups.entries()]
    .map(([name, group]) => {
      const wins = group.matches.filter(
        (participant) => participant.win,
      ).length;
      return {
        name,
        description: group.description,
        count: group.matches.length,
        wins,
        winRate: group.matches.length
          ? Math.round((wins / group.matches.length) * 100)
          : 0,
        items: countItems(group.matches).slice(0, 4),
        accent: group.accent,
      };
    })
    .sort((a, b) => b.count - a.count || b.winRate - a.winRate)
    .slice(0, 4);
}

function deriveRecommendations(
  participants: RiotMatchParticipant[],
  championId: number,
  role: string,
) {
  const championMatches = participants.filter(
    (participant) => participant.championId === championId,
  );
  const roleMatches = participants.filter(
    (participant) => normalizeRole(participant.teamPosition) === role,
  );
  const sourceMatches = championMatches.length
    ? championMatches
    : roleMatches.length
      ? roleMatches
      : participants;
  const sourceLabel: BuildSource = championMatches.length
    ? "champion"
    : roleMatches.length
      ? "role"
      : "recent";

  const items = countItems(sourceMatches);
  const spellPair = pickMostCommon(
    sourceMatches.map(
      (participant) =>
        [participant.summoner1Id, participant.summoner2Id] as const,
    ),
    ([a, b]) => [a, b].sort((left, right) => left - right).join("-"),
  );

  const runeSet = pickMostCommon(
    sourceMatches
      .map((participant) => participant.perks)
      .filter(Boolean)
      .map(
        (perks): RuneSet => ({
          primaryStyle: perks!.styles[0]?.style,
          secondaryStyle: perks!.styles[1]?.style,
          keystone: perks!.styles[0]?.selections[0]?.perk,
        }),
      )
      .filter((runes) => runes.primaryStyle && runes.keystone),
    (runes) =>
      `${runes.primaryStyle}-${runes.secondaryStyle}-${runes.keystone}`,
  );

  const wins = sourceMatches.filter((participant) => participant.win).length;
  const deaths = sourceMatches.reduce(
    (sum, participant) => sum + participant.deaths,
    0,
  );
  const kdaNumerator = sourceMatches.reduce(
    (sum, participant) => sum + participant.kills + participant.assists,
    0,
  );
  const avgKills = average(
    sourceMatches.map((participant) => participant.kills),
  );
  const avgDeaths = average(
    sourceMatches.map((participant) => participant.deaths),
  );
  const avgAssists = average(
    sourceMatches.map((participant) => participant.assists),
  );

  return {
    sourceMatches,
    sourceLabel,
    variants: deriveBuildVariants(sourceMatches),
    coreItems: items.slice(0, 6),
    completedItems: items.slice(0, 10),
    situationalItems: items.slice(6, 14),
    spellPair,
    runeSet,
    wins,
    winRate: sourceMatches.length
      ? Math.round((wins / sourceMatches.length) * 100)
      : 0,
    kda: deaths ? kdaNumerator / deaths : kdaNumerator,
    avgKills,
    avgDeaths,
    avgAssists,
  };
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDecimal(value: number, digits = 1) {
  return value.toFixed(digits);
}

async function fetchChampionLookup(
  versionHint?: string,
): Promise<ChampionLookup> {
  let version = versionHint;
  if (!version) {
    const versions = (await fetch(
      "https://ddragon.leagueoflegends.com/api/versions.json",
    ).then((res) => res.json())) as string[];
    version = versions[0];
  }

  const response = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
  );
  const json = (await response.json()) as {
    data: Record<string, ChampionRecord>;
  };
  const byKey: Record<number, ChampionRecord> = {};

  Object.values(json.data).forEach((champion) => {
    byKey[Number(champion.key)] = champion;
  });

  return { version, byKey };
}

export function ChampSelectView({
  status,
  session,
  error,
  profileStatus,
  profileData,
  profileConfigured,
  onRefresh,
  onOpenSettings,
}: ChampSelectViewProps) {
  const [champions, setChampions] = useState<ChampionLookup | null>(null);
  const championId = findLocalChampionId(session);
  const localRole = findLocalRole(session);
  const dataDragonVersion =
    profileData?.dataDragonVersion ?? champions?.version;

  useEffect(() => {
    let cancelled = false;
    void fetchChampionLookup(profileData?.dataDragonVersion)
      .then((lookup) => {
        if (!cancelled) setChampions(lookup);
      })
      .catch(() => {
        if (!cancelled) setChampions(null);
      });

    return () => {
      cancelled = true;
    };
  }, [profileData?.dataDragonVersion]);

  const champion = championId ? champions?.byKey[championId] : null;
  const participants = useMemo(
    () => collectSelfParticipants(profileData),
    [profileData],
  );
  const recommendations = useMemo(
    () => deriveRecommendations(participants, championId, localRole),
    [championId, localRole, participants],
  );
  const roleLabel =
    ROLE_LABELS[localRole] ?? ROLE_FALLBACK_LABELS[localRole] ?? localRole;

  if (status === "error") {
    return (
      <div className="flex flex-col gap-3">
        <Header onRefresh={onRefresh} />
        <EmptyState
          danger
          icon={<AlertCircle size={20} />}
          title="Could not read champ select"
          description={
            error ??
            "The League client returned an unexpected champ select error."
          }
          action={
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-white/15"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          }
        />
      </div>
    );
  }

  if (status !== "active" || !session) {
    return (
      <div className="flex flex-col gap-2">
        <Header onRefresh={onRefresh} />
        <SearchingChampSelect />
      </div>
    );
  }

  const championTitle =
    champion?.name ??
    (championId ? `Champion ${championId}` : "Pick a champion");
  const pageTitle = championId
    ? `${championTitle} ${roleLabel} Build, Runes, Items, and Stats`
    : "Champion Build, Runes, Items, and Stats";

  return (
    <div className="flex flex-col gap-2">
      <Header onRefresh={onRefresh} active={status === "active"} />

      <section className="rounded-xl border border-border bg-card p-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(30rem,1fr)]">
          <div className="flex min-w-0 items-center gap-3">
            {champion && dataDragonVersion ? (
              <img
                src={ddragonChampionSquare(dataDragonVersion, champion.id)}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl border border-border bg-muted object-cover"
              />
            ) : (
              <span className="h-14 w-14 shrink-0 rounded-xl border border-dashed border-border bg-background" />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="truncate font-display text-xl font-bold tracking-[-0.045em] text-foreground">
                  {pageTitle}
                </h1>
                <FilterChip label="Role" value={roleLabel} />
                <FilterChip
                  label="Source"
                  value={sourceLabel(recommendations.sourceLabel)}
                />
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {championId
                  ? `Personal recommendations · patch ${dataDragonVersion ?? "latest"} · ${recommendations.sourceMatches.length} games`
                  : "Hover or lock a champion to populate the guide."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            <HeroStat
              label="Tier"
              value={tierLabel(
                recommendations.winRate,
                recommendations.sourceMatches.length,
              )}
            />
            <HeroStat label="WR" value={`${recommendations.winRate}%`} />
            <HeroStat
              label="Games"
              value={String(recommendations.sourceMatches.length)}
            />
            <HeroStat label="KDA" value={formatDecimal(recommendations.kda)} />
            <HeroStat
              label="Avg"
              value={`${formatDecimal(recommendations.avgKills)}/${formatDecimal(recommendations.avgDeaths)}/${formatDecimal(recommendations.avgAssists)}`}
            />
          </div>
        </div>
      </section>

      {!profileConfigured ? (
        <section className="rounded-xl border border-dashed border-border bg-card/50 p-5 text-center">
          <h2 className="text-sm font-semibold text-foreground">
            Link Riot API for recommendations
          </h2>
          <p className="mx-auto mt-1 max-w-lg text-xs text-muted-foreground">
            Champ select detection works through the local League client, but
            builds and runes need your recent match data. Add your Riot ID and
            API key in Settings.
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open Settings
          </button>
        </section>
      ) : profileStatus === "loading" && !profileData ? (
        <section className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Loading your match history…
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="space-y-2">
          <PlaystyleBuilds
            variants={recommendations.variants}
            dataDragonVersion={dataDragonVersion}
          />
          <ItemsPanel
            coreItems={recommendations.coreItems}
            completedItems={recommendations.completedItems}
            situationalItems={recommendations.situationalItems}
            dataDragonVersion={dataDragonVersion}
            hasProfileData={Boolean(profileData)}
          />
        </main>

        <aside>
          <LoadoutPanel
            runeSet={recommendations.runeSet?.value}
            runeCount={recommendations.runeSet?.count}
            spells={recommendations.spellPair?.value}
            spellCount={recommendations.spellPair?.count}
            championName={championTitle}
            source={recommendations.sourceLabel}
            sampleCount={recommendations.sourceMatches.length}
          />
        </aside>
      </div>
    </div>
  );
}

function Header({
  onRefresh,
  active = false,
}: {
  onRefresh: () => void;
  active?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="font-display text-lg font-semibold tracking-[-0.04em] text-foreground">
          Champ Select · Builds & Runes
        </h1>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:border-white/15"
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            active ? "crux-pulse-gold bg-primary" : "bg-muted-foreground/50",
          )}
        />
        Refresh
      </button>
    </div>
  );
}

function SearchingChampSelect() {
  return (
    <section className="rounded-xl border border-dashed border-border bg-card/50 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <RefreshCw size={16} className="animate-spin" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            Looking for champion select…
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Open a draft lobby or start champ select. Recommendations will
            appear once Crux detects your pick.
          </p>
        </div>
      </div>
    </section>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
  danger = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border p-6 text-center",
        danger
          ? "border-red-500/30 bg-red-500/5"
          : "border-dashed border-border bg-card/50",
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
          danger ? "bg-red-500/10 text-red-400" : "bg-white/4 text-primary",
        )}
      >
        {icon}
      </div>
      <h2
        className={cn(
          "mt-3 text-sm font-semibold",
          danger ? "text-red-300" : "text-foreground",
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "mx-auto mt-1 max-w-md text-xs",
          danger ? "text-red-300/80" : "text-muted-foreground",
        )}
      >
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

function FilterChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/70 px-2 py-1 text-[10px] backdrop-blur">
      <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className="font-semibold text-foreground">{value}</span>
    </span>
  );
}

function HeroStat({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-2 py-1.5 text-center">
      <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 flex items-baseline justify-center gap-1.5">
        <p className="text-sm font-bold tracking-[-0.04em] text-foreground sm:text-base">
          {value}
        </p>
        {trend ? (
          <span className="text-[10px] font-semibold text-primary">
            {trend}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PlaystyleBuilds({
  variants,
  dataDragonVersion,
}: {
  variants: BuildVariant[];
  dataDragonVersion?: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="crux-eyebrow">Playstyles</span>
          <h2 className="text-sm font-semibold tracking-[-0.02em] text-foreground">
            Build paths
          </h2>
        </div>
        <BarChart3 size={15} className="text-muted-foreground" />
      </div>

      {variants.length ? (
        <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-4">
          {variants.map((variant) => (
            <article
              key={variant.name}
              className={cn(
                "overflow-hidden rounded-lg border border-border bg-linear-to-br p-2.5 text-center",
                variant.accent,
              )}
            >
              <div className="flex flex-col items-center gap-1.5">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">
                    {variant.name}
                  </h3>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {variant.description}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold tracking-[-0.04em] text-foreground">
                    {variant.winRate}%
                  </p>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {variant.count} games
                  </p>
                </div>
              </div>
              <ItemStrip
                items={variant.items}
                dataDragonVersion={dataDragonVersion}
                className="mt-2"
                size="sm"
              />
            </article>
          ))}
        </div>
      ) : (
        <EmptyPanelText>
          No playstyle samples yet. Link Riot data or play a few games to
          populate this section.
        </EmptyPanelText>
      )}
    </section>
  );
}

function ItemsPanel({
  coreItems,
  completedItems,
  situationalItems,
  dataDragonVersion,
  hasProfileData,
}: {
  coreItems: { id: number; count: number }[];
  completedItems: { id: number; count: number }[];
  situationalItems: { id: number; count: number }[];
  dataDragonVersion?: string;
  hasProfileData: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="crux-eyebrow">Items</span>
          <h2 className="text-sm font-semibold tracking-[-0.02em] text-foreground">
            Build order
          </h2>
        </div>
        <Sparkles size={15} className="text-primary" />
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 2xl:grid-cols-[1.2fr_1fr]">
        <BuildSection
          title="Starting Items"
          note="Not exposed by Riot post-game data yet"
        >
          <p className="rounded-md border border-dashed border-border bg-background/35 p-2 text-[11px] text-muted-foreground">
            Crux can read your final inventory from match history, but Riot's
            match API does not include the exact opening buy. This section is
            ready for a global build provider later.
          </p>
        </BuildSection>

        <BuildSection title="Build Order" note="Most common final-item path">
          {coreItems.length && dataDragonVersion ? (
            <ItemBuildOrder
              items={coreItems}
              dataDragonVersion={dataDragonVersion}
            />
          ) : (
            <EmptyPanelText>
              {hasProfileData
                ? "No usable item data found for this sample."
                : "Load your profile data to populate item recommendations."}
            </EmptyPanelText>
          )}
        </BuildSection>

        <BuildSection title="Completed Items" note="Highest frequency">
          <ItemStrip
            items={completedItems}
            dataDragonVersion={dataDragonVersion}
          />
        </BuildSection>

        <BuildSection
          title="Situational Items"
          note="Lower frequency alternatives"
        >
          <ItemStrip
            items={situationalItems}
            dataDragonVersion={dataDragonVersion}
            muted
          />
        </BuildSection>
      </div>
    </section>
  );
}

function BuildSection({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        {note ? (
          <p className="truncate text-[10px] text-muted-foreground">{note}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function ItemBuildOrder({
  items,
  dataDragonVersion,
}: {
  items: { id: number; count: number }[];
  dataDragonVersion: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-lg border border-border bg-background/40 p-2 text-center">
      {items.slice(0, 6).map((item, index) => (
        <div key={item.id} className="flex items-center gap-1.5">
          {index > 0 ? (
            <span className="text-muted-foreground/60">→</span>
          ) : null}
          <ItemIcon item={item} dataDragonVersion={dataDragonVersion} />
        </div>
      ))}
    </div>
  );
}

function ItemStrip({
  items,
  dataDragonVersion,
  muted = false,
  className,
  size = "md",
}: {
  items: { id: number; count: number }[];
  dataDragonVersion?: string;
  muted?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  if (!items.length || !dataDragonVersion) {
    return <EmptyPanelText>No item samples yet.</EmptyPanelText>;
  }

  return (
    <div className={cn("flex flex-wrap justify-center gap-1.5", className)}>
      {items.map((item) => (
        <ItemIcon
          key={item.id}
          item={item}
          dataDragonVersion={dataDragonVersion}
          muted={muted}
          size={size}
        />
      ))}
    </div>
  );
}

function ItemIcon({
  item,
  dataDragonVersion,
  muted = false,
  size = "md",
}: {
  item: { id: number; count: number };
  dataDragonVersion: string;
  muted?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "group relative rounded-md border border-border bg-background/50 p-1",
        muted && "opacity-70",
      )}
      title={`Item ${item.id} · ${item.count} games`}
    >
      <img
        src={ddragonItem(dataDragonVersion, item.id) ?? undefined}
        alt={`Item ${item.id}`}
        className={cn(
          "rounded-md bg-muted object-cover",
          size === "sm" ? "h-7 w-7" : "h-9 w-9",
        )}
      />
      <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-sm">
        {item.count}
      </span>
    </div>
  );
}

function LoadoutPanel({
  runeSet,
  runeCount,
  spells,
  spellCount,
  championName,
  source,
  sampleCount,
}: {
  runeSet?: RuneSet;
  runeCount?: number;
  spells?: readonly [number, number];
  spellCount?: number;
  championName: string;
  source: BuildSource;
  sampleCount: number;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="grid grid-cols-1 gap-3 text-center">
        <RunesCard runeSet={runeSet} count={runeCount} />
        <Divider />
        <SummonerSpellsCard spells={spells} count={spellCount} />
        <Divider />
        <AbilityPanel />
        <Divider />
        <InsightsCard
          championName={championName}
          source={source}
          sampleCount={sampleCount}
        />
      </div>
    </section>
  );
}

function RunesCard({ runeSet, count }: { runeSet?: RuneSet; count?: number }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-2">
        <span className="crux-eyebrow">Runes</span>
        {count ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {count} games
          </span>
        ) : null}
      </div>
      {runeSet ? (
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-center gap-2 rounded-lg bg-background/40 p-2">
            <img
              src={ddragonRuneIcon(runeSet.keystone) ?? undefined}
              alt=""
              className="h-9 w-9 rounded-full bg-muted object-cover"
            />
            <div className="min-w-0 text-center">
              <p className="truncate text-xs font-semibold text-foreground">
                {runeName(runeSet.keystone) ?? `Rune ${runeSet.keystone}`}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Keystone sample
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[runeSet.primaryStyle, runeSet.secondaryStyle].map((styleId) => (
              <div
                key={`style-${styleId ?? "unknown"}`}
                className="rounded-md bg-background/40 p-2 text-center"
              >
                <img
                  src={ddragonRuneStyleIcon(styleId) ?? undefined}
                  alt=""
                  className="h-6 w-6 rounded-full bg-muted object-cover"
                />
                <p className="mt-1 truncate text-[11px] font-semibold text-foreground">
                  {runeStyleName(styleId) ?? `Style ${styleId}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No rune data yet.</p>
      )}
    </div>
  );
}

function SummonerSpellsCard({
  spells,
  count,
}: {
  spells?: readonly [number, number];
  count?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-2">
        <span className="crux-eyebrow">Summoners</span>
        {count ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {count} games
          </span>
        ) : null}
      </div>
      {spells ? (
        <div className="mt-2 flex justify-center gap-2">
          {spells.map((spellId) => (
            <img
              key={spellId}
              src={communityDragonSummonerSpell(spellId) ?? undefined}
              alt={`Summoner spell ${spellId}`}
              className="h-10 w-10 rounded-md border border-border bg-muted object-cover"
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No summoner spell data yet.
        </p>
      )}
    </div>
  );
}

function AbilityPanel() {
  return (
    <div>
      <div className="flex items-center justify-center gap-2">
        <span className="crux-eyebrow">Ability Max</span>
        <Flame size={13} className="text-primary" />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Pending global provider · Riot API does not expose skill order
      </p>
    </div>
  );
}

function InsightsCard({
  championName,
  source,
  sampleCount,
}: {
  championName: string;
  source: BuildSource;
  sampleCount: number;
}) {
  return (
    <div>
      <span className="crux-eyebrow justify-center">Insights</span>
      <ul className="mt-2 space-y-1.5 text-center text-xs text-muted-foreground">
        <li className="flex justify-center gap-1.5">
          <Shield size={12} className="mt-0.5 shrink-0 text-primary" />
          <span>
            Recommendations are based on {sourceLabel(source).toLowerCase()}{" "}
            from your own history.
          </span>
        </li>
        <li className="flex justify-center gap-1.5">
          <Sword size={12} className="mt-0.5 shrink-0 text-primary" />
          <span>
            {sampleCount
              ? `${sampleCount} games were used for this ${championName} guide.`
              : "No match samples are available yet."}
          </span>
        </li>
        <li className="flex justify-center gap-1.5">
          <Trophy size={12} className="mt-0.5 shrink-0 text-primary" />
          <span>
            Add a global stats provider later to unlock matchup, rank, patch,
            and worldwide sample filters.
          </span>
        </li>
      </ul>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border" />;
}

function EmptyPanelText({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border bg-background/35 p-2 text-xs text-muted-foreground">
      {children}
    </p>
  );
}

function sourceLabel(source: BuildSource) {
  if (source === "champion") return "Champion sample";
  if (source === "role") return "Role fallback";
  return "Recent fallback";
}

function tierLabel(winRate: number, sampleCount: number) {
  if (!sampleCount) return "—";
  if (winRate >= 58) return "S";
  if (winRate >= 53) return "A";
  if (winRate >= 50) return "B";
  return "C";
}
