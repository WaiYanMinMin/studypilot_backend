import type { DocumentRecord } from "../types";
import { chunkPages, extractPdfPagesFromBuffer } from "./pdfService";
import { ServiceError } from "./errors";
import { createDocumentId } from "./resourceService";
import { saveDocument } from "../repositories/documentRepository";
import {
  buildDocumentS3Key,
  uploadPdfBufferToS3
} from "./storageService";

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

type UploadFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export async function ingestUserPdfUpload(params: {
  userId: string;
  file: UploadFile;
}) {
  const { userId, file } = params;

  if (file.type !== "application/pdf") {
    throw new ServiceError("Only PDF files are supported.", 400);
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new ServiceError("File too large. Max size is 20MB.", 400);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const docId = createDocumentId();
  const pages = await extractPdfPagesFromBuffer(bytes);
  const chunks = chunkPages(pages);
  const s3Key = buildDocumentS3Key({
    userId,
    documentId: docId,
    fileName: file.name
  });
  const filePath = await uploadPdfBufferToS3({
    key: s3Key,
    body: bytes,
    contentType: file.type || "application/pdf"
  });

  const record: DocumentRecord = {
    id: docId,
    title: file.name,
    filePath,
    uploadedAt: new Date().toISOString(),
    pages,
    chunks
  };
  await saveDocument(userId, record);

  return {
    id: record.id,
    title: record.title,
    uploadedAt: record.uploadedAt,
    storedAt: record.filePath,
    pages: record.pages.length,
    chunks: record.chunks.length
  };
}
