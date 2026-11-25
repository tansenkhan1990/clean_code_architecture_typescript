import { addItemUseCase } from "../application/cart/add-item/add-item.js";
import type { AddItem } from "../application/cart/add-item/add-item.types.js";
import { getCartUseCase } from "../application/cart/get-cart/get-cart.js";
import type { GetCart } from "../application/cart/get-cart/get-cart.types.js";
import { removeItemUseCase } from "../application/cart/remove-item/remove-item.js";
import type { RemoveItem } from "../application/cart/remove-item/remove-item.types.js";
import { checkoutUseCase } from "../application/checkout/checkout.js";
import type { Checkout } from "../application/checkout/checkout.types.js";
import { createCustomerUseCase } from "../application/customer/create-customer/create-customer.js";
import type { CreateCustomer } from "../application/customer/create-customer/create-customer.types.js";
import { getCustomerUseCase } from "../application/customer/get-customer/get-customer.js";
import type { GetCustomer } from "../application/customer/get-customer/get-customer.types.js";
import { cancelOrderUseCase } from "../application/order/cancel-order/cancel-order.js";
import type { CancelOrder } from "../application/order/cancel-order/cancel-order.types.js";
import { createOrderUseCase } from "../application/order/create-order/create-order.js";
import type { CreateOrder } from "../application/order/create-order/create-order.types.js";
import { getOrderUseCase } from "../application/order/get-order/get-order.js";
import type { GetOrder } from "../application/order/get-order/get-order.types.js";
import { dispatchOutboxUseCase } from "../application/outbox/dispatch-outbox.js";
import type { DispatchOutbox } from "../application/outbox/dispatch-outbox.types.js";
import { processPaymentUseCase } from "../application/payment/process-payment/process-payment.js";
import type { ProcessPayment } from "../application/payment/process-payment/process-payment.types.js";
import type { Cache } from "../application/ports/cache.js";
import type { Clock } from "../application/ports/clock.js";
import type { IdGenerator } from "../application/ports/id-generator.js";
import type { OutboxRepository } from "../application/ports/outbox.js";
import type { PaymentGateway } from "../application/ports/payment-gateway.js";
import type { EventPublisher } from "../application/ports/event-publisher.js";
import type { IdempotencyStore } from "../application/ports/idempotency-store.js";
import type { RateLimiter } from "../application/ports/rate-limiter.js";
import type { CartRepository } from "../application/ports/repositories/cart-repository.js";
import type { CustomerRepository } from "../application/ports/repositories/customer-repository.js";
import type { InventoryRepository } from "../application/ports/repositories/inventory-repository.js";
import type { OrderRepository } from "../application/ports/repositories/order-repository.js";
import type { ProductRepository } from "../application/ports/repositories/product-repository.js";
import type { UnitOfWork } from "../application/ports/unit-of-work.js";
import { createProductUseCase } from "../application/product/create-product/create-product.js";
import type { CreateProduct } from "../application/product/create-product/create-product.types.js";
import { getProductUseCase } from "../application/product/get-product/get-product.js";
import type { GetProduct } from "../application/product/get-product/get-product.types.js";
import { listProductsUseCase } from "../application/product/list-products/list-products.js";
import type { ListProducts } from "../application/product/list-products/list-products.types.js";
import { createInMemoryCache } from "../infrastructure/cache/in-memory-cache.js";
import { createConsoleEventPublisher } from "../infrastructure/events/console-event-publisher.js";
import type { HealthCheck } from "../infrastructure/health/health-check.js";
import { createCartController } from "../infrastructure/http/controllers/cart-controller.js";
import { createCheckoutController } from "../infrastructure/http/controllers/checkout-controller.js";
import { createCustomerController } from "../infrastructure/http/controllers/customer-controller.js";
import { createOrderController } from "../infrastructure/http/controllers/order-controller.js";
import { createProductController } from "../infrastructure/http/controllers/product-controller.js";
import type { HttpControllers } from "../infrastructure/http/fastify.js";
import { createInMemoryIdempotencyStore } from "../infrastructure/idempotency/in-memory-idempotency-store.js";
import { createInMemoryInboxStore } from "../infrastructure/inbox/in-memory-inbox-store.js";
import type { InboxStore } from "../application/ports/inbox-store.js";
import {
  createKafkaEventPublisher,
  type KafkaEventPublisher,
} from "../infrastructure/kafka/kafka-event-publisher.js";
import {
  createOrderEventsConsumer,
  type OrderEventsConsumer,
} from "../infrastructure/kafka/order-events-consumer.js";
import { ensureKafkaTopics } from "../infrastructure/kafka/kafka-topics.js";
import {
  createMetrics,
  type Metrics,
} from "../infrastructure/observability/metrics.js";
import { createInMemoryPaymentGateway } from "../infrastructure/payments/in-memory-payment-gateway.js";
import { createInMemoryStore } from "../infrastructure/persistence/in-memory/store.js";
import { buildPrismaPersistence } from "../infrastructure/persistence/prisma/prisma-dependencies.js";
import { createInMemoryCartRepository } from "../infrastructure/persistence/repositories/in-memory-cart-repository.js";
import { createInMemoryCustomerRepository } from "../infrastructure/persistence/repositories/in-memory-customer-repository.js";
import { createInMemoryInventoryRepository } from "../infrastructure/persistence/repositories/in-memory-inventory-repository.js";
import { createInMemoryOrderRepository } from "../infrastructure/persistence/repositories/in-memory-order-repository.js";
import { createInMemoryOutboxRepository } from "../infrastructure/persistence/repositories/in-memory-outbox-repository.js";
import { createInMemoryProductRepository } from "../infrastructure/persistence/repositories/in-memory-product-repository.js";
import { createInMemoryRateLimiter } from "../infrastructure/rate-limit/in-memory-rate-limiter.js";
import { connectRedis } from "../infrastructure/redis/redis-client.js";
import { createRedisCache } from "../infrastructure/redis/redis-cache.js";
import { createRedisIdempotencyStore } from "../infrastructure/redis/redis-idempotency-store.js";
import { createRedisRateLimiter } from "../infrastructure/redis/redis-rate-limiter.js";
import { createSystemClock } from "../infrastructure/system/system-clock.js";
import { createUuidGenerator } from "../infrastructure/system/uuid-generator.js";
import { createInMemoryUnitOfWork } from "../infrastructure/transactions/in-memory-unit-of-work.js";

