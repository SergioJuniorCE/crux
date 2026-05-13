import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

import { summonerRoutes } from "./routes/summoner";
import { statsRoutes } from "./routes/stats";
import { cleanExpiredCache } from "./services/riotApi";
import { migrate } from "./db/migrate";
import { startScheduler } from "./services/scheduler";

const PORT = Number(process.env.PORT) || 3001;

// Run database migration before starting the server
await migrate();

const app = new Elysia()
  .use(
    cors({
      origin: true,
      methods: ["GET", "POST", "OPTIONS"],
    }),
  )
  .use(summonerRoutes)
  .use(statsRoutes)
  .onStart(() => {
    console.log(`🔄 Crux backend running on http://localhost:${PORT}`);

    // Clean expired cache entries every 10 minutes
    setInterval(() => {
      cleanExpiredCache().catch((err) =>
        console.error("Cache cleanup error:", err),
      );
    }, 10 * 60 * 1000);

    // Start cron scheduler (reads cron.enabled from scraper.config.json)
    startScheduler();
  })
  .listen(PORT);

export type App = typeof app;
