import { Elysia, t } from "elysia";
import { getSummonerBundle, hasApiKey } from "../services/riotApi";

export const summonerRoutes = new Elysia({ prefix: "/api" })
  /**
   * Health check — also reports whether the Riot API key is configured.
   */
  .get("/health", () => ({
    status: "ok",
    hasApiKey: hasApiKey(),
    timestamp: Date.now(),
  }))

  /**
   * Get a summoner profile bundle.
   *
   * Path params: platform (e.g. na1, euw1), gameName, tagLine
   * Query params: matchCount (default 5)
   */
  .get(
    "/summoner/:platform/:gameName/:tagLine",
    async ({ params, query }) => {
      const { platform, gameName, tagLine } = params;
      const matchCount = query.matchCount ?? 5;

      if (!gameName || !tagLine) {
        return {
          success: false as const,
          error: "Missing Riot ID (gameName#tagLine).",
          status: 400,
        };
      }

      if (!hasApiKey()) {
        return {
          success: false as const,
          error:
            "Backend is missing a Riot API key. Set RIOT_API_KEY in packages/backend/.env.",
          status: 401,
        };
      }

      try {
        const data = await getSummonerBundle(
          platform as any,
          gameName,
          tagLine,
          matchCount,
        );
        return { success: true as const, data };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const status =
          err && typeof err === "object" && "status" in err
            ? Number((err as { status: unknown }).status)
            : 500;
        return { success: false as const, error: message, status };
      }
    },
    {
      params: t.Object({
        platform: t.String(),
        gameName: t.String(),
        tagLine: t.String(),
      }),
      query: t.Object({
        matchCount: t.Optional(t.Numeric()),
      }),
    },
  );
