import AWS from "aws-sdk";

import { ServiceError } from "./errors";

function getS3BucketName() {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) {
    throw new ServiceError("S3_BUCKET_NAME is missing in environment.", 500);
  }
  return bucket;
}

function getAwsRegion() {
  const region = process.env.AWS_REGION;
  if (!region) {
    throw new ServiceError("AWS_REGION is missing in environment.", 500);
  }
  return region;
}

function getS3Client() {
  const region = getAwsRegion();
  return new AWS.S3({ region });
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

export function buildDocumentS3Key(params: {
  userId: string;
  documentId: string;
  fileName: string;
}) {
  const safeName = sanitizeFileName(params.fileName);
  return `users/${params.userId}/documents/${params.documentId}/${safeName}`;
}

export function buildS3Locator(bucket: string, key: string) {
  return `s3://${bucket}/${key}`;
}

export function parseS3Locator(locator: string) {
  if (!locator.startsWith("s3://")) {
    return null;
  }

  const withoutScheme = locator.slice("s3://".length);
  const slashIdx = withoutScheme.indexOf("/");
  if (slashIdx <= 0) {
    throw new ServiceError("Stored S3 locator is invalid.", 500);
  }
  const bucket = withoutScheme.slice(0, slashIdx);
  const key = withoutScheme.slice(slashIdx + 1);
  if (!bucket || !key) {
    throw new ServiceError("Stored S3 locator is invalid.", 500);
  }
  return { bucket, key };
}

export async function uploadPdfBufferToS3(params: {
  key: string;
  body: Buffer;
  contentType?: string;
}) {
  const bucket = getS3BucketName();
  const s3 = getS3Client();
  await s3
    .putObject({
      Bucket: bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType ?? "application/pdf"
    })
    .promise();

  return buildS3Locator(bucket, params.key);
}

export async function downloadPdfFromS3(params: { bucket: string; key: string }) {
  const s3 = getS3Client();
  try {
    const result = await s3
      .getObject({
        Bucket: params.bucket,
        Key: params.key
      })
      .promise();

    if (!result.Body) {
      throw new ServiceError("Stored file could not be read.", 500);
    }

    const body = Buffer.isBuffer(result.Body)
      ? result.Body
      : Buffer.from(result.Body as Uint8Array);

    return body;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (code === "NoSuchKey" || code === "NotFound") {
      throw new ServiceError(
        "Stored PDF is missing. Please re-upload this document from Step 1.",
        404
      );
    }
    throw new ServiceError("Stored file could not be read.", 500);
  }
}

export async function deletePdfFromS3(params: { bucket: string; key: string }) {
  const s3 = getS3Client();
  try {
    await s3
      .deleteObject({
        Bucket: params.bucket,
        Key: params.key
      })
      .promise();
  } catch {
    throw new ServiceError("Stored file could not be removed.", 500);
  }
}
