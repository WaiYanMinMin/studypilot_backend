import { z } from "zod";

import { prisma } from "../db/prisma";
import { ServiceError } from "./errors";

const feedbackSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.string().email("Valid email is required."),
  feedback: z
    .string()
    .min(10, "Feedback should be at least 10 characters.")
    .max(1500, "Feedback is too long.")
});

export function parseFeedbackPayload(payload: unknown) {
  const parsed = feedbackSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ServiceError("Invalid feedback payload.", 400, {
        error: "Invalid feedback payload.",
        details: parsed.error.flatten()
      });
  }
  return parsed.data;
}

export async function submitFeedback(params: {
  name: string;
  email: string;
  feedback: string;
}) {
  const created = await prisma.feedback.create({
    data: {
      name: params.name.trim(),
      email: params.email.toLowerCase().trim(),
      message: params.feedback.trim()
    },
    select: { id: true, createdAt: true }
  });

  return { ok: true, feedbackId: created.id };
}
