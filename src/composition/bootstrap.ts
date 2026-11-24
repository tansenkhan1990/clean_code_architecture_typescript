import type { AppConfig } from "../infrastructure/config/env.js";
import { startHttpServer, type HttpServer } from "../infrastructure/http/server.js";
import { closeAll, registerGracefulShutdown } from "../infrastructure/lifecycle/shutdown.js";
import { logger } from "../infrastructure/logging/logger.js";
import { createContainer } from "./container.js";

/**
 * Starts the running application: build the graph, bind the port, and register
 * cleanup for every resource. Any startup failure releases what was already opened.
 */
export async function startApplication(config: AppConfig): Promise<void> {
  const container = await createContainer(config);
  const database = {
    name: "MongoDB connection",
    close: (): Promise<void> => container.dispose(),
  };

  let server: HttpServer;
  try {
    server = await startHttpServer(container.app, { port: config.PORT });
  } catch (error: unknown) {
    await closeAll([database]);
    throw error;
  }

  logger.info("API listening", { port: server.port });
  registerGracefulShutdown([
    { name: "HTTP server", close: () => server.close() },
    database,
  ]);
}
