import { useEffect, useState } from "react";

/**
 * Reports whether the Crux backend has a `RIOT_API_KEY` configured
 * and is reachable. Polls the backend's health endpoint.
 */
export function useRiotEnvStatus(backendUrl: string) {
  const [hasEnvKey, setHasEnvKey] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!backendUrl) {
      setHasEnvKey(false);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    const baseUrl = backendUrl.replace(/\/+$/, "");

    const check = async () => {
      try {
        const response = await fetch(`${baseUrl}/api/health`, {
          signal: AbortSignal.timeout(5_000),
        });
        const result = (await response.json()) as {
          status: string;
          hasApiKey: boolean;
        };
        if (!cancelled) {
          setHasEnvKey(result.hasApiKey);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setHasEnvKey(false);
          setLoaded(true);
        }
      }
    };

    void check();

    // Re-check every 30 seconds
    const interval = setInterval(check, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [backendUrl]);

  return { hasEnvKey, loaded };
}
