import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.string().min(1).default("mongodb://localhost:27017"),
  MONGODB_DATABASE: z.string().min(1).default("clean_code_todos"),
});

export type AppConfig = z.infer<typeof environmentSchema>;

/** Parses untrusted process configuration once, when the entrypoint starts. */
export function loadConfig(source: NodeJS.ProcessEnv): AppConfig {
  return environmentSchema.parse(source);
}
