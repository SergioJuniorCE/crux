import { useMemo, useState } from "react";
import {
  AlertCircle,
  Filter,
  RadioTower,
  RefreshCw,
  Shield,
  Sword,
  Trophy,
  UserCircle2,
} from "lucide-react";

import type { RiotProfileBundle } from "../types/riot";
import { REGION_LABELS, type PlatformRegion } from "../types/riot";
import { PlayerSearch } from "@/components/PlayerSearch";
import { useErrorToast } from "@/hooks/useErrorToast";
import { useRankedLpHistory } from "@/hooks/useRankedLpHistory";
import {
  QUEUE_FILTERS,
  ddragonProfileIcon,
  queueGroup,
  type QueueGroup,
} from "@/lib/leagueAssets";
import { cn } from "@/lib/utils";

import { aggregate } from "./profile/aggregate";
import { ChampionsPanel } from "./profile/ChampionsPanel";
import { MatchRow } from "./profile/MatchRow";
import { PageHeader } from "./profile/PageHeader";
import { EmptyRankedPanel, RankedPanel } from "./profile/RankedPanel";
import { RolesPanel } from "./profile/RolesPanel";
import { Skeleton } from "./profile/Skeleton";
import { SummaryCard } from "./profile/SummaryCard";
import { WinLossTrend } from "./profile/WinLossTrend";
import { findSelf, relativeTime } from "./profile/utils";

type ProfileViewProps = {
  status: "idle" | "loading" | "success" | "error";
  data: RiotProfileBundle | null;
  error: string | null;
  configured: boolean;
  hasIdentity: boolean;
  hasApiAccess: boolean;
  platform: PlatformRegion;
  clientLive: boolean;
  /** True when this view is showing another player's profile (not the signed-in user). */
  isViewingOther?: boolean;
  /** Riot ID of the signed-in user; used to avoid linking your own row to yourself. */
  ownIdentity?: { gameName: string; tagLine: string };
  onRefresh: () => void;
  onOpenSettings: () => void;
  /** Navigate to another player's profile page. */
  onSelectPlayer?: (gameName: string, tagLine: string) => void;
  /** Return to the signed-in user's profile from the "other player" view. */
  onBackToOwn?: () => void;
};

