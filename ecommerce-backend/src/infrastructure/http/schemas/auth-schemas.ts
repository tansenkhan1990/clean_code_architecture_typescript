import { z } from "zod";

/**
 * The edge validates shape, not policy: password length is a domain rule, so
 * its failure keeps a specific message ("at least 12 characters") instead of a
 * generic "invalid request body". The upper bound only limits work done on
 * absurd payloads.
 */
export const registerBodySchema = z
  .object({
    email: z.string().min(3).max(320),
    name: z.string().min(1).max(120),
    password: z.string().min(1).max(1_024),
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: z.string().min(3).max(320),
    password: z.string().min(1).max(1_024),
  })
  .strict();
