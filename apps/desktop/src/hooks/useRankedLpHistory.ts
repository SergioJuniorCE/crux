import { useEffect, useMemo, useState } from 'react'

import type { RiotLeagueEntry, RiotProfileBundle } from '../types/riot'

const STORAGE_KEY = 'crux:rankedLpHistory:v1'
const MAX_SNAPSHOTS_PER_QUEUE = 120

export type RankedLpSnapshot = {
  puuid: string
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
  timestamp: number
}

export function useRankedLpHistory(data: RiotProfileBundle | null) {
  const [snapshots, setSnapshots] = useState<RankedLpSnapshot[]>(() => readSnapshots())

  useEffect(() => {
    if (!data) return

    const nextSnapshots = recordCurrentRankedSnapshots(readSnapshots(), data)
    setSnapshots(nextSnapshots)
    writeSnapshots(nextSnapshots)
  }, [data])

  return useMemo(() => {
    if (!data) return []

    return snapshots.filter((snapshot) => snapshot.puuid === data.account.puuid)
  }, [data, snapshots])
}

function recordCurrentRankedSnapshots(
  snapshots: RankedLpSnapshot[],
  data: RiotProfileBundle,
) {
  const now = Date.now()
  const currentSnapshots = data.league
    .filter((entry) => isTrackedQueue(entry.queueType))
    .map((entry) => toSnapshot(data.account.puuid, entry, now))

  const merged = [...snapshots]

  for (const current of currentSnapshots) {
    const latestIndex = findLatestSnapshotIndex(merged, current.puuid, current.queueType)
    const latest = latestIndex === -1 ? null : merged[latestIndex]

    if (!latest || !sameRankState(latest, current)) {
      merged.push(current)
    }
  }

  return pruneSnapshots(merged)
}

function toSnapshot(puuid: string, entry: RiotLeagueEntry, timestamp: number): RankedLpSnapshot {
  return {
    puuid,
    queueType: entry.queueType,
    tier: entry.tier,
    rank: entry.rank,
    leaguePoints: entry.leaguePoints,
    wins: entry.wins,
    losses: entry.losses,
    timestamp,
  }
}

function readSnapshots(): RankedLpSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as RankedLpSnapshot[]
    if (!Array.isArray(parsed)) return []

    return parsed.filter(isRankedLpSnapshot)
  } catch {
    return []
  }
}

function writeSnapshots(snapshots: RankedLpSnapshot[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots))
}

function findLatestSnapshotIndex(snapshots: RankedLpSnapshot[], puuid: string, queueType: string) {
  let latestIndex = -1
  let latestTimestamp = 0

  snapshots.forEach((snapshot, index) => {
    if (snapshot.puuid !== puuid || snapshot.queueType !== queueType) return
    if (snapshot.timestamp >= latestTimestamp) {
      latestIndex = index
      latestTimestamp = snapshot.timestamp
    }
  })

  return latestIndex
}

function pruneSnapshots(snapshots: RankedLpSnapshot[]) {
  const grouped = new Map<string, RankedLpSnapshot[]>()

  for (const snapshot of snapshots) {
    const key = `${snapshot.puuid}:${snapshot.queueType}`
    grouped.set(key, [...(grouped.get(key) ?? []), snapshot])
  }

  return Array.from(grouped.values())
    .flatMap((group) =>
      group
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-MAX_SNAPSHOTS_PER_QUEUE),
    )
    .sort((a, b) => a.timestamp - b.timestamp)
}

function sameRankState(a: RankedLpSnapshot, b: RankedLpSnapshot) {
  return (
    a.tier === b.tier &&
    a.rank === b.rank &&
    a.leaguePoints === b.leaguePoints &&
    a.wins === b.wins &&
    a.losses === b.losses
  )
}

function isTrackedQueue(queueType: string) {
  return queueType === 'RANKED_SOLO_5x5' || queueType === 'RANKED_FLEX_SR'
}

function isRankedLpSnapshot(value: unknown): value is RankedLpSnapshot {
  if (!value || typeof value !== 'object') return false

  const snapshot = value as RankedLpSnapshot
  return (
    typeof snapshot.puuid === 'string' &&
    typeof snapshot.queueType === 'string' &&
    typeof snapshot.tier === 'string' &&
    typeof snapshot.rank === 'string' &&
    typeof snapshot.leaguePoints === 'number' &&
    typeof snapshot.wins === 'number' &&
    typeof snapshot.losses === 'number' &&
    typeof snapshot.timestamp === 'number'
  )
}