export function ProfileView({
  status,
  data,
  error,
  configured,
  hasIdentity,
  hasApiAccess,
  platform,
  clientLive,
  isViewingOther = false,
  ownIdentity,
  onRefresh,
  onOpenSettings,
  onSelectPlayer,
  onBackToOwn,
}: ProfileViewProps) {
  const [queueFilter, setQueueFilter] = useState<QueueGroup | "all">("all");
  const rankedLpHistory = useRankedLpHistory(data);

  useErrorToast({
    error,
    title: isViewingOther
      ? "Could not load player profile"
      : "Could not load your profile",
    enabled: status === "error",
  });

  const allStats = useMemo(
    () => (data ? aggregate(data.matches, data.account.puuid) : null),
    [data],
  );

  const filteredMatches = useMemo(() => {
    if (!data) return [];
    if (queueFilter === "all") return data.matches;
    return data.matches.filter(
      (m) => queueGroup(m.info.queueId) === queueFilter,
    );
  }, [data, queueFilter]);

  const filteredStats = useMemo(
    () => (data ? aggregate(filteredMatches, data.account.puuid) : null),
    [data, filteredMatches],
  );

  if (!configured) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader />
        <section className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.04] text-primary">
            <UserCircle2 size={24} />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">
            No Riot account linked
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {!hasIdentity
              ? "Add your Riot ID below or open the League of Legends client to auto-detect your account."
              : !hasApiAccess
                ? "Your Riot ID is saved, but you still need a Riot developer API key in Settings (or RIOT_API_KEY in .env) to load profile data."
                : "Open the League of Legends client to auto-detect your account, or enter your Riot ID and a developer API key manually. You can also look up any player by Riot ID below."}
          </p>
          <div className="mx-auto mt-4 max-w-sm">
            <PlayerSearch
              platform={platform}
              placeholder={
                hasIdentity
                  ? "Look up a player on this region — Name#TAG"
                  : "Look up a player — Name#TAG"
              }
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <RadioTower size={14} />
              Detect client
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-white/15"
            >
              {hasIdentity && !hasApiAccess ? "Add API key" : "Open Settings"}
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (status === "loading" && !data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader />
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-5">
            <Skeleton className="h-24 w-24 rounded-2xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
        </section>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader />
        <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-400">
              <AlertCircle size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-red-300">
                Could not load your profile
              </h2>
              <p className="mt-1 break-words text-xs text-red-300/80">
                {error ?? "Unknown error"}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onRefresh}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-white/15"
                >
                  <RefreshCw size={12} />
                  Retry
                </button>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Check settings
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const { account, summoner, league, dataDragonVersion } = data;
  const soloEntry = league.find((e) => e.queueType === "RANKED_SOLO_5x5");
  const flexEntry = league.find((e) => e.queueType === "RANKED_FLEX_SR");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        isViewingOther={isViewingOther}
        onBackToOwn={onBackToOwn}
        right={
          <button
            type="button"
            onClick={onRefresh}
            disabled={status === "loading"}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:border-white/15 disabled:opacity-50"
          >
            <RefreshCw
              size={12}
              className={cn(status === "loading" && "animate-spin")}
            />
            Refresh
          </button>
        }
      />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-card p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-primary/40" />
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative shrink-0">
            <img
              src={ddragonProfileIcon(
                dataDragonVersion,
                summoner.profileIconId,
              )}
              alt=""
              className="h-24 w-24 rounded-2xl border border-border object-cover shadow-lg shadow-black/30"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility =
                  "hidden";
              }}
            />
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-primary-foreground shadow">
              {summoner.summonerLevel}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h1 className="truncate text-3xl font-semibold tracking-tight text-foreground">
                {account.gameName}
              </h1>
              <span className="font-mono text-base text-muted-foreground">
                #{account.tagLine}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {clientLive && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-emerald-300 ring-1 ring-emerald-500/25"
                  title="Account auto-detected from the running League client"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Live from client
                </span>
              )}
              <span className="rounded-full bg-white/4 px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {REGION_LABELS[platform]}
              </span>
              <span className="rounded-full bg-white/[0.04] px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Level {summoner.summonerLevel}
              </span>
              <span className="rounded-full bg-white/[0.04] px-2.5 py-1 font-mono text-[10.5px] tabular-nums text-muted-foreground">
                Profile updated {relativeTime(summoner.revisionDate)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Two-column layout: sidebar + matches */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <aside className="flex flex-col gap-3">
          {soloEntry ? (
            <RankedPanel
              entry={soloEntry}
              icon={<Trophy size={14} />}
              lpHistory={rankedLpHistory}
            />
          ) : (
            <EmptyRankedPanel
              label="Ranked Solo / Duo"
              icon={<Trophy size={14} />}
            />
          )}
          {flexEntry ? (
            <RankedPanel
              entry={flexEntry}
              icon={<Shield size={14} />}
              lpHistory={rankedLpHistory}
            />
          ) : (
            <EmptyRankedPanel label="Ranked Flex" icon={<Shield size={14} />} />
          )}

          <ChampionsPanel
            champions={(filteredStats ?? allStats)?.champions ?? []}
            version={dataDragonVersion}
          />

          <RolesPanel roles={(filteredStats ?? allStats)?.roles ?? []} />
        </aside>

        <main className="flex flex-col gap-3">
          {filteredStats && filteredStats.totals.games > 0 && (
            <SummaryCard stats={filteredStats} />
          )}

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Filter size={12} className="text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Filters
              </span>
              <div className="ml-1 flex flex-wrap gap-1.5">
                {QUEUE_FILTERS.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setQueueFilter(q.id)}
                    className={cn(
                      "rounded-full px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wide ring-1 transition-colors",
                      queueFilter === q.id
                        ? "bg-primary/15 text-primary ring-primary/30"
                        : "bg-white/[0.03] text-muted-foreground ring-white/5 hover:text-foreground",
                    )}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
                {filteredMatches.length}{" "}
                {filteredMatches.length === 1 ? "match" : "matches"}
              </span>
            </div>

            {filteredStats && filteredStats.recent.length > 0 && (
              <WinLossTrend recent={filteredStats.recent} />
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-3">
            <div className="mb-3 flex items-center gap-2 px-2 pt-1">
              <Sword size={13} className="text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Match history
              </span>
            </div>

            {filteredMatches.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                No matches for this filter.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {filteredMatches.map((match) => {
                  const self = findSelf(match, account.puuid);
                  if (!self) return null;
                  return (
                    <MatchRow
                      key={match.metadata.matchId}
                      match={match}
                      self={self}
                      version={dataDragonVersion}
                      ownIdentity={ownIdentity}
                      onSelectPlayer={onSelectPlayer}
                    />
                  );
                })}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
