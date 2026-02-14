import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../db/prisma";
import type { DocumentRecord } from "../types";

const DATA_ROOT = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(DATA_ROOT, "uploads");

async function ensureDataDirs() {
  await mkdir(DATA_ROOT, { recursive: true });
  await mkdir(UPLOADS_DIR, { recursive: true });
}

export async function getUploadsDirPath() {
  await ensureDataDirs();
  return UPLOADS_DIR;
}

function mapDbDocumentToRecord(doc: {
  id: string;
  title: string;
  filePath: string;
  uploadedAt: Date;
  pages: Array<{ pageNumber: number; text: string }>;
  chunks: Array<{ chunkId: string; pageNumber: number; text: string }>;
}): DocumentRecord {
  return {
    id: doc.id,
    title: doc.title,
    filePath: doc.filePath,
    uploadedAt: doc.uploadedAt.toISOString(),
    pages: doc.pages,
    chunks: doc.chunks
  };
}

export async function listDocuments(userId: string) {
  const docs = await prisma.document.findMany({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
    include: {
      pages: {
        orderBy: { pageNumber: "asc" },
        select: { pageNumber: true, text: true }
      },
      chunks: {
        orderBy: { chunkId: "asc" },
        select: { chunkId: true, pageNumber: true, text: true }
      }
    }
  });
  return docs.map(mapDbDocumentToRecord);
}

export async function getDocumentsByIds(userId: string, documentIds: string[]) {
  const docs = await prisma.document.findMany({
    where: {
      userId,
      id: { in: documentIds }
    },
    include: {
      pages: {
        orderBy: { pageNumber: "asc" },
        select: { pageNumber: true, text: true }
      },
      chunks: {
        orderBy: { chunkId: "asc" },
        select: { chunkId: true, pageNumber: true, text: true }
      }
    }
  });
  return docs.map(mapDbDocumentToRecord);
}

export async function getDocumentById(userId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { userId, id: documentId },
    include: {
      pages: {
        orderBy: { pageNumber: "asc" },
        select: { pageNumber: true, text: true }
      },
      chunks: {
        orderBy: { chunkId: "asc" },
        select: { chunkId: true, pageNumber: true, text: true }
      }
    }
  });
  return doc ? mapDbDocumentToRecord(doc) : null;
}

export async function saveDocument(userId: string, record: DocumentRecord) {
  await prisma.document.create({
    data: {
      id: record.id,
      userId,
      title: record.title,
      filePath: record.filePath,
      uploadedAt: new Date(record.uploadedAt),
      pages: {
        createMany: {
          data: record.pages.map((page) => ({
            pageNumber: page.pageNumber,
            text: page.text
          }))
        }
      },
      chunks: {
        createMany: {
          data: record.chunks.map((chunk) => ({
            chunkId: chunk.chunkId,
            pageNumber: chunk.pageNumber,
            text: chunk.text
          }))
        }
      }
    }
  });
}

export async function deleteDocumentById(userId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { userId, id: documentId },
    select: { id: true, title: true, filePath: true }
  });
  if (!doc) return null;

  await prisma.document.delete({
    where: { id: doc.id }
  });

  return doc;
}

export async function listUploadedPdfFiles() {
  await ensureDataDirs();
  const files = await readdir(UPLOADS_DIR);
  return files.filter((name) => name.toLowerCase().endsWith(".pdf"));
}
