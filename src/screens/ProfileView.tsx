import { useMemo } from 'react'
import {
  AlertCircle,
  Flame,
  RefreshCw,
  Shield,
  Sparkles,
  Sword,
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
import { cn } from '@/lib/utils'

type ProfileViewProps = {
  status: 'idle' | 'loading' | 'success' | 'error'
  data: RiotProfileBundle | null
  error: string | null
  configured: boolean
  platform: PlatformRegion
  onRefresh: () => void
  onOpenSettings: () => void
}

function profileIconUrl(version: string, iconId: number) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconId}.png`
}

function championSquareUrl(version: string, championName: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championName}.png`
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

function queueName(queueId: number) {
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
    case 1700:
      return 'Arena'
    default:
      return `Queue ${queueId}`
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

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-white/[0.06]', className)} />
}

type ChampionStats = {
  championName: string
  games: number
  wins: number
  losses: number
  kills: number
  deaths: number
  assists: number
}

function aggregateChampionStats(
  matches: RiotMatch[],
  puuid: string,
): { champions: ChampionStats[]; totals: { wins: number; losses: number; kills: number; deaths: number; assists: number; games: number } } {
  const byChamp = new Map<string, ChampionStats>()
  const totals = { wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0, games: 0 }

  for (const match of matches) {
    const self = findSelf(match, puuid)
    if (!self) continue

    totals.games += 1
    if (self.win) totals.wins += 1
    else totals.losses += 1
    totals.kills += self.kills
    totals.deaths += self.deaths
    totals.assists += self.assists

    const existing = byChamp.get(self.championName) ?? {
      championName: self.championName,
      games: 0,
      wins: 0,
      losses: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
    }
    existing.games += 1
    if (self.win) existing.wins += 1
    else existing.losses += 1
    existing.kills += self.kills
    existing.deaths += self.deaths
    existing.assists += self.assists
    byChamp.set(self.championName, existing)
  }

  const champions = Array.from(byChamp.values()).sort((a, b) => b.games - a.games || b.wins - a.wins)
  return { champions, totals }
}

