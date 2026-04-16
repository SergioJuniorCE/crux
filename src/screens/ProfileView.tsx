import { useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Filter,
  Flame,
  RadioTower,
  RefreshCw,
  Shield,
  Sparkles,
  Sword,
  Target,
  Trophy,
  UserCircle2,
} from 'lucide-react'

import type {
  RiotLeagueEntry,
  RiotMatch,
  RiotMatchParticipant,
  RiotProfileBundle,
} from '../types/riot'
import { REGION_LABELS, type PlatformRegion } from '../types/riot'
import { PlayerSearch } from '@/components/PlayerSearch'
import {
  QUEUE_FILTERS,
  ROLE_LABELS,
  ROLE_ORDER,
  communityDragonSummonerSpell,
  ddragonChampionSquare,
  ddragonItem,
  ddragonProfileIcon,
  queueGroup,
  queueName,
  tierStyle,
  type QueueGroup,
} from '@/lib/leagueAssets'
import { cn } from '@/lib/utils'

type ProfileViewProps = {
  status: 'idle' | 'loading' | 'success' | 'error'
  data: RiotProfileBundle | null
  error: string | null
  configured: boolean
  platform: PlatformRegion
  clientLive: boolean
  /** True when this view is showing another player's profile (not the signed-in user). */
  isViewingOther?: boolean
  /** Riot ID of the signed-in user; used to avoid linking your own row to yourself. */
  ownIdentity?: { gameName: string; tagLine: string }
  onRefresh: () => void
  onOpenSettings: () => void
  /** Navigate to another player's profile page. */
  onSelectPlayer?: (gameName: string, tagLine: string) => void
  /** Return to the signed-in user's profile from the "other player" view. */
  onBackToOwn?: () => void
}

function winRate(wins: number, losses: number) {
  const total = wins + losses
  if (total === 0) return 0
  return Math.round((wins / total) * 100)
}

function formatTier(entry: RiotLeagueEntry) {
  const tier = entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase()
  return `${tier} ${entry.rank}`
}

function formatQueue(queueType: string) {
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

function relativeTime(ms: number) {
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

function findSelf(match: RiotMatch, puuid: string): RiotMatchParticipant | null {
  return match.info.participants.find((p) => p.puuid === puuid) ?? null
}

function formatKda(kills: number, deaths: number, assists: number) {
  if (deaths === 0) return 'Perfect'
  return ((kills + assists) / deaths).toFixed(2)
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-white/[0.06]', className)} />
}

// -------- Aggregations --------

type ChampionStats = {
  championName: string
  games: number
  wins: number
  losses: number
  kills: number
  deaths: number
  assists: number
}

type RoleStats = {
  role: string
  games: number
  wins: number
}

type Aggregates = {
  totals: { games: number; wins: number; losses: number; kills: number; deaths: number; assists: number }
  champions: ChampionStats[]
  roles: RoleStats[]
  recent: { win: boolean; timestamp: number }[]
}

function aggregate(matches: RiotMatch[], puuid: string): Aggregates {
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

// -------- View --------

export function ProfileView({
  status,
  data,
  error,
  configured,
  platform,
  clientLive,
  isViewingOther = false,
  ownIdentity,
  onRefresh,
  onOpenSettings,
  onSelectPlayer,
  onBackToOwn,
}: ProfileViewProps) {
  const [queueFilter, setQueueFilter] = useState<QueueGroup | 'all'>('all')

  const allStats = useMemo(
    () => (data ? aggregate(data.matches, data.account.puuid) : null),
    [data],
  )

  const filteredMatches = useMemo(() => {
    if (!data) return []
    if (queueFilter === 'all') return data.matches
    return data.matches.filter((m) => queueGroup(m.info.queueId) === queueFilter)
  }, [data, queueFilter])

  const filteredStats = useMemo(
    () => (data ? aggregate(filteredMatches, data.account.puuid) : null),
    [data, filteredMatches],
  )

  if (!configured) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader />
        <section className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.04] text-primary">
            <UserCircle2 size={24} />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">No Riot account linked</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Open the League of Legends client to auto-detect your account, or enter your Riot ID
            and a developer API key manually. You can also look up any player by Riot ID below.
          </p>
          <div className="mx-auto mt-4 max-w-sm">
            <PlayerSearch placeholder="Look up any player — Name#TAG" />
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
              Open Settings
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (status === 'loading' && !data) {
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
    )
  }

  if (status === 'error' || !data) {
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
                {error ?? 'Unknown error'}
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
    )
  }

  const { account, summoner, league, dataDragonVersion } = data
  const soloEntry = league.find((e) => e.queueType === 'RANKED_SOLO_5x5')
  const flexEntry = league.find((e) => e.queueType === 'RANKED_FLEX_SR')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        isViewingOther={isViewingOther}
        onBackToOwn={onBackToOwn}
        right={
          <button
            type="button"
            onClick={onRefresh}
            disabled={status === 'loading'}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:border-white/15 disabled:opacity-50"
          >
            <RefreshCw size={12} className={cn(status === 'loading' && 'animate-spin')} />
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
              src={ddragonProfileIcon(dataDragonVersion, summoner.profileIconId)}
              alt=""
              className="h-24 w-24 rounded-2xl border border-border object-cover shadow-lg shadow-black/30"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
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
              <span className="font-mono text-base text-muted-foreground">#{account.tagLine}</span>
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
              <span className="rounded-full bg-white/[0.04] px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
        {/* Sidebar */}
        <aside className="flex flex-col gap-3">
          {soloEntry ? (
            <RankedPanel entry={soloEntry} icon={<Trophy size={14} />} />
          ) : (
            <EmptyRankedPanel label="Ranked Solo / Duo" icon={<Trophy size={14} />} />
          )}
          {flexEntry ? (
            <RankedPanel entry={flexEntry} icon={<Shield size={14} />} />
          ) : (
            <EmptyRankedPanel label="Ranked Flex" icon={<Shield size={14} />} />
          )}

          <ChampionsPanel
            champions={(filteredStats ?? allStats)?.champions ?? []}
            version={dataDragonVersion}
          />

          <RolesPanel roles={(filteredStats ?? allStats)?.roles ?? []} />
        </aside>

        {/* Main column */}
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
                      'rounded-full px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wide ring-1 transition-colors',
                      queueFilter === q.id
                        ? 'bg-primary/15 text-primary ring-primary/30'
                        : 'bg-white/[0.03] text-muted-foreground ring-white/5 hover:text-foreground',
                    )}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
                {filteredMatches.length}{' '}
                {filteredMatches.length === 1 ? 'match' : 'matches'}
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
                  const self = findSelf(match, account.puuid)
                  if (!self) return null
                  return (
                    <MatchRow
                      key={match.metadata.matchId}
                      match={match}
                      self={self}
                      version={dataDragonVersion}
                      ownIdentity={ownIdentity}
                      onSelectPlayer={onSelectPlayer}
                    />
                  )
                })}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

