import { z } from "zod";

import { getDocumentsByIds } from "../repositories/documentRepository";
import { answerQuestionWithCitations } from "./aiService";
import { ServiceError } from "./errors";
import { retrieveTopCitations } from "./retrievalService";

const askSchema = z.object({
  question: z.string().min(3),
  documentIds: z.array(z.string()).min(1)
});

const highlightSchema = z.object({
  question: z.string().min(3),
  highlightText: z.string().min(2),
  documentIds: z.array(z.string()).min(1)
});

export function parseAskPayload(payload: unknown) {
  const parsed = askSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ServiceError("Invalid request payload.", 400, {
        error: "Invalid request payload.",
        details: parsed.error.flatten()
      });
  }
  return parsed.data;
}

export function parseHighlightPayload(payload: unknown) {
  const parsed = highlightSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ServiceError("Invalid request payload.", 400, {
        error: "Invalid request payload.",
        details: parsed.error.flatten()
      });
  }
  return parsed.data;
}

export async function askFromDocuments(params: {
  userId: string;
  question: string;
  documentIds: string[];
}) {
  const docs = await getDocumentsByIds(params.userId, params.documentIds);
  if (docs.length === 0) {
    throw new ServiceError("No matching documents found.", 404);
  }

  const citations = retrieveTopCitations(docs, params.question);
  if (citations.length === 0) {
    return {
      answer: "I could not find relevant content in the selected slides for that question.",
      citations: []
    };
  }

  return answerQuestionWithCitations({
    question: params.question,
    citations
  });
}

export async function askFromHighlight(params: {
  userId: string;
  question: string;
  highlightText: string;
  documentIds: string[];
}) {
  const docs = await getDocumentsByIds(params.userId, params.documentIds);
  if (docs.length === 0) {
    throw new ServiceError("No matching documents found.", 404);
  }

  const retrievalQuery = `${params.question} ${params.highlightText}`;
  const citations = retrieveTopCitations(docs, retrievalQuery);
  return answerQuestionWithCitations({
    question: params.question,
    citations,
    highlightText: params.highlightText
  });
}
