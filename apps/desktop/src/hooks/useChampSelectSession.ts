import { useCallback, useEffect, useRef, useState } from "react";

import type { LcuChampSelectSession } from "../types/riot";

type ChampSelectStatus = "idle" | "loading" | "active" | "error";

type State = {
  status: ChampSelectStatus;
  data: LcuChampSelectSession | null;
  error: string | null;
  lastFetchedAt: number | null;
};

const INITIAL_STATE: State = {
  status: "idle",
  data: null,
  error: null,
  lastFetchedAt: null,
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isExpectedInactiveError(error: string) {
  return (
    error.includes("LCU 404") ||
    error.includes("League client not detected") ||
    error.includes("LCU request timed out")
  );
}

export function useChampSelectSession(pollMs = 2_000) {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const requestIdRef = useRef(0);

  const refetch = useCallback(async () => {
    const reqId = ++requestIdRef.current;

    setState((prev) => ({
      ...prev,
      status: prev.data ? "active" : "loading",
      error: null,
    }));

    try {
      const result = await window.electronAPI.getChampSelectSessionFromClient();
      if (reqId !== requestIdRef.current) return;

      if (result.success) {
        setState({
          status: "active",
          data: result.data,
          error: null,
          lastFetchedAt: Date.now(),
        });
        return;
      }

      setState({
        status: isExpectedInactiveError(result.error) ? "idle" : "error",
        data: null,
        error: result.error,
        lastFetchedAt: Date.now(),
      });
    } catch (err: unknown) {
      if (reqId !== requestIdRef.current) return;
      const message = getErrorMessage(err);
      setState({
        status: isExpectedInactiveError(message) ? "idle" : "error",
        data: null,
        error: message,
        lastFetchedAt: Date.now(),
      });
    }
  }, []);

  useEffect(() => {
    void refetch();
    const interval = window.setInterval(() => {
      void refetch();
    }, pollMs);

    return () => window.clearInterval(interval);
  }, [pollMs, refetch]);

  return { ...state, refetch };
}
