import type { NextFunction, Request, Response } from "express";

import { isServiceError, serviceErrorBody } from "../services/errors";

export function asyncHandler<
  TReq extends Request = Request,
  TRes extends Response = Response
>(
  fn: (req: TReq, res: TRes, next: NextFunction) => Promise<unknown>
) {
  return (req: TReq, res: TRes, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (isServiceError(error)) {
    res.status(error.status).json(serviceErrorBody(error));
    return;
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message)
      : "Internal server error.";

  res.status(500).json({ error: message });
}
