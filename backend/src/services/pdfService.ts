import { readFile } from "node:fs/promises";

import pdf from "pdf-parse-debugging-disabled";

import type { PageText, TextChunk } from "../types";

function normalizeWhitespace(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

type PdfTextContent = {
  items: Array<{ str?: string }>;
};

type PdfPageLike = {
  pageIndex: number;
  getTextContent: () => Promise<PdfTextContent>;
};

export async function extractPdfPages(filePath: string): Promise<PageText[]> {
  const buffer = await readFile(filePath);
  return extractPdfPagesFromBuffer(buffer);
}

export async function extractPdfPagesFromBuffer(buffer: Buffer): Promise<PageText[]> {
  const pageTexts: PageText[] = [];
  await pdf(buffer, {
    // Parse each page individually so we can preserve page references for citations.
    pagerender: async (pageData: PdfPageLike) => {
      const content = await pageData.getTextContent();
      const text = content.items
        .map((item) => (item.str ? String(item.str) : ""))
        .join(" ");
      pageTexts.push({
        pageNumber: pageData.pageIndex + 1,
        text: normalizeWhitespace(text)
      });
      return text;
    }
  });

  return pageTexts.filter((p) => p.text.length > 0);
}

export function chunkPages(pages: PageText[], maxChars = 900): TextChunk[] {
  const chunks: TextChunk[] = [];
  let chunkCounter = 0;

  for (const page of pages) {
    // Sentence-level chunking keeps chunks readable while still retrieval-friendly.
    const sentences = page.text.split(/(?<=[.!?])\s+/);
    let current = "";

    for (const sentence of sentences) {
      if (!sentence.trim()) continue;
      if ((current + " " + sentence).length <= maxChars) {
        current = current ? `${current} ${sentence}` : sentence;
        continue;
      }

      if (current) {
        chunkCounter += 1;
        chunks.push({
          chunkId: `chunk_${chunkCounter}`,
          pageNumber: page.pageNumber,
          text: current
        });
      }
      current = sentence;
    }

    if (current) {
      chunkCounter += 1;
      chunks.push({
        chunkId: `chunk_${chunkCounter}`,
        pageNumber: page.pageNumber,
        text: current
      });
    }
  }

  return chunks;
}
