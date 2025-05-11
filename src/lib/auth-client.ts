import { createAuthClient } from "better-auth/react";
import { admin } from "better-auth/plugins";

import { env } from "@/env/client";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_API_URL,
  plugins: [
    admin(),
  ],
});

