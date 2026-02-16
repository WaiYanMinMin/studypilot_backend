import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv({ path: ".env.local" });
loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),
  OPENAI_ALLOWED_MODELS: z.string().default("gpt-4o-mini,gpt-4o,gpt-4.1-mini,gpt-4.1"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  SESSION_COOKIE_DOMAIN: z.string().optional(),
  AWS_REGION: z.string().min(1, "AWS_REGION is required."),
  S3_BUCKET_NAME: z.string().min(1, "S3_BUCKET_NAME is required."),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).max(2).default(0)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const fields = parsed.error.flatten().fieldErrors;
  throw new Error(
    `Invalid environment configuration: ${JSON.stringify(fields, null, 2)}`
  );
}

export const env = parsed.data;

export function getCorsOrigins() {
  return env.CORS_ORIGIN.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getCookieDomain() {
  const domain = env.SESSION_COOKIE_DOMAIN?.trim();
  return domain ? domain : undefined;
}

export function getAllowedOpenAiModels() {
  return env.OPENAI_ALLOWED_MODELS.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