// -------- Header --------

function PageHeader({
  right,
  isViewingOther = false,
  onBackToOwn,
}: {
  right?: React.ReactNode
  isViewingOther?: boolean
  onBackToOwn?: () => void
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {isViewingOther && onBackToOwn && (
          <button
            type="button"
            onClick={onBackToOwn}
            className="mb-1.5 inline-flex items-center gap-1 rounded-md text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={11} />
            Back to my profile
          </button>
        )}
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {isViewingOther ? 'Player profile' : 'Profile'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isViewingOther
            ? 'Viewing another summoner. Click any player in a match to jump to their profile.'
            : 'Your Riot account, ranked standings, and recent matches.'}
        </p>
      </div>
      {right}
    </div>
  )
}

// -------- Summary --------

function SummaryCard({ stats }: { stats: Aggregates }) {
  const { totals } = stats
  const wr = winRate(totals.wins, totals.losses)
  const kda = formatKda(totals.kills, totals.deaths, totals.assists)
  const kdaNum = totals.deaths === 0 ? totals.kills + totals.assists : (totals.kills + totals.assists) / totals.deaths

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={13} className="text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Last {totals.games} games performance
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 items-center gap-4 sm:grid-cols-[auto_1fr_auto]">
        {/* Winrate ring */}
        <div className="flex items-center gap-4">
          <WinRateRing wr={wr} wins={totals.wins} losses={totals.losses} />
          <div className="hidden sm:block">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Record
            </div>
            <div className="mt-1 font-mono text-sm tabular-nums">
              <span className="text-emerald-300">{totals.wins}W</span>
              <span className="mx-1 text-muted-foreground">·</span>
              <span className="text-red-300">{totals.losses}L</span>
            </div>
          </div>
        </div>

        {/* KDA block */}
        <div className="flex items-baseline gap-3 sm:justify-center">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              KDA
            </div>
            <div
              className={cn(
                'font-mono text-3xl font-semibold tabular-nums',
                kdaNum >= 4
                  ? 'text-amber-300'
                  : kdaNum >= 3
                    ? 'text-emerald-300'
                    : kdaNum >= 2
                      ? 'text-foreground'
                      : 'text-red-300',
              )}
            >
              {kda}
            </div>
          </div>
          <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {(totals.kills / Math.max(1, totals.games)).toFixed(1)}
            {' / '}
            <span className="text-red-300/70">
              {(totals.deaths / Math.max(1, totals.games)).toFixed(1)}
            </span>
            {' / '}
            {(totals.assists / Math.max(1, totals.games)).toFixed(1)}
          </div>
        </div>

        {/* Games played */}
        <div className="text-right">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Games
          </div>
          <div className="mt-1 font-mono text-3xl font-semibold tabular-nums text-foreground">
            {totals.games}
          </div>
        </div>
      </div>
    </section>
  )
}

