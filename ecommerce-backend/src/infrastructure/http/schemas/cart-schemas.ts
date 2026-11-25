import { z } from "zod";

export const customerIdParamsSchema = z.object({
  customerId: z.string().min(1),
});

export const cartItemParamsSchema = z.object({
  customerId: z.string().min(1),
  productId: z.string().min(1),
});

export const addItemBodySchema = z
  .object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
  })
  .strict();
