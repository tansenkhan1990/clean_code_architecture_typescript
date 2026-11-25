import { z } from "zod";

export const createCustomerBodySchema = z
  .object({
    email: z.string(),
    name: z.string(),
  })
  .strict();

export const customerIdParamsSchema = z.object({
  id: z.string().min(1),
});
