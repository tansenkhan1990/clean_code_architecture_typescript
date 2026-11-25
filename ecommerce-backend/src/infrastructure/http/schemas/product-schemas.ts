import { z } from "zod";

export const createProductBodySchema = z
  .object({
    name: z.string(),
    price: z
      .object({
        amountInMinorUnits: z.number().int().nonnegative(),
        currency: z.string(),
      })
      .strict(),
    availableQuantity: z.number().int().nonnegative().optional(),
  })
  .strict();

export const productIdParamsSchema = z.object({
  id: z.string().min(1),
});
