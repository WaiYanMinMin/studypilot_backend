import { readFile, unlink } from "node:fs/promises";

import {
  deleteDocumentById,
  getDocumentById,
  listDocuments
} from "../repositories/documentRepository";
import { ServiceError } from "./errors";
import {
  deletePdfFromS3,
  downloadPdfFromS3,
  parseS3Locator
} from "./storageService";

export async function listUserDocuments(params: {
  userId: string;
  includePages: boolean;
}) {
  const docs = await listDocuments(params.userId);
  if (params.includePages) {
    return docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      uploadedAt: doc.uploadedAt,
      pages: doc.pages,
      fileUrl: `/api/documents/${doc.id}/file`
    }));
  }

  return docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    uploadedAt: doc.uploadedAt,
    fileUrl: `/api/documents/${doc.id}/file`,
    pageCount: doc.pages.length,
    chunkCount: doc.chunks.length
  }));
}

export async function getUserDocumentFile(params: { userId: string; documentId: string }) {
  const doc = await getDocumentById(params.userId, params.documentId);
  if (!doc) {
    throw new ServiceError("Document not found.", 404);
  }

  try {
    const s3Info = parseS3Locator(doc.filePath);
    if (s3Info) {
      const buffer = await downloadPdfFromS3(s3Info);
      return { buffer, title: doc.title };
    }

    const buffer = await readFile(doc.filePath);
    return { buffer, title: doc.title };
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }

    const isMissing =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT";

    if (isMissing) {
      throw new ServiceError(
        "Stored PDF is missing. Please re-upload this document from Step 1.",
        404
      );
    }
    throw new ServiceError("Stored file could not be read.", 500);
  }
}

export async function deleteUserDocument(params: { userId: string; documentId: string }) {
  const deleted = await deleteDocumentById(params.userId, params.documentId);
  if (!deleted) {
    throw new ServiceError("Document not found.", 404);
  }

  const s3Info = parseS3Locator(deleted.filePath);
  if (s3Info) {
    await deletePdfFromS3(s3Info);
    return { ok: true, deletedId: deleted.id };
  }

  try {
    await unlink(deleted.filePath);
  } catch (error) {
    const isMissing =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT";
    if (!isMissing) {
      throw new ServiceError("Stored file could not be removed.", 500);
    }
  }

  return { ok: true, deletedId: deleted.id };
}
