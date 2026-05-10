import { motion } from 'motion/react'

import type { RiotMatch, RiotMatchParticipant } from '../../types/riot'
import {
  communityDragonSummonerSpell,
  ddragonChampionSquare,
  ddragonItem,
  queueName,
} from '@/lib/leagueAssets'
import { cn } from '@/lib/utils'
import { EASE_OUT_EXPO, listItem } from './motion'
import { formatKda, relativeTime } from './utils'

export function MatchRow({
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
    <motion.li
      variants={listItem}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
      className={cn(
        'rounded-lg border px-2.5 py-2 transition-colors',
        win
          ? 'border-emerald-500/20 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07] hover:shadow-[0_4px_24px_-6px_rgba(16,185,129,0.18)]'
          : 'border-red-500/20 bg-red-500/[0.04] hover:bg-red-500/[0.07] hover:shadow-[0_4px_24px_-6px_rgba(239,68,68,0.18)]',
      )}
    >
      {/*
       * Single flat grid keeps everything on one horizontal line so the row
       * has a consistent height and `items-center` reliably centers every
       * column. No nested flex-wrap means the stats block can't be pushed
       * below champion/spells/items on narrower widths.
       */}
      <div className="grid grid-cols-[auto_auto_auto_auto_minmax(0,1fr)_auto] items-center gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className={cn('h-11 w-0.5 rounded-full', win ? 'bg-emerald-400' : 'bg-red-400')} />
          <div className="w-[78px]">
            <div
              className={cn(
                'font-mono text-[11px] font-bold uppercase leading-tight tracking-wide',
                win ? 'text-emerald-300' : 'text-red-300',
              )}
            >
              {win ? 'Victory' : 'Defeat'}
            </div>
            <div className="mt-0.5 truncate font-mono text-[9.5px] uppercase leading-tight tracking-wide text-muted-foreground">
              {queueName(match.info.queueId)}
            </div>
            <div className="mt-0.5 font-mono text-[9.5px] leading-tight tabular-nums text-muted-foreground/80">
              {mins}m · {relativeTime(endedAt)}
            </div>
          </div>
        </div>

        <div className="relative shrink-0">
          <img
            src={ddragonChampionSquare(version, championName)}
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

        <div className="min-w-0 text-right">
          <div className="font-mono text-[13px] font-semibold leading-tight tabular-nums text-foreground">
            {kills} / <span className="text-red-300">{deaths}</span> / {assists}
          </div>
          <div
            className={cn(
              'mt-0.5 font-mono text-[10px] font-semibold leading-tight tabular-nums',
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
          <div className="mt-0.5 font-mono text-[9.5px] leading-tight tabular-nums text-muted-foreground">
            {cs} CS ({csPerMin}/m) · {Math.round(totalDamageDealtToChampions / 1000)}k · {visionScore}vis
          </div>
        </div>

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
    </motion.li>
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
    <ul className="flex w-[8.5rem] flex-col gap-0.5">
      {participants.slice(0, 5).map((p) => {
        const isSelf = p.puuid === selfPuuid
        const name = p.riotIdGameName || p.summonerName || '—'
        const gameName = p.riotIdGameName?.trim() ?? ''
        const tagLine = p.riotIdTagline?.trim() ?? ''
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
              <span className="min-w-0 flex-1 truncate text-[10px]">{name}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
