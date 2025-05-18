import { createAuthClient } from "better-auth/react";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";

import { env } from "@/env/client";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_API_URL,
  plugins: [
    inferAdditionalFields({
      user: {
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
      session: {

          impersonatedBy: {
            type: "string",
            required: false,
            defaultValue: "",
            input: false,
          }
        },
    }),
    adminClient()
  ],
});

