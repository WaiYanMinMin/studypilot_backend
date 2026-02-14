import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import multer from "multer";

import { prisma } from "./db/prisma";
import { env, getCookieDomain, getCorsOrigins } from "./config/env";
import { getSessionCookieName } from "./auth";
import { requireAuth, type AuthenticatedRequest } from "./http/auth";
import { asyncHandler, errorHandler } from "./http/errors";
import {
  getCurrentUserProfile,
  getSessionCookieConfig,
  parseProfileUpdatePayload,
  parseSigninPayload,
  parseSignupPayload,
  signinWithEmail,
  signoutByToken,
  signupWithEmail,
  updateUserProfile
} from "./services/authService";
import { ingestUserPdfUpload } from "./services/documentIngestionService";
import {
  deleteUserDocument,
  getUserDocumentFile,
  listUserDocuments
} from "./services/documentService";
import { parseAskPayload, parseHighlightPayload, askFromDocuments, askFromHighlight } from "./services/questionService";
import {
  generateResourcesForDocuments,
  parseResourcesPayload
} from "./services/studyResourceService";
import { parseFeedbackPayload, submitFeedback } from "./services/feedbackService";
import { ServiceError } from "./services/errors";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

function toUploadFile(file: Express.Multer.File) {
  const source = file.buffer.buffer.slice(
    file.buffer.byteOffset,
    file.buffer.byteOffset + file.buffer.byteLength
  );
  const arrayBuffer = source instanceof ArrayBuffer ? source : new ArrayBuffer(0);
  return {
    name: file.originalname,
    type: file.mimetype,
    size: file.size,
    arrayBuffer: async () => arrayBuffer
  };
}

function getRouteParam(req: express.Request, key: string) {
  const value = req.params[key];
  return typeof value === "string" ? value : "";
}

export function createApp() {
  const app = express();

  app.set("trust proxy", env.TRUST_PROXY);
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        const allowedOrigins = getCorsOrigins();
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("CORS origin is not allowed."));
      },
      credentials: true
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));

  app.get(
    "/health",
    asyncHandler(async (_req, res) => {
      let dbReady = false;
      try {
        await prisma.$queryRaw`SELECT 1`;
        dbReady = true;
      } catch {
        dbReady = false;
      }
      const payload = { service: "ok", db: dbReady ? "ok" : "down" };
      res.status(dbReady ? 200 : 503).json(payload);
    })
  );

  app.post(
    "/api/auth/signup",
    asyncHandler(async (req, res) => {
      const payload = parseSignupPayload(req.body);
      const result = await signupWithEmail(payload);
      const cookie = getSessionCookieConfig(result.sessionExpires);
      res.cookie(cookie.name, result.sessionToken, cookie.options);
      res.status(201).json({ user: result.user });
    })
  );

  app.post(
    "/api/auth/signin",
    asyncHandler(async (req, res) => {
      const payload = parseSigninPayload(req.body);
      const result = await signinWithEmail(payload);
      const cookie = getSessionCookieConfig(result.sessionExpires);
      res.cookie(cookie.name, result.sessionToken, cookie.options);
      res.json({ user: result.user });
    })
  );

  app.post(
    "/api/auth/signout",
    asyncHandler(async (req, res) => {
      const token = req.cookies?.[getSessionCookieName()];
      await signoutByToken(token);
      res.clearCookie(getSessionCookieName(), {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
        domain: getCookieDomain()
      });
      res.json({ ok: true });
    })
  );

  app.get(
    "/api/auth/me",
    asyncHandler(async (req, res) => {
      const token = req.cookies?.[getSessionCookieName()];
      const user = await getCurrentUserProfile(token);
      res.json({ user });
    })
  );

  app.patch(
    "/api/auth/me",
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = parseProfileUpdatePayload(req.body);
      const updated = await updateUserProfile({
        userId: (req as AuthenticatedRequest).userId,
        fullName: payload.fullName,
        email: payload.email
      });
      res.json({ user: updated });
    })
  );

  app.post(
    "/api/upload",
    requireAuth,
    upload.single("file"),
    asyncHandler(async (req, res) => {
      if (!req.file) {
        throw new ServiceError("File is required.", 400);
      }
      const result = await ingestUserPdfUpload({
        userId: (req as AuthenticatedRequest).userId,
        file: toUploadFile(req.file)
      });
      res.status(201).json(result);
    })
  );

  app.get(
    "/api/documents",
    requireAuth,
    asyncHandler(async (req, res) => {
      const includePages = req.query.includePages === "true";
      const documents = await listUserDocuments({
        userId: (req as AuthenticatedRequest).userId,
        includePages
      });
      res.json({ documents });
    })
  );

  app.delete(
    "/api/documents/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await deleteUserDocument({
        userId: (req as AuthenticatedRequest).userId,
        documentId: getRouteParam(req, "id")
      });
      res.json(result);
    })
  );

  app.get(
    "/api/documents/:id/file",
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await getUserDocumentFile({
        userId: (req as AuthenticatedRequest).userId,
        documentId: getRouteParam(req, "id")
      });
      const safeName = `${result.title.replace(/[^\w.\-]+/g, "_")}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
      res.send(result.buffer);
    })
  );

  app.post(
    "/api/ask",
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = parseAskPayload(req.body);
      const result = await askFromDocuments({
        userId: (req as AuthenticatedRequest).userId,
        question: payload.question,
        documentIds: payload.documentIds
      });
      res.json(result);
    })
  );

  app.post(
    "/api/ask-highlight",
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = parseHighlightPayload(req.body);
      const result = await askFromHighlight({
        userId: (req as AuthenticatedRequest).userId,
        question: payload.question,
        highlightText: payload.highlightText,
        documentIds: payload.documentIds
      });
      res.json(result);
    })
  );

  app.post(
    "/api/resources",
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = parseResourcesPayload(req.body);
      const result = await generateResourcesForDocuments({
        userId: (req as AuthenticatedRequest).userId,
        documentIds: payload.documentIds
      });
      res.json(result);
    })
  );

  app.post(
    "/api/feedback",
    asyncHandler(async (req, res) => {
      const payload = parseFeedbackPayload(req.body);
      const result = await submitFeedback(payload);
      res.status(201).json(result);
    })
  );

  app.use(errorHandler);

  return app;
}
