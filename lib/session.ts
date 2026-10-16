import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./auth";

export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    return false;
  }
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return false;
  }
  return verifySessionToken(token, { secret, now: () => Date.now() });
}

export async function assertAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized");
  }
}
