import type { DocumentRecord } from "../types";

export function buildLectureCorpus(documents: DocumentRecord[]) {
  return documents
    .map((doc) => {
      const pageText = doc.pages
        .map((page) => `Page ${page.pageNumber}: ${page.text}`)
        .join("\n");
      return `Document: ${doc.title}\n${pageText}`;
    })
    .join("\n\n");
}

export function createDocumentId() {
  return `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}
