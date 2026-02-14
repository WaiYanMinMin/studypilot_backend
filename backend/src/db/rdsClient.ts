import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

import { Client } from "pg";

function readCaCertificate() {
  const certPath = process.env.DB_SSL_CA_PATH;
  if (!certPath) return undefined;
  if (!existsSync(certPath)) return undefined;
  return readFileSync(certPath, "utf8");
}

export function createRdsClient() {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT || "5432");
  const database = process.env.DB_NAME || "postgres";
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!host || !user || !password) {
    throw new Error("Missing RDS vars. Required: DB_HOST, DB_USER, DB_PASSWORD");
  }

  const ca = readCaCertificate();

  return new Client({
    host,
    port,
    database,
    user,
    password,
    ssl: ca
      ? {
          rejectUnauthorized: true,
          ca
        }
      : {
          rejectUnauthorized: false
        }
  });
}

export async function checkRdsConnection() {
  const client = createRdsClient();
  try {
    await client.connect();
    const result = await client.query("SELECT version()");
    return result.rows[0]?.version as string;
  } finally {
    await client.end();
  }
}