/**
 * Everything the application needs, expressed as ports. The root supplies the
 * concrete adapters; tests supply fakes through the same shape.
 */
export type ContainerDependencies = {
  customers: CustomerRepository;
  products: ProductRepository;
  inventory: InventoryRepository;
  carts: CartRepository;
  orders: OrderRepository;
  outbox: OutboxRepository;
  cache: Cache;
  clock: Clock;
  ids: IdGenerator;
  events: EventPublisher;
  gateway: PaymentGateway;
  idempotency: IdempotencyStore;
  unitOfWork: UnitOfWork;
};

export type UseCases = {
  createCustomer: CreateCustomer;
  getCustomer: GetCustomer;
  createProduct: CreateProduct;
  getProduct: GetProduct;
  listProducts: ListProducts;
  addItem: AddItem;
  removeItem: RemoveItem;
  getCart: GetCart;
  createOrder: CreateOrder;
  getOrder: GetOrder;
  cancelOrder: CancelOrder;
  processPayment: ProcessPayment;
  checkout: Checkout;
  dispatchOutbox: DispatchOutbox;
};

/**
 * The default adapter set: in-process, disposable, no external services.
 *
 * One store is shared by every repository and by the transaction adapter, so a
 * rollback can restore exactly the state the transaction started from.
 */
export function buildInMemoryDependencies(): ContainerDependencies {
  const store = createInMemoryStore();

  return {
    customers: createInMemoryCustomerRepository(store),
    products: createInMemoryProductRepository(store),
    inventory: createInMemoryInventoryRepository(store),
    carts: createInMemoryCartRepository(store),
    orders: createInMemoryOrderRepository(store),
    outbox: createInMemoryOutboxRepository(store),
    cache: createInMemoryCache(),
    clock: createSystemClock(),
    ids: createUuidGenerator(),
    events: createConsoleEventPublisher(),
    gateway: createInMemoryPaymentGateway(),
    idempotency: createInMemoryIdempotencyStore(),
    unitOfWork: createInMemoryUnitOfWork(store),
  };
}

