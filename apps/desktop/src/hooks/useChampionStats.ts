/**
 * useChampionStats — fetches global champion item stats from the Crux backend.
 *
 * This replaces the client-side deriveRecommendations() with server-provided
 * aggregated stats computed across all scraped Master+ matches.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChampionStatsResponse, ChampionItemStat } from "../types/riot";
import type { RiotSettings } from "./useRiotSettings";

type Status = "idle" | "loading" | "success" | "error";

type State = {
  status: Status;
  items: ChampionItemStat[];
  patch: string;
  error: string | null;
};

const INITIAL_STATE: State = {
  status: "idle",
  items: [],
  patch: "",
  error: null,
};

/**
 * Fetch champion item stats from the backend.
 *
 * @param settings - Riot settings (backend URL, etc.)
 * @param championId - The champion ID to fetch stats for (0 = no champion selected)
 * @param options - Filtering options
 */
export function useChampionStats(
  settings: RiotSettings,
  championId: number,
  options: {
    order?: number;
    minGames?: number;
    limit?: number;
    refreshKey?: number;
  } = {},
) {
  const { order = 0, minGames = 5, limit = 20, refreshKey = 0 } = options;
  const [state, setState] = useState<State>(INITIAL_STATE);
  const requestIdRef = useRef(0);
  const backendUrl = settings.backendUrl.replace(/\/+$/, "");

  const fetchStats = useCallback(async () => {
    if (!championId) {
      setState(INITIAL_STATE);
      return;
    }

    const reqId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, status: "loading", error: null }));

    try {
      const url = `${backendUrl}/api/stats/items/${championId}?order=${order}&minGames=${minGames}&limit=${limit}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const result = await response.json() as ChampionStatsResponse;

      if (reqId !== requestIdRef.current) return;

      if (result.success) {
        setState({
          status: "success",
          items: result.items ?? [],
          patch: result.patch,
          error: null,
        });
      } else {
        setState({
          status: "error",
          items: [],
          patch: "",
          error: "Failed to load stats",
        });
      }
    } catch (err: unknown) {
      if (reqId !== requestIdRef.current) return;
      setState({
        status: "error",
        items: [],
        patch: "",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [backendUrl, championId, order, minGames, limit]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats, refreshKey]);

  return {
    status: state.status,
    items: state.items,
    patch: state.patch,
    error: state.error,
    refetch: fetchStats,
    /** Whether stats data is available (has at least some items) */
    hasData: state.items.length > 0,
    /** Total games represented in the data */
    totalGames: state.items.reduce((sum, item) => sum + item.gamesPlayed, 0),
  };
}
