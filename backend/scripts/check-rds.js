/* eslint-disable no-console */
const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");
const { Client } = require("pg");
const AWS = require("aws-sdk");

AWS.config.update({ region: "ap-southeast-1" });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

function getSslConfig() {
  const certPath = process.env.DB_SSL_CA_PATH;
  if (!certPath) {
    return { rejectUnauthorized: false };
  }
  if (!fs.existsSync(certPath)) {
    console.warn(`CA cert not found at ${certPath}, using fallback SSL mode.`);
    return { rejectUnauthorized: false };
  }
  return {
    rejectUnauthorized: true,
    ca: fs.readFileSync(certPath, "utf8")
  };
}

async function main() {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT || "5432");
  const database = process.env.DB_NAME || "postgres";
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!host || !user || !password) {
    throw new Error("Missing required vars: DB_HOST, DB_USER, DB_PASSWORD");
  }

  const client = new Client({
    host,
    port,
    database,
    user,
    password,
    ssl: getSslConfig()
  });

  try {
    await client.connect();
    const res = await client.query("SELECT version()");
    console.log("Connected:", res.rows[0].version);
  } catch (error) {
    console.error("Database error:", error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch(console.error);