function WinRateRing({ wr, wins, losses }: { wr: number; wins: number; losses: number }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const dash = (wr / 100) * circumference
  const color = wr >= 60 ? 'stroke-emerald-400' : wr >= 50 ? 'stroke-primary' : 'stroke-red-400'

  return (
    <div className="relative h-[72px] w-[72px]">
      <svg viewBox="0 0 72 72" className="h-[72px] w-[72px] -rotate-90">
        <circle cx="36" cy="36" r={radius} className="fill-none stroke-white/5" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          className={cn('fill-none transition-all', color)}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{wr}%</span>
        <span className="font-mono text-[9px] tabular-nums text-muted-foreground">
          {wins}W · {losses}L
        </span>
      </div>
    </div>
  )
}

// -------- Trend --------

function WinLossTrend({ recent }: { recent: { win: boolean; timestamp: number }[] }) {
  // Oldest first, capped to last 20 for readability.
  const series = [...recent].slice(0, 20).reverse()

  return (
    <div className="flex items-center gap-1">
      {series.map((r, i) => (
        <span
          key={i}
          title={`${r.win ? 'Win' : 'Loss'} · ${relativeTime(r.timestamp)}`}
          className={cn(
            'h-6 flex-1 min-w-[10px] rounded-sm',
            r.win ? 'bg-emerald-400/80' : 'bg-red-400/70',
          )}
        />
      ))}
    </div>
  )
}

// -------- Sidebar panels --------

