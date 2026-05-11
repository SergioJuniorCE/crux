import { useState } from "react";

import { AnimatePresence, motion } from "motion/react";

import type { RiotMatch, RiotMatchParticipant } from "../../types/riot";
import {
  communityDragonSummonerSpell,
  ddragonChampionSquare,
  ddragonItem,
  ddragonRuneIcon,
  ddragonRuneStyleIcon,
  queueName,
  ROLE_LABELS,
  runeName,
  runeStyleName,
} from "@/lib/leagueAssets";
import { cn } from "@/lib/utils";
import { EASE_OUT_EXPO, listItem } from "./motion";
import { formatKda, relativeTime } from "./utils";

export function MatchRow({
  match,
  self,
  version,
  ownIdentity,
  onSelectPlayer,
}: {
  match: RiotMatch;
  self: RiotMatchParticipant;
  version: string;
  ownIdentity?: { gameName: string; tagLine: string };
  onSelectPlayer?: (gameName: string, tagLine: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

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
  } = self;

  const cs = totalMinionsKilled + neutralMinionsKilled;
  const mins = Math.max(1, Math.floor(match.info.gameDuration / 60));
  const csPerMin = (cs / mins).toFixed(1);
  const kda = formatKda(kills, deaths, assists);
  const endedAt = match.info.gameEndTimestamp ?? match.info.gameCreation;
  const items = [
    self.item0,
    self.item1,
    self.item2,
    self.item3,
    self.item4,
    self.item5,
  ];
  const trinket = self.item6;

  const blue = match.info.participants.filter((p) => p.teamId === 100);
  const red = match.info.participants.filter((p) => p.teamId === 200);
  const maxDmg = Math.max(
    ...match.info.participants.map((p) => p.totalDamageDealtToChampions),
    1,
  );

  return (
    <motion.li
      variants={listItem}
      transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
      className={cn(
        "rounded-lg border transition-colors",
        win
          ? "border-emerald-500/20 bg-emerald-500/4"
          : "border-red-500/20 bg-red-500/4",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
          expanded && "rounded-b-none",
          win
            ? "hover:bg-emerald-500/[0.07] hover:shadow-[0_4px_24px_-6px_rgba(16,185,129,0.18)]"
            : "hover:bg-red-500/[0.07] hover:shadow-[0_4px_24px_-6px_rgba(239,68,68,0.18)]",
        )}
      >
        {/*
         * Single flat grid keeps everything on one horizontal line so the row
         * has a consistent height and `items-center` reliably centers every
         * column. No nested flex-wrap means the stats block can't be pushed
         * below champion/spells/items on narrower widths.
         */}
        <div className="grid grid-cols-[auto_auto_auto_auto_minmax(7.25rem,1fr)_auto] flex-1 items-center gap-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "h-11 w-0.5 shrink-0 rounded-full",
                win ? "bg-emerald-400" : "bg-red-400",
              )}
            />
            <div className="w-[78px]">
              <div
                className={cn(
                  "font-mono text-[11px] font-bold uppercase leading-tight tracking-wide",
                  win ? "text-emerald-300" : "text-red-300",
                )}
              >
                {win ? "Victory" : "Defeat"}
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
                (e.currentTarget as HTMLImageElement).style.visibility =
                  "hidden";
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

          <div className="min-w-[7.25rem] text-right">
            <div className="whitespace-nowrap font-mono text-[13px] font-semibold leading-tight tabular-nums text-foreground">
              {kills} / <span className="text-red-300">{deaths}</span> /{" "}
              {assists}
            </div>
            <div
              className={cn(
                "mt-0.5 font-mono text-[10px] font-semibold leading-tight tabular-nums",
                deaths === 0
                  ? "text-amber-300"
                  : (kills + assists) / deaths >= 3
                    ? "text-emerald-300"
                    : (kills + assists) / deaths >= 2
                      ? "text-foreground"
                      : "text-muted-foreground",
              )}
            >
              {kda} KDA
            </div>
            <div className="mt-0.5 whitespace-nowrap font-mono text-[9.5px] leading-tight tabular-nums text-muted-foreground">
              {cs} CS ({csPerMin}/m) ·{" "}
              {Math.round(totalDamageDealtToChampions / 1000)}k · {visionScore}
              vis
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
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "border-t px-3 pb-3 pt-2.5",
                win ? "border-emerald-500/10" : "border-red-500/10",
              )}
            >
              <ExpandedMatchDetails
                blue={blue}
                red={red}
                version={version}
                maxDmg={maxDmg}
                gameDuration={match.info.gameDuration}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function ExpandedMatchDetails({
  blue,
  red,
  version,
  maxDmg,
  gameDuration,
}: {
  blue: RiotMatchParticipant[];
  red: RiotMatchParticipant[];
  version: string;
  maxDmg: number;
  gameDuration: number;
}) {
  const mins = Math.max(1, Math.floor(gameDuration / 60));

  const totalTeamKills = (team: RiotMatchParticipant[]) =>
    team.reduce((sum, p) => sum + p.kills, 0);

  const totalTeamDmg = (team: RiotMatchParticipant[]) =>
    team.reduce((sum, p) => sum + p.totalDamageDealtToChampions, 0);

  const totalTeamGold = (team: RiotMatchParticipant[]) =>
    team.reduce((sum, p) => sum + p.goldEarned, 0);

  const blueKills = totalTeamKills(blue);
  const redKills = totalTeamKills(red);
  const blueDmg = totalTeamDmg(blue);
  const redDmg = totalTeamDmg(red);
  const blueGold = totalTeamGold(blue);
  const redGold = totalTeamGold(red);

  return (
    <div>
      {/* Quick team stat comparison */}
      <div className="mb-2.5 grid grid-cols-2 gap-4">
        <div className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.03] px-2.5 py-1.5">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-300">
              Blue Team
            </span>
            <span className="font-mono text-[11px] tabular-nums text-foreground">
              {blueKills} / {redKills} Kills
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 font-mono text-[9.5px] tabular-nums text-muted-foreground">
            <span>{(blueDmg / 1000).toFixed(1)}k Dmg</span>
            <span>{(blueGold / 1000).toFixed(1)}k Gold</span>
          </div>
        </div>
        <div className="rounded-md border border-red-500/15 bg-red-500/[0.03] px-2.5 py-1.5">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-red-300">
              Red Team
            </span>
            <span className="font-mono text-[11px] tabular-nums text-foreground">
              {redKills} / {blueKills} Kills
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 font-mono text-[9.5px] tabular-nums text-muted-foreground">
            <span>{(redDmg / 1000).toFixed(1)}k Dmg</span>
            <span>{(redGold / 1000).toFixed(1)}k Gold</span>
          </div>
        </div>
      </div>

      {/* Per-player stats table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-1 py-1 text-left">Player</th>
              <th className="px-1.5 py-1 text-left">Loadout</th>
              <th className="px-1.5 py-1 text-left">Build</th>
              <th className="px-1.5 py-1 text-right">K/D/A</th>
              <th className="px-1.5 py-1 text-right">CS</th>
              <th className="px-1.5 py-1 text-right">Gold</th>
              <th className="w-[110px] px-1.5 py-1 text-right">Damage</th>
              <th className="px-1.5 py-1 text-right">Vision</th>
            </tr>
          </thead>
          <tbody>
            {renderTeamRows(blue, version, mins, maxDmg, "emerald")}
            <tr className="border-b border-t border-border/30">
              <td colSpan={8} className="px-1 py-1" />
            </tr>
            {renderTeamRows(red, version, mins, maxDmg, "red")}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderTeamRows(
  participants: RiotMatchParticipant[],
  version: string,
  mins: number,
  maxDmg: number,
  teamColor: "emerald" | "red",
) {
  return participants.map((p) => {
    const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
    const csPerMin = (cs / mins).toFixed(1);
    const ratio =
      p.deaths === 0
        ? "Perfect"
        : ((p.kills + p.assists) / p.deaths).toFixed(2);

    const dmgPct =
      maxDmg > 0 ? (p.totalDamageDealtToChampions / maxDmg) * 100 : 0;
    const primaryRuneStyle =
      p.perks?.styles.find((style) => style.description === "primaryStyle") ??
      p.perks?.styles[0];
    const secondaryRuneStyle =
      p.perks?.styles.find((style) => style.description === "subStyle") ??
      p.perks?.styles[1];
    const keystoneId = primaryRuneStyle?.selections[0]?.perk;
    const items = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5];

    return (
      <tr
        key={p.puuid}
        className="group border-b border-border/10 font-mono text-[11px] tabular-nums transition-colors hover:bg-white/[0.02]"
      >
        <td className="max-w-[160px] px-1 py-1 text-left text-[11px] text-foreground">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={ddragonChampionSquare(version, p.championName)}
              alt={p.championName}
              title={p.championName}
              className="h-6 w-6 shrink-0 rounded border border-border object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility =
                  "hidden";
              }}
            />
            <div className="min-w-0">
              <span className="block truncate">
                {p.riotIdGameName || p.summonerName || "—"}
              </span>
              <span className="text-[9px] text-muted-foreground">
                {ROLE_LABELS[p.teamPosition ?? ""] ?? p.teamPosition ?? ""}
              </span>
            </div>
          </div>
        </td>
        <td className="px-1.5 py-1">
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <SpellIcon id={p.summoner1Id} className="h-5 w-5" />
              <SpellIcon id={p.summoner2Id} className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <RuneIcon id={keystoneId} />
              <RuneStyleIcon id={secondaryRuneStyle?.style} />
            </div>
          </div>
        </td>
        <td className="min-w-[11.25rem] px-1.5 py-1">
          <div className="flex items-center gap-1">
            {items.map((id, i) => (
              <ItemIcon key={i} id={id} version={version} className="h-5 w-5" />
            ))}
            <ItemIcon
              id={p.item6}
              version={version}
              trinket
              className="h-5 w-5"
            />
          </div>
        </td>
        <td className="px-1.5 py-1 text-right font-semibold text-foreground">
          {p.kills}/{<span className="text-red-300">{p.deaths}</span>}/
          {p.assists}
          <span
            className={cn(
              "ml-1.5 text-[9px] font-medium",
              p.deaths === 0
                ? "text-amber-300"
                : (p.kills + p.assists) / p.deaths >= 3
                  ? "text-emerald-300"
                  : (p.kills + p.assists) / p.deaths >= 2
                    ? "text-foreground"
                    : "text-muted-foreground",
            )}
          >
            {ratio} KDA
          </span>
        </td>
        <td className="px-1.5 py-1 text-right text-muted-foreground">
          {cs}
          <span className="ml-1 text-[9px]">({csPerMin})</span>
        </td>
        <td className="px-1.5 py-1 text-right text-muted-foreground">
          {(p.goldEarned / 1000).toFixed(1)}k
        </td>
        <td className="px-1.5 py-1">
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-[10px] text-muted-foreground">
              {(p.totalDamageDealtToChampions / 1000).toFixed(1)}k
            </span>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  teamColor === "emerald" ? "bg-emerald-400" : "bg-red-400",
                )}
                style={{ width: `${dmgPct}%` }}
              />
            </div>
          </div>
        </td>
        <td className="px-1.5 py-1 text-right text-muted-foreground">
          {p.visionScore}
          <span className="ml-1 text-[9px]">
            ({p.wardsPlaced}/{p.wardsKilled})
          </span>
        </td>
      </tr>
    );
  });
}

function SpellIcon({ id, className }: { id: number; className?: string }) {
  const src = communityDragonSummonerSpell(id);
  return (
    <div
      className={cn(
        "h-[22px] w-[22px] overflow-hidden rounded border border-border bg-background/40",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
      ) : null}
    </div>
  );
}

function RuneIcon({ id }: { id?: number }) {
  const src = ddragonRuneIcon(id);
  return (
    <div
      title={runeName(id) ?? "Keystone unavailable"}
      className="h-7 w-7 overflow-hidden rounded-full border border-border bg-background/40"
    >
      {src ? (
        <img
          src={src}
          alt={runeName(id) ?? "Keystone"}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
      ) : null}
    </div>
  );
}

function RuneStyleIcon({ id }: { id?: number }) {
  const src = ddragonRuneStyleIcon(id);
  return (
    <div
      title={runeStyleName(id) ?? "Secondary rune tree unavailable"}
      className="h-5 w-5 overflow-hidden rounded-full border border-border bg-background/40 p-0.5"
    >
      {src ? (
        <img
          src={src}
          alt={runeStyleName(id) ?? "Secondary rune tree"}
          className="h-full w-full object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
      ) : null}
    </div>
  );
}

function ItemIcon({
  id,
  version,
  trinket = false,
  className,
}: {
  id: number;
  version: string;
  trinket?: boolean;
  className?: string;
}) {
  const src = ddragonItem(version, id);
  return (
    <div
      className={cn(
        "h-[22px] w-[22px] overflow-hidden rounded border bg-background/40",
        trinket ? "border-primary/25" : "border-border",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
      ) : null}
    </div>
  );
}

function TeamComp({
  participants,
  version,
  selfPuuid,
  ownIdentity,
  onSelectPlayer,
}: {
  participants: RiotMatchParticipant[];
  version: string;
  selfPuuid: string;
  ownIdentity?: { gameName: string; tagLine: string };
  onSelectPlayer?: (gameName: string, tagLine: string) => void;
}) {
  return (
    <ul className="flex w-[8.5rem] flex-col gap-0.5">
      {participants.slice(0, 5).map((p) => {
        const isSelf = p.puuid === selfPuuid;
        const name = p.riotIdGameName || p.summonerName || "—";
        const gameName = p.riotIdGameName?.trim() ?? "";
        const tagLine = p.riotIdTagline?.trim() ?? "";
        const viewingOwn =
          ownIdentity &&
          gameName.toLowerCase() === ownIdentity.gameName.toLowerCase() &&
          tagLine.toLowerCase() ===
            ownIdentity.tagLine.replace(/^#/, "").toLowerCase();
        const canNavigate = Boolean(
          onSelectPlayer && gameName && tagLine && !viewingOwn,
        );
        return (
          <li key={p.puuid}>
            <button
              type="button"
              disabled={!canNavigate}
              onClick={() => {
                if (canNavigate) onSelectPlayer?.(gameName, tagLine);
              }}
              title={
                canNavigate
                  ? `View ${gameName}#${tagLine}'s profile`
                  : viewingOwn
                    ? "This is you"
                    : "Riot ID unavailable"
              }
              className={cn(
                "flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left transition-colors",
                isSelf
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
                canNavigate
                  ? "cursor-pointer hover:bg-white/[0.05] hover:text-foreground"
                  : "cursor-default",
              )}
            >
              <img
                src={ddragonChampionSquare(version, p.championName)}
                alt={p.championName}
                className="h-4 w-4 rounded-sm border border-border object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.visibility =
                    "hidden";
                }}
              />
              <span className="min-w-0 flex-1 truncate text-[10px]">
                {name}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
