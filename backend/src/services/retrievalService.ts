import type { Citation, DocumentRecord, TextChunk } from "../types";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "in",
  "on",
  "to",
  "of",
  "for",
  "with",
  "is",
  "are",
  "was",
  "were",
  "it",
  "this",
  "that",
  "as",
  "at",
  "by",
  "from"
]);

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function scoreChunk(queryTokens: string[], chunk: TextChunk) {
  const chunkTokens = new Set(tokenize(chunk.text));
  let overlap = 0;
  for (const token of queryTokens) {
    if (chunkTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(queryTokens.length, 1);
}

export function retrieveTopCitations(
  documents: DocumentRecord[],
  query: string,
  topK = 6
): Citation[] {
  const queryTokens = tokenize(query);
  const scored: Array<{ score: number; citation: Citation }> = [];

  for (const doc of documents) {
    for (const chunk of doc.chunks) {
      // Lightweight lexical retrieval for MVP; replace with embeddings later.
      const score = scoreChunk(queryTokens, chunk);
      if (score <= 0) continue;
      scored.push({
        score,
        citation: {
          documentId: doc.id,
          title: doc.title,
          pageNumber: chunk.pageNumber,
          chunkId: chunk.chunkId,
          excerpt: chunk.text.slice(0, 350)
        }
      });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((entry) => entry.citation);
}
