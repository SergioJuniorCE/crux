import { useEffect, useState, type ReactNode } from "react";
import {
  AlertCircle,
  BarChart3,
  Database,
  Flame,
  RefreshCw,
  Shield,
  Sparkles,
  Sword,
  Trophy,
} from "lucide-react";

import type {
  LcuChampSelectSession,
  RiotProfileBundle,
  ChampionItemStat,
} from "../types/riot";
import { useChampionStats } from "../hooks/useChampionStats";
import type { RiotSettings } from "../hooks/useRiotSettings";
import {
  ROLE_LABELS,
  ddragonChampionSquare,
  ddragonItem,
} from "@/lib/leagueAssets";
import { cn } from "@/lib/utils";

type ChampSelectViewProps = {
  status: "idle" | "loading" | "active" | "error";
  session: LcuChampSelectSession | null;
  error: string | null;
  profileStatus: "idle" | "loading" | "success" | "error";
  profileData: RiotProfileBundle | null;
  profileConfigured: boolean;
  settings: RiotSettings;
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

const ROLE_FALLBACK_LABELS: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "ADC",
  UTILITY: "Support",
  UNSELECTED: "Any role",
};

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
  profileStatus: _profileStatus,
  profileData,
  profileConfigured,
  settings,
  onRefresh,
  onOpenSettings,
}: ChampSelectViewProps) {
  const [champions, setChampions] = useState<ChampionLookup | null>(null);
  const championId = findLocalChampionId(session);
  const localRole = findLocalRole(session);
  const dataDragonVersion =
    profileData?.dataDragonVersion ?? champions?.version;

  // Fetch global stats from the backend
  const globalStats = useChampionStats(settings, championId, {
    order: 0,
    minGames: 5,
    limit: 20,
  });

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
  const roleLabel =
    ROLE_LABELS[localRole] ?? ROLE_FALLBACK_LABELS[localRole] ?? localRole;

  // Categorize items by purchase order from global stats
  const firstItems = globalStats.items.filter((item) => item.avgPurchaseTime && item.avgPurchaseTime < 720).slice(0, 6);
  const topItems = globalStats.items.slice(0, 10);
  const situationalItems = globalStats.items.slice(10, 18);

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
    ? `${championTitle} ${roleLabel} Build, Items, and Stats`
    : "Champion Build, Items, and Stats";

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
                {globalStats.hasData && (
                  <FilterChip
                    label="Source"
                    value={`${globalStats.totalGames.toLocaleString()} Master+ games`}
                  />
                )}
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {championId
                  ? globalStats.hasData
                    ? `Global recommendations · patch ${globalStats.patch || "latest"} · ${globalStats.items.length} items tracked`
                    : "No global stats available yet. Run the crawler to populate data."
                  : "Hover or lock a champion to populate the guide."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            <HeroStat
              label="Tier"
              value={tierLabel(
                globalStats.items[0]?.winRate ?? 0,
                globalStats.items[0]?.gamesPlayed ?? 0,
              )}
            />
            <HeroStat
              label="Top Item WR"
              value={globalStats.items[0] ? `${globalStats.items[0].winRate}%` : "—"}
            />
            <HeroStat
              label="Items Tracked"
              value={String(globalStats.items.length)}
            />
            <HeroStat
              label="Total Games"
              value={globalStats.totalGames.toLocaleString()}
            />
            <HeroStat
              label="Patch"
              value={globalStats.patch || "—"}
            />
          </div>
        </div>
      </section>

      {!profileConfigured ? (
        <section className="rounded-xl border border-dashed border-border bg-card/50 p-5 text-center">
          <h2 className="text-sm font-semibold text-foreground">
            Set up backend for recommendations
          </h2>
          <p className="mx-auto mt-1 max-w-lg text-xs text-muted-foreground">
            Global champion stats are fetched from the Crux backend. Make sure
            your backend URL and Riot API key are configured in Settings.
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open Settings
          </button>
        </section>
      ) : globalStats.status === "loading" ? (
        <section className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Loading global champion stats…
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="space-y-2">
          <PlaystyleBuilds
            items={topItems}
            dataDragonVersion={dataDragonVersion}
          />
          <ItemsPanel
            firstItems={firstItems}
            topItems={topItems}
            situationalItems={situationalItems}
            dataDragonVersion={dataDragonVersion}
            hasStats={globalStats.hasData}
          />
        </main>

        <aside>
          <LoadoutPanel
            championName={championTitle}
            source="global"
            sampleCount={globalStats.totalGames}
            dataDragonVersion={dataDragonVersion}
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
  items,
  dataDragonVersion,
}: {
  items: ChampionItemStat[];
  dataDragonVersion?: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="crux-eyebrow">Top Items</span>
          <h2 className="text-sm font-semibold tracking-[-0.02em] text-foreground">
            Highest win rate
          </h2>
        </div>
        <BarChart3 size={15} className="text-muted-foreground" />
      </div>

      {items.length ? (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {items.slice(0, 5).map((item) => (
            <article
              key={item.itemId}
              className="overflow-hidden rounded-lg border border-border bg-linear-to-br from-background/40 to-background/10 p-2.5 text-center"
            >
              <div className="flex flex-col items-center gap-1">
                {dataDragonVersion ? (
                  <img
                    src={ddragonItem(dataDragonVersion, item.itemId) ?? undefined}
                    alt={`Item ${item.itemId}`}
                    className="h-10 w-10 rounded-md border border-border bg-muted object-cover"
                  />
                ) : (
                  <span className="h-10 w-10 rounded-md border border-dashed border-border bg-background/50" />
                )}
                <div>
                  <p className="text-base font-bold tracking-[-0.04em] text-foreground">
                    {item.winRate}%
                  </p>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {item.gamesPlayed.toLocaleString()} games
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyPanelText>
          No global stats available for this champion yet. Run the crawler to
          populate data.
        </EmptyPanelText>
      )}
    </section>
  );
}

function ItemsPanel({
  firstItems,
  topItems,
  situationalItems,
  dataDragonVersion,
  hasStats,
}: {
  firstItems: ChampionItemStat[];
  topItems: ChampionItemStat[];
  situationalItems: ChampionItemStat[];
  dataDragonVersion?: string;
  hasStats: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="crux-eyebrow">Items</span>
          <h2 className="text-sm font-semibold tracking-[-0.02em] text-foreground">
            By win rate
          </h2>
        </div>
        <Sparkles size={15} className="text-primary" />
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 2xl:grid-cols-[1.2fr_1fr]">
        <BuildSection
          title="First Items"
          note="Highest WR items (purchased before ~12 min)"
        >
          {firstItems.length && dataDragonVersion ? (
            <FirstItemRow items={firstItems} dataDragonVersion={dataDragonVersion} />
          ) : (
            <EmptyPanelText>
              {hasStats
                ? "Not enough purchase-time data to filter first items."
                : "No global stats available yet."}
            </EmptyPanelText>
          )}
        </BuildSection>

        <BuildSection title="Top Items" note="Highest win rate overall">
          {topItems.length && dataDragonVersion ? (
            <ItemStrip
              items={topItems}
              dataDragonVersion={dataDragonVersion}
            />
          ) : (
            <EmptyPanelText>
              {hasStats
                ? "No item data available."
                : "No global stats available yet."}
            </EmptyPanelText>
          )}
        </BuildSection>

        <BuildSection title="Situational" note="Also strong alternatives">
          <ItemStrip
            items={situationalItems}
            dataDragonVersion={dataDragonVersion}
            muted
          />
        </BuildSection>

        <BuildSection title="Sample Note" note="">
          <p className="rounded-md border border-dashed border-border bg-background/35 p-2 text-[11px] text-muted-foreground">
            Items are ranked by win rate across all Master+ games in the local
            database. Larger sample sizes = more reliable data. Run the crawler
            for more matches.
          </p>
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

function FirstItemRow({
  items,
  dataDragonVersion,
}: {
  items: ChampionItemStat[];
  dataDragonVersion: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-lg border border-border bg-background/40 p-2 text-center">
      {items.slice(0, 6).map((item, index) => (
        <div key={item.itemId} className="flex items-center gap-1.5">
          {index > 0 ? (
            <span className="text-muted-foreground/60">→</span>
          ) : null}
          <div
            className="group relative rounded-md border border-border bg-background/50 p-1"
            title={`${item.winRate}% WR · ${item.gamesPlayed} games`}
          >
            <img
              src={ddragonItem(dataDragonVersion, item.itemId) ?? undefined}
              alt={`Item ${item.itemId}`}
              className="h-9 w-9 rounded-md bg-muted object-cover"
            />
            <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-sm">
              {item.winRate}%
            </span>
          </div>
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
  items: ChampionItemStat[];
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
        <div
          key={item.itemId}
          className={cn(
            "group relative rounded-md border border-border bg-background/50 p-1",
            muted && "opacity-70",
          )}
          title={`${item.winRate}% WR · ${item.gamesPlayed.toLocaleString()} games`}
        >
          <img
            src={ddragonItem(dataDragonVersion, item.itemId) ?? undefined}
            alt={`Item ${item.itemId}`}
            className={cn(
              "rounded-md bg-muted object-cover",
              size === "sm" ? "h-7 w-7" : "h-9 w-9",
            )}
          />
          <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-sm">
            {item.winRate}%
          </span>
        </div>
      ))}
    </div>
  );
}

function LoadoutPanel({
  championName,
  source: _source,
  sampleCount,
  dataDragonVersion,
}: {
  championName: string;
  source: string;
  sampleCount: number;
  dataDragonVersion?: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="grid grid-cols-1 gap-3 text-center">
        <RunesCard />
        <Divider />
        <SummonerSpellsCard />
        <Divider />
        <AbilityPanel />
        <Divider />
        <InsightsCard
          championName={championName}
          sampleCount={sampleCount}
          dataDragonVersion={dataDragonVersion}
        />
      </div>
    </section>
  );
}

function RunesCard() {
  return (
    <div>
      <div className="flex items-center justify-center gap-2">
        <span className="crux-eyebrow">Runes</span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Rune aggregation coming to the global stats provider. Run the crawler
        to build the dataset — rune stats will be available in a future update.
      </p>
    </div>
  );
}

function SummonerSpellsCard() {
  return (
    <div>
      <div className="flex items-center justify-center gap-2">
        <span className="crux-eyebrow">Summoners</span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Summoner spell aggregation coming to the global stats provider.
      </p>
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
  sampleCount,
  dataDragonVersion,
}: {
  championName: string;
  sampleCount: number;
  dataDragonVersion?: string;
}) {
  return (
    <div>
      <span className="crux-eyebrow justify-center">Insights</span>
      <ul className="mt-2 space-y-1.5 text-center text-xs text-muted-foreground">
        <li className="flex justify-center gap-1.5">
          <Database size={12} className="mt-0.5 shrink-0 text-primary" />
          <span>
            Recommendations from{" "}
            <strong className="text-foreground">
              {sampleCount.toLocaleString()}
            </strong>{" "}
            Master+ games in the local database.
          </span>
        </li>
        <li className="flex justify-center gap-1.5">
          <Shield size={12} className="mt-0.5 shrink-0 text-primary" />
          <span>
            Data sourced from {dataDragonVersion ? `patch ${dataDragonVersion}` : "the latest patch"}.
            Older patches are excluded automatically.
          </span>
        </li>
        <li className="flex justify-center gap-1.5">
          <Sword size={12} className="mt-0.5 shrink-0 text-primary" />
          <span>
            {championName} data is a filtered subset. Run{" "}
            <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[10px]">
              bun run scrape:seed
            </code>{" "}
            to grow the dataset.
          </span>
        </li>
        <li className="flex justify-center gap-1.5">
          <Trophy size={12} className="mt-0.5 shrink-0 text-primary" />
          <span>
            Matchup-specific filters will be available once the dataset reaches
            sufficient sample sizes.
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

function tierLabel(winRate: number, sampleCount: number) {
  if (!sampleCount) return "—";
  if (winRate >= 58) return "S";
  if (winRate >= 53) return "A";
  if (winRate >= 50) return "B";
  return "C";
}
