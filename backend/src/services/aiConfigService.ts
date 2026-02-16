import { z } from "zod";

import { getAllowedOpenAiModels } from "../config/env";
import { prisma } from "../db/prisma";
import { ServiceError } from "./errors";

const aiConfigSchema = z
  .object({
    apiKey: z.string().min(20).optional(),
    model: z.string().min(1).optional()
  })
  .refine((data) => data.apiKey !== undefined || data.model !== undefined, {
    message: "At least one field is required.",
    path: ["apiKey"]
  });

export function parseAiConfigPayload(payload: unknown) {
  const parsed = aiConfigSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ServiceError("Invalid request payload.", 400, {
      error: "Invalid request payload.",
      details: parsed.error.flatten()
    });
  }
  return parsed.data;
}

function normalizeModel(input: string) {
  return input.trim();
}

export function listAllowedOpenAiModels() {
  return getAllowedOpenAiModels();
}

function assertModelAllowed(model: string) {
  const allowed = listAllowedOpenAiModels();
  if (!allowed.includes(model)) {
    throw new ServiceError("Selected model is not allowed.", 400, {
      error: "Selected model is not allowed.",
      allowedModels: allowed
    });
  }
}

export async function getUserAiConfig(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { openAiApiKey: true, openAiModel: true }
  });
  if (!user) {
    throw new ServiceError("User not found.", 404);
  }

  return {
    hasApiKey: Boolean(user.openAiApiKey),
    model: user.openAiModel,
    allowedModels: listAllowedOpenAiModels()
  };
}

export async function updateUserAiConfig(params: {
  userId: string;
  apiKey?: string;
  model?: string;
}) {
  const nextData: { openAiApiKey?: string; openAiModel?: string } = {};

  if (params.apiKey !== undefined) {
    nextData.openAiApiKey = params.apiKey.trim();
  }

  if (params.model !== undefined) {
    const normalizedModel = normalizeModel(params.model);
    assertModelAllowed(normalizedModel);
    nextData.openAiModel = normalizedModel;
  }

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data: nextData,
    select: { openAiModel: true, openAiApiKey: true }
  });

  return {
    ok: true,
    hasApiKey: Boolean(updated.openAiApiKey),
    model: updated.openAiModel,
    allowedModels: listAllowedOpenAiModels()
  };
}

export async function revokeUserAiKey(userId: string) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { openAiApiKey: null },
    select: { openAiModel: true }
  });
  return { ok: true, hasApiKey: false, model: updated.openAiModel };
}