export function ProfileView({
  status,
  data,
  error,
  configured,
  platform,
  onRefresh,
  onOpenSettings,
}: ProfileViewProps) {
  const stats = useMemo(() => {
    if (!data) return null
    return aggregateChampionStats(data.matches, data.account.puuid)
  }, [data])

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
            Add your Riot ID, region, and a developer API key to see your full profile, ranked
            standings, and recent match history.
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open Settings
          </button>
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
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

  const { account, summoner, league, matches, dataDragonVersion } = data
  const soloEntry = league.find((e) => e.queueType === 'RANKED_SOLO_5x5')
  const flexEntry = league.find((e) => e.queueType === 'RANKED_FLEX_SR')

  const totals = stats?.totals
  const recentKda =
    totals && totals.deaths > 0
      ? ((totals.kills + totals.assists) / totals.deaths).toFixed(2)
      : totals?.deaths === 0 && totals.games > 0
        ? 'Perfect'
        : '—'
  const recentWinRate = totals ? winRate(totals.wins, totals.losses) : 0

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
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
              src={profileIconUrl(dataDragonVersion, summoner.profileIconId)}
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

      {/* Ranked */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
      </div>

      {/* Recent performance summary */}
      {totals && totals.games > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Last {totals.games} games
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Win rate" value={`${recentWinRate}%`} sub={`${totals.wins}W ${totals.losses}L`} />
            <MiniStat
              label="KDA"
              value={recentKda}
              sub={`${(totals.kills / totals.games).toFixed(1)} / ${(totals.deaths / totals.games).toFixed(1)} / ${(totals.assists / totals.games).toFixed(1)}`}
            />
            <MiniStat
              label="Kills / game"
              value={(totals.kills / totals.games).toFixed(1)}
            />
            <MiniStat
              label="Deaths / game"
              value={(totals.deaths / totals.games).toFixed(1)}
            />
          </div>

          {/* Champion aggregates */}
          {stats && stats.champions.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Champions played
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                {stats.champions.slice(0, 6).map((champ) => {
                  const champWr = winRate(champ.wins, champ.losses)
                  const kda =
                    champ.deaths === 0
                      ? 'Perfect'
                      : ((champ.kills + champ.assists) / champ.deaths).toFixed(2)
                  return (
                    <div
                      key={champ.championName}
                      className="flex items-center gap-3 rounded-md border border-border bg-background/30 px-3 py-2"
                    >
                      <img
                        src={championSquareUrl(dataDragonVersion, champ.championName)}
                        alt={champ.championName}
                        className="h-9 w-9 shrink-0 rounded-md border border-border object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {champ.championName}
                        </div>
                        <div className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                          {champ.games} {champ.games === 1 ? 'game' : 'games'} &middot; {kda} KDA
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={cn(
                            'font-mono text-sm font-semibold tabular-nums',
                            champWr >= 60
                              ? 'text-emerald-300'
                              : champWr >= 50
                                ? 'text-foreground'
                                : 'text-red-300',
                          )}
                        >
                          {champWr}%
                        </div>
                        <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
                          {champ.wins}W {champ.losses}L
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Match history */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sword size={13} className="text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Match history
          </span>
          <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'}
          </span>
        </div>

        {matches.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No recent matches found.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {matches.map((match) => {
              const self = findSelf(match, account.puuid)
              if (!self) return null
              return (
                <DetailedMatchRow
                  key={match.metadata.matchId}
                  match={match}
                  self={self}
                  version={dataDragonVersion}
                />
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function PageHeader({ right }: { right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Riot account, ranked standings, and recent matches.
        </p>
      </div>
      {right}
    </div>
  )
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-background/30 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 font-mono text-[10.5px] tabular-nums text-muted-foreground">
          {sub}
        </div>
      )}
    </div>
  )
}

function RankedPanel({ entry, icon }: { entry: RiotLeagueEntry; icon: React.ReactNode }) {
  const wr = winRate(entry.wins, entry.losses)
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {formatQueue(entry.queueType)}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-4">
        <div>
          <div className="font-mono text-2xl font-semibold text-foreground">{formatTier(entry)}</div>
          <div className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
            {entry.leaguePoints} LP
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-semibold tabular-nums text-foreground">{wr}%</div>
          <div className="mt-0.5 font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {entry.wins}W &middot; {entry.losses}L
          </div>
        </div>
      </div>

      {/* Win-rate bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-primary"
          style={{ width: `${wr}%` }}
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
    <section className="rounded-xl border border-dashed border-border bg-card/50 p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </div>
      <div className="mt-3 font-mono text-lg text-muted-foreground">Unranked</div>
      <p className="mt-0.5 text-xs text-muted-foreground/80">
        Play placement matches to get a rank for this queue.
      </p>
    </section>
  )
}

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

function DetailedMatchRow({
  match,
  self,
  version,
}: {
  match: RiotMatch
  self: RiotMatchParticipant
  version: string
}) {
  const { win, championName, kills, deaths, assists, totalMinionsKilled, neutralMinionsKilled, champLevel } =
    self
  const cs = totalMinionsKilled + neutralMinionsKilled
  const mins = Math.max(1, Math.floor(match.info.gameDuration / 60))
  const csPerMin = (cs / mins).toFixed(1)
  const kda = deaths === 0 ? 'Perfect' : ((kills + assists) / deaths).toFixed(2)
  const endedAt = match.info.gameEndTimestamp ?? match.info.gameCreation

  return (
    <li
      className={cn(
        'grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
        win
          ? 'border-emerald-500/20 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07]'
          : 'border-red-500/20 bg-red-500/[0.04] hover:bg-red-500/[0.07]',
      )}
    >
      <span className={cn('h-10 w-1 rounded-full', win ? 'bg-emerald-400' : 'bg-red-400')} />

      <div className="relative shrink-0">
        <img
          src={championSquareUrl(version, championName)}
          alt={championName}
          className="h-11 w-11 rounded-md border border-border object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
          }}
        />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-background px-1 font-mono text-[9px] font-bold tabular-nums text-foreground ring-1 ring-border">
          {champLevel}
        </span>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">{championName}</span>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide',
              win ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300',
            )}
          >
            {win ? 'Victory' : 'Defeat'}
          </span>
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            {queueName(match.info.queueId)}
          </span>
        </div>
        <div className="mt-0.5 truncate font-mono text-[10.5px] tabular-nums text-muted-foreground">
          {mins}m &middot; {relativeTime(endedAt)}
          {self.teamPosition ? ` · ${self.teamPosition.toLowerCase()}` : ''}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="font-mono text-sm font-semibold tabular-nums text-foreground">
          {kills} / <span className="text-red-300">{deaths}</span> / {assists}
        </div>
        <div className="mt-0.5 font-mono text-[10.5px] tabular-nums text-muted-foreground">
          {kda} KDA &middot; {cs} CS ({csPerMin}/min)
        </div>
      </div>
    </li>
  )
}