export function buildUseCases(dependencies: ContainerDependencies): UseCases {
  // Every use case that writes more than one row receives the same boundary.
  const transactional = {
    ids: dependencies.ids,
    clock: dependencies.clock,
    outbox: dependencies.outbox,
    unitOfWork: dependencies.unitOfWork,
  };

  const createOrder = createOrderUseCase({
    carts: dependencies.carts,
    orders: dependencies.orders,
    inventory: dependencies.inventory,
    ...transactional,
  });

  const cancelOrder = cancelOrderUseCase({
    orders: dependencies.orders,
    inventory: dependencies.inventory,
    ...transactional,
  });

  const processPayment = processPaymentUseCase({
    orders: dependencies.orders,
    inventory: dependencies.inventory,
    gateway: dependencies.gateway,
    ...transactional,
  });

  return {
    createCustomer: createCustomerUseCase({
      customers: dependencies.customers,
      ...transactional,
    }),
    getCustomer: getCustomerUseCase({ customers: dependencies.customers }),
    createProduct: createProductUseCase({
      products: dependencies.products,
      inventory: dependencies.inventory,
      ids: dependencies.ids,
      clock: dependencies.clock,
      unitOfWork: dependencies.unitOfWork,
    }),
    getProduct: getProductUseCase({
      products: dependencies.products,
      cache: dependencies.cache,
    }),
    listProducts: listProductsUseCase({ products: dependencies.products }),
    addItem: addItemUseCase({
      carts: dependencies.carts,
      products: dependencies.products,
      inventory: dependencies.inventory,
      ids: dependencies.ids,
      clock: dependencies.clock,
    }),
    removeItem: removeItemUseCase({
      carts: dependencies.carts,
      clock: dependencies.clock,
    }),
    getCart: getCartUseCase({ carts: dependencies.carts }),
    createOrder,
    getOrder: getOrderUseCase({ orders: dependencies.orders }),
    cancelOrder,
    processPayment,
    checkout: checkoutUseCase({
      createOrder,
      processPayment,
      cancelOrder,
      idempotency: dependencies.idempotency,
      clock: dependencies.clock,
    }),
    dispatchOutbox: dispatchOutboxUseCase({
      outbox: dependencies.outbox,
      publisher: dependencies.events,
      clock: dependencies.clock,
    }),
  };
}

export function buildControllers(useCases: UseCases): HttpControllers {
  return {
    customers: createCustomerController({
      createCustomer: useCases.createCustomer,
      getCustomer: useCases.getCustomer,
    }),
    products: createProductController({
      createProduct: useCases.createProduct,
      getProduct: useCases.getProduct,
      listProducts: useCases.listProducts,
    }),
    carts: createCartController({
      addItem: useCases.addItem,
      removeItem: useCases.removeItem,
      getCart: useCases.getCart,
    }),
    orders: createOrderController({
      createOrder: useCases.createOrder,
      getOrder: useCases.getOrder,
      cancelOrder: useCases.cancelOrder,
      processPayment: useCases.processPayment,
    }),
    checkout: createCheckoutController({ checkout: useCases.checkout }),
  };
}

export type ContainerOptions = {
  /** `null` keeps the in-memory adapters, which is the default for tests. */
  postgres: { url: string } | null;
  /** `null` keeps the in-memory cache, idempotency, and rate limiter. */
  redis: { url: string } | null;
  /** `null` publishes to stdout and runs no consumer. */
  kafka: {
    brokers: string[];
    clientId: string;
    consumerGroup: string;
  } | null;
  rateLimit: { max: number; windowSeconds: number };
};

export type Container = {
  useCases: UseCases;
  controllers: HttpControllers;
  metrics: Metrics;
  rateLimiter: RateLimiter;
  healthChecks: HealthCheck[];
  /** Connects background consumers. Safe to call once. */
  start(): Promise<void>;
  /** Releases connections in reverse order of acquisition. */
  close(): Promise<void>;
};

/**
 * The single place that decides which adapter each port receives, and the only
 * module that knows every world at once: the application graph, persistence,
 * cache, broker, and metrics.
 *
 * Selection is configuration, not code branching inside the application:
 *
 *   DATABASE_URL → Prisma repositories + serializable unit of work
 *   REDIS_URL    → Redis cache, atomic idempotency, shared rate limiting
 *   KAFKA_BROKERS→ Kafka producer behind the outbox + an idempotent consumer
 */
