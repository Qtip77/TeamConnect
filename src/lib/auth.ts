import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink, openAPI, admin } from "better-auth/plugins";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import type { Context } from "hono";
import type { D1Database } from "@cloudflare/workers-types";

import { ORIGINS } from "@/config/constants";

import * as schema from "../server/db/auth-schema.sql";
import type { AppBindings } from "./types";

//let authInstance:  typeof auth | null = null;


// Define a new interface for the auth configuration parameters
interface AuthConfigParams {
  db: D1Database;
  secret: string;
  baseURL: string;
}


// Modify the auth function to accept AuthConfigParams
export const auth = (config: AuthConfigParams) => betterAuth({ user: {
  additionalFields: {
    role: {
      type: "string",
      required: true,
      defaultValue: "driver",
      input: false, // don't allow user to set role
    },
    banned: {
      type: "boolean",
      required: false,
      defaultValue: false,
      input: false,
    },
    bannedReason: {
      type: "string",
      required: false,
      defaultValue: "",
      input: false,
    },
    bannedAt: {
      type: "number",
      required: false,
      defaultValue: 0,
      input: false,
    },
  },
},
session: {
  additionalFields: {
    impersonatedBy: {
      type: "string",
      required: false,
      defaultValue: "",
      input: false,
    }
  },
},
database: drizzleAdapter(
  drizzleD1(config.db), // Use config.db
  {
    provider: "sqlite",
    usePlural: true,
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
    }
  }
),
advanced: {
  defaultCookieAttributes: {
    httpOnly: true,
    sameSite: "lax",
    partitioned: true,
    secure: true,
  },
},
trustedOrigins: ORIGINS,
secret: config.secret, // Use config.secret
baseURL: config.baseURL, // Use config.baseURL
emailAndPassword: {
  enabled: true,
},
plugins: [
  openAPI(),
  magicLink({
    sendMagicLink: async ({ email, url }) => {
      console.log(email, url);
    },
  }),
  admin(),
  nextCookies(),
],
});

export type AuthInstance = ReturnType<typeof auth>;
let authInstance: AuthInstance | null = null;

export function getAuth(c: Context<AppBindings>): AuthInstance {
  if (!authInstance) {
    // Create the config object from context environment variables
    const authConfig: AuthConfigParams = {
      db: c.env.DB,
      secret: c.env.BETTER_AUTH_SECRET,
      baseURL: c.env.BETTER_AUTH_URL,
    };
    authInstance = auth(authConfig); // Pass the config object
  }
  return authInstance;
}
