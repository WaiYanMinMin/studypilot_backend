import type { Request, Response, NextFunction } from "express";

import { getSessionCookieName, getUserIdFromSessionToken } from "../auth";
import { ServiceError } from "../services/errors";

export type AuthenticatedRequest = Request & { userId: string };

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies?.[getSessionCookieName()];
    const userId = await getUserIdFromSessionToken(token);
    if (!userId) {
      throw new ServiceError("Unauthorized.", 401);
    }
    (req as AuthenticatedRequest).userId = userId;
    next();
  } catch (error) {
    next(error);
  }
}
