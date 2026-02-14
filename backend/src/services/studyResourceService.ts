import { z } from "zod";

import { getDocumentsByIds } from "../repositories/documentRepository";
import { generateStudyResources } from "./aiService";
import { ServiceError } from "./errors";
import { buildLectureCorpus } from "./resourceService";

const resourcesSchema = z.object({
  documentIds: z.array(z.string()).min(1)
});

export function parseResourcesPayload(payload: unknown) {
  const parsed = resourcesSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ServiceError("Invalid request payload.", 400, {
        error: "Invalid request payload.",
        details: parsed.error.flatten()
      });
  }
  return parsed.data;
}

export async function generateResourcesForDocuments(params: {
  userId: string;
  documentIds: string[];
}) {
  const docs = await getDocumentsByIds(params.userId, params.documentIds);
  if (docs.length === 0) {
    throw new ServiceError("No matching documents found.", 404);
  }

  const corpus = buildLectureCorpus(docs);
  return generateStudyResources({ lectureText: corpus });
}
