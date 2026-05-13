import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL ?? "file:./data/crux.db";

const sqlite = createClient({
  url: DATABASE_URL,
});

export const db = drizzle(sqlite, { schema });
export default db;
