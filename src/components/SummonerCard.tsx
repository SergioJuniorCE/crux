import { AlertCircle, RefreshCw, Shield, Sword, Trophy, UserCircle2 } from 'lucide-react'

import type {
  RiotLeagueEntry,
  RiotMatch,
  RiotMatchParticipant,
  RiotProfileBundle,
} from '../types/riot'
import { cn } from '@/lib/utils'

type Props = {
  status: 'idle' | 'loading' | 'success' | 'error'
  data: RiotProfileBundle | null
  error: string | null
  onRefresh: () => void
  onGoToSettings: () => void
  configured: boolean
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
      return 'Solo/Duo'
    case 'RANKED_FLEX_SR':
      return 'Flex'
    case 'RANKED_FLEX_TT':
      return 'Flex 3v3'
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

function findSelf(match: RiotMatch, puuid: string): RiotMatchParticipant | null {
  return match.info.participants.find((p) => p.puuid === puuid) ?? null
}

function profileIconUrl(version: string, iconId: number) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconId}.png`
}

function championSquareUrl(version: string, championName: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championName}.png`
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-white/[0.06]', className)} />
}

export function SummonerCard({ status, data, error, onRefresh, onGoToSettings, configured }: Props) {
  if (!configured) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card/50 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-primary">
            <UserCircle2 size={18} />
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">Connect your Riot account</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Add your Riot ID, region, and a developer API key in Settings to show your summoner
              profile, rank, and recent matches.
            </p>
            <button
              type="button"
              onClick={onGoToSettings}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open Settings
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (status === 'loading' && !data) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-400">
            <AlertCircle size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-red-300">Could not load summoner</h2>
            <p className="mt-1 break-words text-xs text-red-300/80">{error ?? 'Unknown error'}</p>
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
                onClick={onGoToSettings}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Check settings
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (!data) {
    return null
  }

  const { account, summoner, league, matches, dataDragonVersion } = data
  const soloEntry = league.find((e) => e.queueType === 'RANKED_SOLO_5x5')
  const flexEntry = league.find((e) => e.queueType === 'RANKED_FLEX_SR')

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      {/* Header: identity */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="relative shrink-0">
          <img
            src={profileIconUrl(dataDragonVersion, summoner.profileIconId)}
            alt=""
            className="h-16 w-16 rounded-full border border-border object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
            }}
          />
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-primary-foreground shadow">
            {summoner.summonerLevel}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
              {account.gameName}
            </h1>
            <span className="font-mono text-sm text-muted-foreground">#{account.tagLine}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Level {summoner.summonerLevel} &middot; Last updated {relativeTime(summoner.revisionDate)}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={status === 'loading'}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background/40 text-muted-foreground transition-colors hover:text-foreground hover:border-white/15 disabled:opacity-50"
          title="Refresh summoner data"
          aria-label="Refresh"
        >
          <RefreshCw size={13} className={cn(status === 'loading' && 'animate-spin')} />
        </button>
      </div>

      {/* Ranked tiles */}
      {(soloEntry || flexEntry) && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {soloEntry && <RankedTile entry={soloEntry} icon={<Trophy size={13} />} />}
          {flexEntry && <RankedTile entry={flexEntry} icon={<Shield size={13} />} />}
        </div>
      )}

      {!soloEntry && !flexEntry && (
        <p className="mt-4 text-xs text-muted-foreground">Unranked this season.</p>
      )}

      {/* Recent matches */}
      {matches.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2">
            <Sword size={12} className="text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Recent matches
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {matches.slice(0, 5).map((match) => {
              const self = findSelf(match, account.puuid)
              if (!self) return null
              return (
                <MatchRow
                  key={match.metadata.matchId}
                  match={match}
                  self={self}
                  version={dataDragonVersion}
                />
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

function RankedTile({ entry, icon }: { entry: RiotLeagueEntry; icon: React.ReactNode }) {
  const wr = winRate(entry.wins, entry.losses)
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/30 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <span className="text-primary">{icon}</span>
          {formatQueue(entry.queueType)}
        </div>
        <div className="mt-1 truncate font-mono text-base font-semibold text-foreground">
          {formatTier(entry)}
        </div>
        <div className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
          {entry.leaguePoints} LP
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-sm font-semibold tabular-nums text-foreground">{wr}%</div>
        <div className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
          {entry.wins}W &middot; {entry.losses}L
        </div>
      </div>
    </div>
  )
}

function MatchRow({
  match,
  self,
  version,
}: {
  match: RiotMatch
  self: RiotMatchParticipant
  version: string
}) {
  const { win, championName, kills, deaths, assists, totalMinionsKilled, neutralMinionsKilled } =
    self
  const cs = totalMinionsKilled + neutralMinionsKilled
  const mins = Math.max(1, Math.floor(match.info.gameDuration / 60))
  const csPerMin = (cs / mins).toFixed(1)
  const kda = deaths === 0 ? 'Perfect' : ((kills + assists) / deaths).toFixed(2)

  const endedAt = match.info.gameEndTimestamp ?? match.info.gameCreation
  const duration = `${mins}m`

  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-md border px-3 py-2 transition-colors',
        win
          ? 'border-emerald-500/20 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.06]'
          : 'border-red-500/20 bg-red-500/[0.04] hover:bg-red-500/[0.06]',
      )}
    >
      <span
        className={cn(
          'h-8 w-1 shrink-0 rounded-full',
          win ? 'bg-emerald-400' : 'bg-red-400',
        )}
      />

      <img
        src={championSquareUrl(version, championName)}
        alt={championName}
        className="h-9 w-9 shrink-0 rounded-md border border-border object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
        }}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
          <span className="truncate">{championName}</span>
          <span
            className={cn(
              'rounded px-1 font-mono text-[9px] font-bold uppercase',
              win ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300',
            )}
          >
            {win ? 'Win' : 'Loss'}
          </span>
        </div>
        <div className="mt-0.5 truncate font-mono text-[10.5px] tabular-nums text-muted-foreground">
          {queueName(match.info.queueId)} &middot; {duration} &middot; {relativeTime(endedAt)}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="font-mono text-xs font-semibold tabular-nums text-foreground">
          {kills}/{deaths}/{assists}
        </div>
        <div className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
          {kda} KDA &middot; {cs} CS ({csPerMin})
        </div>
      </div>
    </li>
  )
}
