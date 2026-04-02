import { cookies } from "next/headers";
import { getUserBySessionToken, type User } from "./db";

/**
 * Get the currently authenticated user from the session cookie.
 * Returns null if not authenticated or session expired.
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("sk-session")?.value;
  if (!token) return null;
  return getUserBySessionToken(token);
}

/**
 * Require authentication — returns user or throws.
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * Require admin role — returns user or throws.
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw new Error("Forbidden");
  }
  return user;
}
