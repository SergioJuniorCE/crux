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
import { AnimatePresence, LayoutGroup, motion } from "motion/react";

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
import {
  EASE_OUT_EXPO,
  containerStagger,
  fadeUp,
  listStagger,
} from "./profile/motion";

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
      <div className="flex flex-col gap-3">
        <PageHeader />
        <section className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] text-primary">
            <UserCircle2 size={20} />
          </div>
          <h2 className="mt-3 text-sm font-semibold text-foreground">
            No Riot account linked
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
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
      <div className="flex flex-col gap-3">
        <PageHeader />
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        </section>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader />
        <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
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
    <motion.div
      variants={containerStagger}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-3"
    >
      <PageHeader
        isViewingOther={isViewingOther}
        onBackToOwn={onBackToOwn}
        right={
          <motion.button
            type="button"
            onClick={onRefresh}
            disabled={status === "loading"}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 disabled:opacity-50"
          >
            <RefreshCw
              size={11}
              className={cn(status === "loading" && "animate-spin")}
            />
            Refresh
          </motion.button>
        }
      />

      <motion.section
        variants={fadeUp}
        className="crux-grain relative overflow-hidden rounded-xl border border-border bg-card px-5 py-4"
      >
        {/* Editorial top hairline that sweeps in from the left */}
        <motion.span
          aria-hidden
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay: 0.1 }}
          style={{ transformOrigin: "0% 50%" }}
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/70 via-primary/20 to-transparent"
        />
        {/* Soft radial wash anchored bottom-right — atmosphere, not noise */}
        <div className="pointer-events-none absolute -bottom-24 -right-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />

        <div className="flex flex-wrap items-center gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.15 }}
            className="relative shrink-0"
          >
            <img
              src={ddragonProfileIcon(
                dataDragonVersion,
                summoner.profileIconId,
              )}
              alt=""
              className="h-[68px] w-[68px] rounded-2xl border border-border object-cover shadow-lg shadow-black/30 ring-1 ring-white/5"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility =
                  "hidden";
              }}
            />
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none tabular-nums text-primary-foreground shadow-md shadow-primary/20">
              {summoner.summonerLevel}
            </span>
          </motion.div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.2 }}
                className="truncate font-display text-[28px] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground"
              >
                {account.gameName}
              </motion.h1>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.35 }}
                className="font-mono text-[13px] tracking-tight text-muted-foreground"
              >
                #{account.tagLine}
              </motion.span>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: EASE_OUT_EXPO, delay: 0.3 }}
              className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-primary/80" />
                {REGION_LABELS[platform]}
              </span>
              <span className="text-muted-foreground/30">/</span>
              <span>Lvl {summoner.summonerLevel}</span>
              <span className="text-muted-foreground/30">/</span>
              <span className="normal-case tracking-normal tabular-nums text-muted-foreground/80">
                updated {relativeTime(summoner.revisionDate)}
              </span>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.div
        variants={containerStagger}
        className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]"
      >
        <motion.aside variants={containerStagger} className="flex flex-col gap-3">
          <motion.div variants={fadeUp}>
            {soloEntry ? (
              <RankedPanel
                entry={soloEntry}
                icon={<Trophy size={11} />}
                lpHistory={rankedLpHistory}
              />
            ) : (
              <EmptyRankedPanel
                label="Ranked Solo / Duo"
                icon={<Trophy size={11} />}
              />
            )}
          </motion.div>
          <motion.div variants={fadeUp}>
            {flexEntry ? (
              <RankedPanel
                entry={flexEntry}
                icon={<Shield size={11} />}
                lpHistory={rankedLpHistory}
              />
            ) : (
              <EmptyRankedPanel label="Ranked Flex" icon={<Shield size={11} />} />
            )}
          </motion.div>

          <motion.div variants={fadeUp}>
            <ChampionsPanel
              champions={(filteredStats ?? allStats)?.champions ?? []}
              version={dataDragonVersion}
            />
          </motion.div>

          <motion.div variants={fadeUp}>
            <RolesPanel roles={(filteredStats ?? allStats)?.roles ?? []} />
          </motion.div>
        </motion.aside>

        <motion.main variants={containerStagger} className="flex flex-col gap-3">
          {filteredStats && filteredStats.totals.games > 0 && (
            <motion.div variants={fadeUp}>
              <SummaryCard stats={filteredStats} />
            </motion.div>
          )}

          <motion.section
            variants={fadeUp}
            className="rounded-xl border border-border bg-card px-3 py-2.5"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Filter size={11} className="text-muted-foreground" />
              <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Filters
              </span>
              <LayoutGroup id="queue-filter">
                <div className="ml-1 flex flex-wrap gap-0.5">
                  {QUEUE_FILTERS.map((q) => {
                    const active = queueFilter === q.id;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setQueueFilter(q.id)}
                        className={cn(
                          "relative rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors",
                          active
                            ? "text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="queue-filter-pill"
                            className="absolute inset-0 rounded-full bg-primary shadow-[inset_0_-1px_0_rgba(0,0,0,0.2)]"
                            transition={{
                              type: "spring",
                              stiffness: 380,
                              damping: 32,
                            }}
                          />
                        )}
                        <span className="relative">{q.label}</span>
                      </button>
                    );
                  })}
                </div>
              </LayoutGroup>
              <motion.span
                key={filteredMatches.length}
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground"
              >
                {filteredMatches.length}{" "}
                {filteredMatches.length === 1 ? "match" : "matches"}
              </motion.span>
            </div>

            {filteredStats && filteredStats.recent.length > 0 && (
              <WinLossTrend recent={filteredStats.recent} />
            )}
          </motion.section>

          <motion.section
            variants={fadeUp}
            className="rounded-xl border border-border bg-card p-2.5"
          >
            <div className="mb-2 flex items-center gap-2 px-1.5 pt-0.5">
              <Sword size={12} className="text-muted-foreground" />
              <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Match history
              </span>
              <span className="ml-2 h-px flex-1 bg-gradient-to-r from-border to-transparent" />
            </div>

            {filteredMatches.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No matches for this filter.
              </p>
            ) : (
              <AnimatePresence mode="popLayout">
                <motion.ul
                  key={queueFilter}
                  variants={listStagger}
                  initial="hidden"
                  animate="show"
                  className="flex flex-col gap-1.5"
                >
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
                </motion.ul>
              </AnimatePresence>
            )}
          </motion.section>
        </motion.main>
      </motion.div>
    </motion.div>
  );
}
