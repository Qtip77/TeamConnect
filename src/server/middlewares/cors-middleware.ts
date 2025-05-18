import { cors } from "hono/cors";

import { ORIGINS } from "@/config/constants";

export const corsMiddleware = cors({
  origin: ORIGINS,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Cookie", "Authorization"],
  credentials: true,
  maxAge: 86400,
});
