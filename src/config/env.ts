import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.string().min(1).default("mongodb://localhost:27017"),
  MONGODB_DATABASE: z.string().min(1).default("clean_code_todos"),
});

export const env = environmentSchema.parse(process.env);
