import type { Config } from "drizzle-kit";

export default {
  schema: "./src/server/db/**.sql.ts",
  out: "./src/server/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "file:.wrangler/state/v3/d1/miniflare-D1DatabaseObject/ab8f43a68a8cb402bc08d606167326241e98d36a688f9ed4f612d3152d8d9699.sqlite",
  },
} satisfies Config;
