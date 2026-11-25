import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateProduct } from "../../../application/product/create-product/create-product.types.js";
import type { GetProduct } from "../../../application/product/get-product/get-product.types.js";
import type { ListProducts } from "../../../application/product/list-products/list-products.types.js";
import { sendApplicationError } from "../http-errors.js";
import { toProductResponse } from "../presenters/product-presenter.js";
import {
  createProductBodySchema,
  productIdParamsSchema,
} from "../schemas/product-schemas.js";

type ProductControllerDependencies = {
  createProduct: CreateProduct;
  getProduct: GetProduct;
  listProducts: ListProducts;
};

export function createProductController({
  createProduct,
  getProduct,
  listProducts,
}: ProductControllerDependencies) {
  return {
    async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const body = createProductBodySchema.safeParse(request.body);

      if (!body.success) {
        reply.code(400).send({ message: "Invalid request body" });
        return;
      }

      const result = await createProduct({
        name: body.data.name,
        amountInMinorUnits: body.data.price.amountInMinorUnits,
        currency: body.data.price.currency,
        ...(body.data.availableQuantity === undefined
          ? {}
          : { availableQuantity: body.data.availableQuantity }),
      });

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      reply.code(201).send(toProductResponse(result.value));
    },

    async list(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const result = await listProducts();

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      reply.code(200).send(result.value.map(toProductResponse));
    },

    async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const params = productIdParamsSchema.safeParse(request.params);

      if (!params.success) {
        reply.code(400).send({ message: "Invalid product id" });
        return;
      }

      const result = await getProduct({ id: params.data.id });

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      reply.code(200).send(toProductResponse(result.value));
    },
  };
}

export type ProductController = ReturnType<typeof createProductController>;
