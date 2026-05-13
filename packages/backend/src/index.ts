import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

import { summonerRoutes } from "./routes/summoner";
import { cleanExpiredCache } from "./services/riotApi";
import { migrate } from "./db/migrate";

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
  .onStart(() => {
    console.log(`🔄 Crux backend running on http://localhost:${PORT}`);

    // Clean expired cache entries every 10 minutes
    setInterval(() => {
      cleanExpiredCache().catch((err) =>
        console.error("Cache cleanup error:", err),
      );
    }, 10 * 60 * 1000);
  })
  .listen(PORT);

export type App = typeof app;
