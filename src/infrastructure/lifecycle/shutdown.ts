import { logger } from "../logging/logger.js";

export interface Closable {
  readonly name: string;
  close(): Promise<void>;
}

/** Installs signal handlers once and closes every resource in order. */
export function registerGracefulShutdown(closers: readonly Closable[]): void {
  let shutdownStarted = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    logger.info("Shutting down", { signal });
    void closeAll(closers);
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => shutdown(signal));
  }
}

/** Closes resources in order, keeping going after a failure so nothing leaks. */
export async function closeAll(closers: readonly Closable[]): Promise<void> {
  let failed = false;

  for (const closable of closers) {
    try {
      await closable.close();
    } catch (error: unknown) {
      failed = true;
      logger.error(`Could not close ${closable.name}`, error);
    }
  }

  if (failed) process.exitCode = 1;
}
