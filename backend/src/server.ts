import { createServer } from "node:http";

import { env } from "./config/env";
import { prisma } from "./db/prisma";
import { createApp } from "./app";

const app = createApp();
const server = createServer(app);

server.listen(env.PORT, () => {
  console.log(`Backend API listening on port ${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
