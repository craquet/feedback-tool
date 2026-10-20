import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./auth";

export const isAdmin = cache(async (): Promise<boolean> => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    return false;
  }
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return false;
  }
  return verifySessionToken(token, { secret, now: () => Date.now() });
});

/**
 * Authoritative auth check for admin server components. The proxy only does
 * an optimistic pre-filter; every page that touches admin data must call this
 * (or `assertAdmin`) so authorization is enforced next to the data itself.
 * Calling `cookies()` here also guarantees the page renders dynamically and
 * is never prerendered into the static build output.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }
}

export async function assertAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized");
  }
}
