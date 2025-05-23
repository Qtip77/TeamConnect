"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { authClient } from "./auth-client";

/**
 * Gets the current user session from the API
 * @returns The current user session or null if not authenticated
 */
export const getCurrentUser = cache(async () => {
  try {
    const response = await authClient.getSession({
      fetchOptions: {
        headers: await headers(),
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
});

/**
 * Checks if the user is authenticated and redirects to login if not
 * @param redirectTo The path to redirect to after login
 */
export async function requireAuth(redirectTo = "/login") {
  const currentSession = await getCurrentUser();

  if (!currentSession || !currentSession.user || !currentSession.session) {
    redirect(redirectTo);
  }

  return currentSession;
}

/**
 * Checks if the user is authenticated and has admin role
 * @param redirectTo The path to redirect to if not admin
 */
export async function requireAdmin(redirectTo = "/") {
  const currentSession = await requireAuth("/login");

  if (currentSession?.user?.role !== "admin") {
    redirect(redirectTo);
  }

  return currentSession;
}

/**
 * Checks if the user is authenticated and has driver role
 * @param redirectTo The path to redirect to if not driver
 */
export async function requireDriver(redirectTo = "/") {
  const currentSession = await requireAuth("/login");

  if (currentSession?.user?.role !== "driver") {
    redirect(redirectTo);
  }

  return currentSession;
}
