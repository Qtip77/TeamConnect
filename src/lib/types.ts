import type { D1Database } from "@cloudflare/workers-types";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { Env } from "hono";

import type { DBSchema } from "@/server/db";
import type { getAuth, AuthInstance } from "./auth";
import type { auth } from "./auth";

// This type will hold the inferred structure from better-auth,
// which includes both 'user' and 'session' properties with all custom fields.
type InferredAuthData = ReturnType<typeof auth>['$Infer']['Session'];

export interface AppBindings extends Env {
  Bindings: {
    DB: D1Database;
    BETTER_AUTH_URL: string;
    FRONTEND_URL: string;
    BETTER_AUTH_SECRET: string;
  };
  Variables: {
    auth: ReturnType<typeof getAuth>; // This is the AuthInstance itself
    db: DrizzleD1Database<DBSchema>;
    // Changed: Use the inferred types for session and user
    session: InferredAuthData['session'] | null;
    user: InferredAuthData['user'] | null;
  };
}

export interface Author {
  name: string;
  avatar: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  date: string;
  excerpt: string;
  content: string;
  coverImage: string;
  readingTime: number;
  author: Author;
}
