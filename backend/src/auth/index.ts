import { randomBytes } from "node:crypto";

import { prisma } from "../db/prisma";

const SESSION_COOKIE_NAME = "study_session";
const SESSION_DAYS = 30;

function buildSessionExpiry() {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + SESSION_DAYS);
  return expiry;
}

export function getSessionCookieOptions(expires: Date) {
  const isProd = process.env.NODE_ENV === "production";
  const sameSite: "lax" | "none" = isProd ? "none" : "lax";
  const domain = process.env.SESSION_COOKIE_DOMAIN?.trim() || undefined;
  return {
    httpOnly: true,
    secure: isProd,
    sameSite,
    path: "/",
    domain,
    expires
  };
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export async function createUserSession(userId: string) {
  const sessionToken = randomBytes(48).toString("hex");
  const expires = buildSessionExpiry();
  const session = await prisma.session.create({
    data: {
      userId,
      sessionToken,
      expires
    }
  });
  return session;
}

export async function invalidateSession(sessionToken: string) {
  await prisma.session.deleteMany({
    where: { sessionToken }
  });
}

export async function getUserIdFromSessionToken(sessionToken?: string | null) {
  const token = sessionToken?.trim();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: token }
  });
  if (!session) return null;
  if (session.expires.getTime() < Date.now()) {
    await invalidateSession(token);
    return null;
  }

  return session.userId;
}