export async function buildContainer({
  postgres,
  redis,
  kafka,
  rateLimit,
}: ContainerOptions): Promise<Container> {
  const metrics = createMetrics();
  const healthChecks: HealthCheck[] = [];
  const shutdown: (() => Promise<void>)[] = [];

  let persistence: Awaited<ReturnType<typeof buildPrismaPersistence>> | null =
    null;
  let inbox: InboxStore = createInMemoryInboxStore();
  let cache: Cache = createInMemoryCache();
  let idempotency: IdempotencyStore = createInMemoryIdempotencyStore();
  let rateLimiter: RateLimiter = createInMemoryRateLimiter({
    limit: rateLimit.max,
    windowSeconds: rateLimit.windowSeconds,
  });
  let events: EventPublisher = createConsoleEventPublisher();
  let kafkaPublisher: KafkaEventPublisher | null = null;
  let consumer: OrderEventsConsumer | null = null;

  if (postgres !== null) {
    persistence = await buildPrismaPersistence(postgres);
    const connection = persistence;
    inbox = connection.inbox;

    healthChecks.push({ name: "postgres", check: () => connection.check() });
    shutdown.push(() => connection.close());
  }

  if (redis !== null) {
    const connection = await connectRedis(redis.url);

    cache = createRedisCache(connection.client);
    idempotency = createRedisIdempotencyStore(connection.client);
    rateLimiter = createRedisRateLimiter(connection.client, {
      limit: rateLimit.max,
      windowSeconds: rateLimit.windowSeconds,
    });

    healthChecks.push({ name: "redis", check: () => connection.check() });
    shutdown.push(() => connection.close());
  }

  if (kafka !== null) {
    kafkaPublisher = createKafkaEventPublisher({
      brokers: kafka.brokers,
      clientId: kafka.clientId,
    });
    events = kafkaPublisher;

    consumer = createOrderEventsConsumer({
      brokers: kafka.brokers,
      clientId: kafka.clientId,
      groupId: kafka.consumerGroup,
      inbox,
    });

    healthChecks.push({
      name: "kafka",
      check: async () => {
        await kafkaPublisher?.connect();
      },
    });

    shutdown.push(async () => {
      try {
        await consumer?.stop();
      } catch {
        // The consumer may never have connected; disconnecting is best effort.
      }
      await kafkaPublisher?.disconnect();
    });
  }

  const ports: ContainerDependencies =
    persistence === null
      ? { ...buildInMemoryDependencies(), cache, events, idempotency }
      : {
          ...persistence,
          cache,
          clock: createSystemClock(),
          ids: createUuidGenerator(),
          events,
          gateway: createInMemoryPaymentGateway(),
          idempotency,
        };

  const wired = buildUseCases(ports);

  // Metrics wrap outcomes, not layers: the use cases stay unaware of them.
  const useCases: UseCases = {
    ...wired,
    checkout: async (input) => {
      const result = await wired.checkout(input);

      if (result.ok) {
        metrics.recordCheckout(
          result.value.replayed ? "replayed" : "completed",
        );
      } else {
        const outcome =
          result.error.type === "payment_declined"
            ? "declined"
            : result.error.type === "checkout_in_progress"
              ? "in_progress"
              : "failed";

        metrics.recordCheckout(outcome);
      }

      return result;
    },
    dispatchOutbox: async () => {
      const result = await wired.dispatchOutbox();

      if (result.ok) {
        metrics.recordOutboxDelivery(
          result.value.published,
          result.value.failed,
          result.value.deadLettered,
        );
      }

      return result;
    },
  };

  return {
    useCases,
    controllers: buildControllers(useCases),
    metrics,
    rateLimiter,
    healthChecks,

    async start() {
      if (kafka !== null) {
        try {
          await ensureKafkaTopics({
            brokers: kafka.brokers,
            clientId: kafka.clientId,
          });
        } catch (error) {
          console.error(
            "Kafka topic bootstrap failed; relying on auto-create",
            error,
          );
        }
      }

      if (consumer === null) {
        return;
      }

      try {
        await consumer.start();
      } catch (error) {
        // The outbox keeps retrying; a consumer that cannot start should not
        // take the HTTP API down with it.
        console.error(
          "Kafka consumer failed to start; outbox delivery will retry",
          error,
        );
      }
    },

    async close() {
      for (const release of [...shutdown].reverse()) {
        try {
          await release();
        } catch (error) {
          console.error("Shutdown step failed", error);
        }
      }
    },
  };
}