function RankedPanel({ entry, icon }: { entry: RiotLeagueEntry; icon: React.ReactNode }) {
  const wr = winRate(entry.wins, entry.losses)
  const style = tierStyle(entry.tier)

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {formatQueue(entry.queueType)}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-2',
            style.gradient,
            style.ring,
          )}
        >
          <span className={cn('font-mono text-sm font-black tracking-tight', style.text)}>
            {entry.tier.slice(0, 1)}
            <span className="text-[10px] font-bold">{entry.rank}</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-base font-semibold text-foreground">
            {formatTier(entry)}
          </div>
          <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {entry.leaguePoints} LP
          </div>
        </div>
        <div className="text-right">
          <div
            className={cn(
              'font-mono text-base font-semibold tabular-nums',
              wr >= 60 ? 'text-emerald-300' : wr >= 50 ? 'text-foreground' : 'text-red-300',
            )}
          >
            {wr}%
          </div>
          <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {entry.wins}W · {entry.losses}L
          </div>
        </div>
      </div>

      {/* Win-rate bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className={cn(
            'h-full',
            wr >= 60
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-300'
              : wr >= 50
                ? 'bg-gradient-to-r from-emerald-500 to-primary'
                : 'bg-gradient-to-r from-red-500 to-amber-400',
          )}
          style={{ width: `${Math.max(wr, 4)}%` }}
        />
      </div>

      {(entry.hotStreak || entry.veteran || entry.freshBlood || entry.inactive) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.hotStreak && <Badge icon={<Flame size={10} />} tone="primary" label="Hot streak" />}
          {entry.veteran && <Badge label="Veteran" />}
          {entry.freshBlood && <Badge label="Fresh blood" />}
          {entry.inactive && <Badge tone="muted" label="Inactive" />}
        </div>
      )}
    </section>
  )
}

function EmptyRankedPanel({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-card/50 p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </div>
      <div className="mt-3 font-mono text-sm text-muted-foreground">Unranked</div>
      <p className="mt-0.5 text-[11px] text-muted-foreground/80">
        Play placement matches to rank this queue.
      </p>
    </section>
  )
}

function ChampionsPanel({
  champions,
  version,
}: {
  champions: ChampionStats[]
  version: string
}) {
  if (champions.length === 0) return null
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <Target size={12} />
        Champion performance
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {champions.slice(0, 8).map((c) => {
          const wr = winRate(c.wins, c.losses)
          const kda = formatKda(c.kills, c.deaths, c.assists)
          return (
            <li
              key={c.championName}
              className="flex items-center gap-2.5 rounded-md bg-background/30 px-2 py-1.5"
            >
              <img
                src={ddragonChampionSquare(version, c.championName)}
                alt={c.championName}
                className="h-8 w-8 shrink-0 rounded-md border border-border object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-foreground">
                  {c.championName}
                </div>
                <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {kda} KDA
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div
                  className={cn(
                    'font-mono text-[12px] font-semibold tabular-nums',
                    wr >= 60 ? 'text-emerald-300' : wr >= 50 ? 'text-foreground' : 'text-red-300',
                  )}
                >
                  {wr}%
                </div>
                <div className="font-mono text-[9px] tabular-nums text-muted-foreground">
                  {c.games}G
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function RolesPanel({ roles }: { roles: RoleStats[] }) {
  if (roles.length === 0) return null
  const totalGames = roles.reduce((sum, r) => sum + r.games, 0)

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <Shield size={12} />
        Role performance
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {roles.map((r) => {
          const wr = r.games > 0 ? Math.round((r.wins / r.games) * 100) : 0
          const shareWidth = totalGames > 0 ? (r.games / totalGames) * 100 : 0
          return (
            <li key={r.role}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                  {ROLE_LABELS[r.role] ?? r.role}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {r.games}G ·{' '}
                  <span
                    className={cn(
                      wr >= 60 ? 'text-emerald-300' : wr >= 50 ? 'text-foreground' : 'text-red-300',
                    )}
                  >
                    {wr}%
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className="h-full bg-primary/80"
                  style={{ width: `${Math.max(shareWidth, 3)}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// -------- Badges & Match Row --------

function Badge({
  label,
  icon,
  tone = 'default',
}: {
  label: string
  icon?: React.ReactNode
  tone?: 'default' | 'primary' | 'muted'
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-primary/10 text-primary ring-primary/25'
      : tone === 'muted'
        ? 'bg-white/[0.03] text-muted-foreground ring-white/5'
        : 'bg-white/[0.05] text-foreground/80 ring-white/10'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1',
        toneClass,
      )}
    >
      {icon}
      {label}
    </span>
  )
}

function MatchRow({
  match,
  self,
  version,
  ownIdentity,
  onSelectPlayer,
}: {
  match: RiotMatch
  self: RiotMatchParticipant
  version: string
  ownIdentity?: { gameName: string; tagLine: string }
  onSelectPlayer?: (gameName: string, tagLine: string) => void
}) {
  const {
    win,
    championName,
    kills,
    deaths,
    assists,
    totalMinionsKilled,
    neutralMinionsKilled,
    champLevel,
    totalDamageDealtToChampions,
    visionScore,
    summoner1Id,
    summoner2Id,
  } = self

  const cs = totalMinionsKilled + neutralMinionsKilled
  const mins = Math.max(1, Math.floor(match.info.gameDuration / 60))
  const csPerMin = (cs / mins).toFixed(1)
  const kda = formatKda(kills, deaths, assists)
  const endedAt = match.info.gameEndTimestamp ?? match.info.gameCreation
  const items = [self.item0, self.item1, self.item2, self.item3, self.item4, self.item5]
  const trinket = self.item6

  const blue = match.info.participants.filter((p) => p.teamId === 100)
  const red = match.info.participants.filter((p) => p.teamId === 200)

  return (
    <li
      className={cn(
        'rounded-lg border px-3 py-2.5 transition-colors',
        win
          ? 'border-emerald-500/20 bg-emerald-500/[0.05] hover:bg-emerald-500/[0.08]'
          : 'border-red-500/20 bg-red-500/[0.05] hover:bg-red-500/[0.08]',
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        {/* Left status stripe + result label */}
        <div className="flex items-center gap-3">
          <span className={cn('h-14 w-1 rounded-full', win ? 'bg-emerald-400' : 'bg-red-400')} />
          <div className="w-[82px]">
            <div
              className={cn(
                'font-mono text-[11px] font-bold uppercase tracking-wide',
                win ? 'text-emerald-300' : 'text-red-300',
              )}
            >
              {win ? 'Victory' : 'Defeat'}
            </div>
            <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {queueName(match.info.queueId)}
            </div>
            <div className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
              {mins}m
            </div>
            <div className="font-mono text-[10px] tabular-nums text-muted-foreground/80">
              {relativeTime(endedAt)}
            </div>
          </div>
        </div>

        {/* Middle: champ + spells + items + stats */}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="relative shrink-0">
            <img
              src={ddragonChampionSquare(version, championName)}
              alt={championName}
              className="h-12 w-12 rounded-md border border-border object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
              }}
            />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-background px-1 font-mono text-[9px] font-bold tabular-nums text-foreground ring-1 ring-border">
              {champLevel}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <SpellIcon id={summoner1Id} />
            <SpellIcon id={summoner2Id} />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              {items.slice(0, 3).map((id, i) => (
                <ItemIcon key={i} id={id} version={version} />
              ))}
            </div>
            <div className="flex gap-1">
              {items.slice(3, 6).map((id, i) => (
                <ItemIcon key={i} id={id} version={version} />
              ))}
              <ItemIcon id={trinket} version={version} trinket />
            </div>
          </div>

          <div className="ml-auto min-w-[8.5rem] text-right">
            <div className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {kills} / <span className="text-red-300">{deaths}</span> / {assists}
            </div>
            <div
              className={cn(
                'mt-0.5 font-mono text-[10.5px] font-semibold tabular-nums',
                deaths === 0
                  ? 'text-amber-300'
                  : (kills + assists) / deaths >= 3
                    ? 'text-emerald-300'
                    : (kills + assists) / deaths >= 2
                      ? 'text-foreground'
                      : 'text-muted-foreground',
              )}
            >
              {kda} KDA
            </div>
            <div className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
              {cs} CS ({csPerMin}/m)
            </div>
            <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {Math.round(totalDamageDealtToChampions / 1000)}k dmg · {visionScore} vis
            </div>
          </div>
        </div>

        {/* Right: team comp */}
        <div className="hidden shrink-0 gap-3 md:flex">
          <TeamComp
            participants={blue}
            version={version}
            selfPuuid={self.puuid}
            ownIdentity={ownIdentity}
            onSelectPlayer={onSelectPlayer}
          />
          <TeamComp
            participants={red}
            version={version}
            selfPuuid={self.puuid}
            ownIdentity={ownIdentity}
            onSelectPlayer={onSelectPlayer}
          />
        </div>
      </div>
    </li>
  )
}

