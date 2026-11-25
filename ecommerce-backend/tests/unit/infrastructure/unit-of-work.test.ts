import { describe, expect, it } from "vitest";
import {
  buildInMemoryDependencies,
  buildUseCases,
} from "../../../src/main/container.js";
import { err, ok } from "../../../src/domain/shared/result.js";
import { createMoney } from "../../../src/domain/product/money.js";
import { createProduct } from "../../../src/domain/product/product.js";
import { createInMemoryStore } from "../../../src/infrastructure/persistence/in-memory/store.js";
import { createInMemoryProductRepository } from "../../../src/infrastructure/persistence/repositories/in-memory-product-repository.js";
import { createInMemoryUnitOfWork } from "../../../src/infrastructure/transactions/in-memory-unit-of-work.js";

function sampleProduct(id: string) {
  const price = createMoney(1999, "usd");
  if (!price.ok) throw new Error("Expected money");

  const product = createProduct({
    id,
    name: "Keyboard",
    price: price.value,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  if (!product.ok) throw new Error("Expected a product");

  return product.value;
}

describe("in-memory unit of work", () => {
  it("commits every write when the work succeeds", async () => {
    const store = createInMemoryStore();
    const products = createInMemoryProductRepository(store);
    const unitOfWork = createInMemoryUnitOfWork(store);

    const result = await unitOfWork.execute(async () => {
      await products.save(sampleProduct("p-1"));
      await products.save(sampleProduct("p-2"));
      return ok("done");
    });

    expect(result).toEqual(ok("done"));
    expect(await products.findById("p-1")).not.toBeNull();
    expect(await products.findById("p-2")).not.toBeNull();
  });

  it("rolls back every write when the work returns a failure", async () => {
    const store = createInMemoryStore();
    const products = createInMemoryProductRepository(store);
    const unitOfWork = createInMemoryUnitOfWork(store);

    const result = await unitOfWork.execute(async () => {
      await products.save(sampleProduct("p-1"));
      return err({ type: "business_failure", message: "nope" });
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a failure");
    expect(result.error.type).toBe("business_failure");
    expect(await products.findById("p-1")).toBeNull();
  });

  it("rolls back and reports transaction_failed when the work throws", async () => {
    const store = createInMemoryStore();
    const products = createInMemoryProductRepository(store);
    const unitOfWork = createInMemoryUnitOfWork(store);

    const result = await unitOfWork.execute(async () => {
      await products.save(sampleProduct("p-1"));
      throw new Error("connection reset");
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a failure");
    expect(result.error).toEqual({
      type: "transaction_failed",
      message: "connection reset",
    });
    expect(await products.findById("p-1")).toBeNull();
  });

  it("rolls back a real use case when a later write fails", async () => {
    const dependencies = buildInMemoryDependencies();
    const failingInventory = {
      ...dependencies.inventory,
      async save(): Promise<void> {
        throw new Error("disk full");
      },
    };

    const useCases = buildUseCases({
      ...dependencies,
      inventory: failingInventory,
    });

    const created = await useCases.createProduct({
      name: "Keyboard",
      amountInMinorUnits: 1999,
      currency: "usd",
      availableQuantity: 5,
    });

    expect(created.ok).toBe(false);
    if (created.ok) throw new Error("Expected a failure");
    expect(created.error.type).toBe("transaction_failed");

    // The product row was written first, but the transaction undid it.
    const products = await dependencies.products.findAll();
    expect(products).toEqual([]);
    expect(await dependencies.inventory.findByProductId("id-1")).toBeNull();
  });
});
