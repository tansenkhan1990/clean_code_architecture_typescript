import "dotenv/config";
import { startApplication } from "./composition/bootstrap.js";
import { loadConfig } from "./infrastructure/config/env.js";
import { logger } from "./infrastructure/logging/logger.js";

/** Entrypoint: load configuration, start the application, report startup failures. */
async function main(): Promise<void> {
  await startApplication(loadConfig(process.env));
}

void main().catch((error: unknown) => {
  logger.error("Could not start API", error);
  process.exitCode = 1;
});