function SpellIcon({ id }: { id: number }) {
  const src = communityDragonSummonerSpell(id)
  return (
    <div className="h-[22px] w-[22px] overflow-hidden rounded border border-border bg-background/40">
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
          }}
        />
      ) : null}
    </div>
  )
}

function ItemIcon({
  id,
  version,
  trinket = false,
}: {
  id: number
  version: string
  trinket?: boolean
}) {
  const src = ddragonItem(version, id)
  return (
    <div
      className={cn(
        'h-[22px] w-[22px] overflow-hidden rounded border bg-background/40',
        trinket ? 'border-primary/25' : 'border-border',
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
          }}
        />
      ) : null}
    </div>
  )
}

function TeamComp({
  participants,
  version,
  selfPuuid,
  ownIdentity,
  onSelectPlayer,
}: {
  participants: RiotMatchParticipant[]
  version: string
  selfPuuid: string
  ownIdentity?: { gameName: string; tagLine: string }
  onSelectPlayer?: (gameName: string, tagLine: string) => void
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {participants.slice(0, 5).map((p) => {
        const isSelf = p.puuid === selfPuuid
        const name = p.riotIdGameName || p.summonerName || '—'
        const gameName = p.riotIdGameName?.trim() ?? ''
        const tagLine = p.riotIdTagline?.trim() ?? ''
        // Only link if we have a Riot ID AND it's not already the profile we're viewing.
        const viewingOwn =
          ownIdentity &&
          gameName.toLowerCase() === ownIdentity.gameName.toLowerCase() &&
          tagLine.toLowerCase() === ownIdentity.tagLine.replace(/^#/, '').toLowerCase()
        const canNavigate = Boolean(onSelectPlayer && gameName && tagLine && !viewingOwn)
        return (
          <li key={p.puuid}>
            <button
              type="button"
              disabled={!canNavigate}
              onClick={() => {
                if (canNavigate) onSelectPlayer?.(gameName, tagLine)
              }}
              title={
                canNavigate
                  ? `View ${gameName}#${tagLine}'s profile`
                  : viewingOwn
                    ? 'This is you'
                    : 'Riot ID unavailable'
              }
              className={cn(
                'flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left transition-colors',
                isSelf ? 'font-semibold text-foreground' : 'text-muted-foreground',
                canNavigate
                  ? 'cursor-pointer hover:bg-white/[0.05] hover:text-foreground'
                  : 'cursor-default',
              )}
            >
              <img
                src={ddragonChampionSquare(version, p.championName)}
                alt={p.championName}
                className="h-4 w-4 rounded-sm border border-border object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                }}
              />
              <span className="max-w-[7rem] truncate text-[10px]">{name}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
