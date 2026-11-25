import { z } from "zod";

export const orderIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const createOrderBodySchema = z
  .object({
    customerId: z.string().min(1),
  })
  .strict();

export const checkoutBodySchema = createOrderBodySchema;
