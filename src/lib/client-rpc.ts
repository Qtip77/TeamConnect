import { hc } from "hono/client";

import { env } from "@/env/client";
import type { HonoApp } from "@/server";

/**
 * Get the RPC client for client components
 * @returns The client RPC client
 */
export const clientRPC = hc<HonoApp>(env.NEXT_PUBLIC_API_URL, {
  fetch: async (input, reqInit, _env, _executionCtx) => {
    try {
      const response = await fetch(input, {
        ...reqInit,
        credentials: "include", // This is important for the cookies to be sent to the server
      });
      return response;
    } catch (error) {
      console.error('Network error in clientRPC:', error);
      throw error; // Re-throw to be handled by the caller
    }
  },
});
