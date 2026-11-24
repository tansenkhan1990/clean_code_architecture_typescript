/**
 * The logging capability HTTP adapters need. The composition root supplies the
 * implementation, so presentation never imports infrastructure.
 */
export interface Logger {
  info(message: string, details?: Record<string, unknown>): void;
  error(message: string, error: unknown, details?: Record<string, unknown>): void;
}
