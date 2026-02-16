import { compare, hash } from "bcryptjs";
import { z } from "zod";

import {
  createUserSession,
  getUserIdFromSessionToken,
  getSessionCookieName,
  getSessionCookieOptions,
  invalidateSession
} from "../auth";
import { prisma } from "../db/prisma";
import { ServiceError } from "./errors";

const signupSchema = z
  .object({
    fullName: z.string().min(2, "Full name is required."),
    email: z.string().email("Valid email is required."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8)
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
  });

const signinSchema = z.object({
  email: z.string().email("Valid email is required."),
  password: z.string().min(1, "Password is required.")
});

const profileUpdateSchema = z.object({
  fullName: z.string().min(2, "Full name is required."),
  email: z.string().email("Valid email is required.")
});

export function parseSignupPayload(payload: unknown) {
  const parsed = signupSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ServiceError("Invalid payload.", 400, {
        error: "Invalid payload.",
        details: parsed.error.flatten()
      });
  }
  return parsed.data;
}

export function parseSigninPayload(payload: unknown) {
  const parsed = signinSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ServiceError("Invalid payload.", 400, {
        error: "Invalid payload.",
        details: parsed.error.flatten()
      });
  }
  return parsed.data;
}

export function parseProfileUpdatePayload(payload: unknown) {
  const parsed = profileUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ServiceError("Invalid payload.", 400, {
      error: "Invalid payload.",
      details: parsed.error.flatten()
    });
  }
  return parsed.data;
}

export async function signupWithEmail(params: {
  fullName: string;
  email: string;
  password: string;
}) {
  const email = params.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });
  if (existing) {
    throw new ServiceError("Email is already registered.", 409);
  }

  const passwordHash = await hash(params.password, 12);
  const user = await prisma.user.create({
    data: {
      fullName: params.fullName.trim(),
      email,
      passwordHash
    },
    select: { id: true, fullName: true, email: true }
  });
  const session = await createUserSession(user.id);
  return {
    user: { id: user.id, fullName: user.fullName, email: user.email },
    sessionToken: session.sessionToken,
    sessionExpires: session.expires
  };
}

export async function signinWithEmail(params: { email: string; password: string }) {
  const email = params.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, fullName: true, email: true, passwordHash: true }
  });
  if (!user) {
    throw new ServiceError("Invalid email or password.", 401);
  }

  const passwordOk = await compare(params.password, user.passwordHash);
  if (!passwordOk) {
    throw new ServiceError("Invalid email or password.", 401);
  }

  const session = await createUserSession(user.id);
  return {
    user: { id: user.id, fullName: user.fullName, email: user.email },
    sessionToken: session.sessionToken,
    sessionExpires: session.expires
  };
}

export async function signoutByToken(token?: string) {
  if (token) {
    await invalidateSession(token);
  }
}

export async function getCurrentUserProfile(sessionToken?: string | null) {
  const userId = await getUserIdFromSessionToken(sessionToken);
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, email: true }
  });
}

export async function updateUserProfile(params: {
  userId: string;
  fullName: string;
  email: string;
}) {
  const email = params.email.toLowerCase().trim();
  const duplicate = await prisma.user.findFirst({
    where: {
      email,
      id: { not: params.userId }
    },
    select: { id: true }
  });
  if (duplicate) {
    throw new ServiceError("Email is already registered by another account.", 409);
  }

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data: {
      fullName: params.fullName.trim(),
      email
    },
    select: { id: true, fullName: true, email: true }
  });

  return updated;
}

export function getSessionCookieConfig(expires: Date) {
  return {
    name: getSessionCookieName(),
    options: getSessionCookieOptions(expires)
  };
}
