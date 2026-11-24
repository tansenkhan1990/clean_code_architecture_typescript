type LogDetails = Record<string, unknown>;

/** Structured logging keeps one JSON shape across startup, requests, and shutdown. */
export const logger = {
  info(message: string, details: LogDetails = {}): void {
    console.log(JSON.stringify({ level: "info", message, ...details }));
  },

  error(message: string, error: unknown, details: LogDetails = {}): void {
    console.error(
      JSON.stringify({ level: "error", message, error: errorMessage(error), ...details }),
    );
  },
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
