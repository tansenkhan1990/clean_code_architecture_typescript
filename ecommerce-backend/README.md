# E-commerce Backend

An e-commerce backend that demonstrates Clean Architecture with **functional TypeScript**, plus the operational pieces a real service needs. It covers the full purchase path — customer, product, stock, cart, order, payment — with Fastify for HTTP, Zod at the edge, Vitest for tests, and no classes, no ORM, and no DI container.

Every external dependency sits behind a port with an in-process adapter, so the whole flow runs and is tested with no infrastructure. Real adapters are selected by configuration, without changing a single use case:

| Capability     | In-process default | Production adapter            |
| -------------- | ------------------ | ----------------------------- |
| Persistence    | shared maps        | MongoDB (transactions)        |
| Cache          | TTL map            | Redis                         |
| Idempotency    | TTL map + claims   | Redis `SET NX`                |
| Rate limiting  | fixed window       | Redis + Lua                   |
| Event delivery | stdout publisher   | Kafka producer (via outbox)   |
| Consumer       | —                  | Kafka, idempotent by event id |
| Metrics        | —                  | Prometheus `/metrics`         |

The second goal is the part most Clean Architecture examples skip: **runtime consistency**. Multi-write workflows have explicit transaction boundaries, events leave through a transactional outbox, checkout is idempotent with an atomic claim, and delivery is at-least-once with an idempotent consumer.

```text
POST   /customers
GET    /customers/:id
POST   /products
GET    /products
GET    /products/:id
GET    /customers/:customerId/cart
POST   /customers/:customerId/cart/items
DELETE /customers/:customerId/cart/items/:productId
POST   /orders
GET    /orders/:id
POST   /orders/:id/cancel
POST   /orders/:id/pay
POST   /checkout              (optional Idempotency-Key header)
GET    /health                (liveness)
GET    /ready                 (readiness: mongodb, redis, kafka)
GET    /metrics               (Prometheus)
```

## Quick start

### In-memory, no services

```sh
npm install
npm run dev
```

The API listens on `http://localhost:3000` (override with `PORT`). With nothing configured, the composition root picks every in-process adapter and state resets on restart.

### Docker: API + MongoDB + Redis + Kafka + Prometheus

```sh
docker compose up --build
```

| Service      | What it is                                                             |
| ------------ | ---------------------------------------------------------------------- |
| `mongo`      | `mongo:7` as a single-node replica set (`rs0`); data in a named volume |
| `mongo-init` | One-shot `rs.initiate(...)`, then exits                                |
| `redis`      | `redis:7-alpine` with AOF persistence                                  |
| `kafka`      | `apache/kafka:3.9.0` in KRaft mode, topics created at app start-up     |
| `prometheus` | Scrapes `app:3000/metrics` every 15s, UI on `:9090`                    |
| `app`        | The API image, wired to all of the above                               |

```sh
docker compose ps
docker compose logs -f app
docker compose down        # keep data
docker compose down -v     # delete data
```

MongoDB transactions require a replica set, which is why `mongo` starts with `--replSet rs0` and `mongo-init` exists. Forgetting that is the most common reason `startTransaction` fails locally.

The image is a three-stage build (dependencies → compile → runtime), runs as the non-root `node` user, installs production dependencies only, ships only `dist/`, and healthchecks itself with Node's `fetch` (no `curl` in the image).

### Golden path

```sh
CUSTOMER=$(curl -s -X POST localhost:3000/customers \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","name":"Ada"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')

PRODUCT=$(curl -s -X POST localhost:3000/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Mechanical keyboard","price":{"amountInMinorUnits":1999,"currency":"usd"},"availableQuantity":5}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')

curl -s -X POST localhost:3000/customers/$CUSTOMER/cart/items \
  -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$PRODUCT\",\"quantity\":2}"

curl -s -X POST localhost:3000/checkout \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: order-42' \
  -d "{\"customerId\":\"$CUSTOMER\"}"
```

The response contains a `paid` order and a `succeeded` payment, the cart is emptied, and the reserved stock is committed. `order.created` / `order.paid` are written to the outbox in the same transaction, delivered by the worker, and (when Kafka is configured) consumed by the order-events consumer.

Repeating the same `Idempotency-Key` returns the original order with `200`, an `idempotent-replay: true` header, and `"replayed": true`. Firing two requests with the same _new_ key simultaneously yields one `201` and one `409 checkout_in_progress` — never two charges.

## Commands

```sh
npm run dev         # tsx watch src/main/server.ts
npm run build       # tsc -p tsconfig.build.json (cleans dist first)
npm start           # run compiled dist/main/server.js
npm test            # vitest run (integration suites skip without a URI)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run format      # prettier --write .
npm run format:check

docker compose up --build               # everything
docker compose up -d mongo mongo-init redis kafka   # only the dependencies
docker compose logs -f app
docker compose down -v
```

## Configuration

Parsed once, at the edge (`infrastructure/config/environment.ts`); nothing else reads `process.env`.

| Variable                    | Default                  | Meaning                                                   |
| --------------------------- | ------------------------ | --------------------------------------------------------- |
| `PORT`                      | `3000`                   | HTTP port                                                 |
| `NODE_ENV`                  | `development`            | `development \| test \| production`                       |
| `MONGODB_URI`               | _(unset)_                | Unset → in-memory repositories; set → MongoDB             |
| `MONGODB_DATABASE`          | `ecommerce`              | Database name                                             |
| `REDIS_URL`                 | _(unset)_                | Unset → in-process cache/idempotency/limiter; set → Redis |
| `KAFKA_BROKERS`             | _(unset)_                | Comma separated; unset → stdout publisher, no consumer    |
| `KAFKA_CLIENT_ID`           | `ecommerce-backend`      | Kafka client id                                           |
| `KAFKA_CONSUMER_GROUP`      | `ecommerce-order-events` | Consumer group                                            |
| `RATE_LIMIT_MAX`            | `120`                    | Requests per caller per route per window                  |
| `RATE_LIMIT_WINDOW_SECONDS` | `60`                     | Window length                                             |
| `OUTBOX_POLL_INTERVAL_MS`   | `1000`                   | Outbox worker poll interval                               |

From the host, connect to Mongo with `directConnection=true`, because the replica set advertises its container hostname:

```sh
docker compose up -d mongo mongo-init redis kafka
MONGODB_URI="mongodb://127.0.0.1:27017/ecommerce?directConnection=true" \
REDIS_URL="redis://127.0.0.1:6379" \
KAFKA_BROKERS="127.0.0.1:29092" \
npm run dev
```

## Project structure

```text
src/
├── domain/                    entities, value objects, rules, events
├── application/
│   ├── customer/ product/ cart/ order/ payment/ checkout/
│   ├── outbox/                stage-event.ts, dispatch-outbox.ts
│   └── ports/
│       ├── repositories/      customer, product, inventory, cart, order, outbox
│       ├── unit-of-work.ts, idempotency-store.ts, rate-limiter.ts
│       ├── payment-gateway.ts, event-publisher.ts, cache.ts
│       └── id-generator.ts, clock.ts
├── infrastructure/
│   ├── config/                environment.ts, config.ts
│   ├── http/                  fastify.ts, http-errors.ts, health-routes.ts,
│   │                          rate-limit.ts, controllers/, routes/, schemas/, presenters/
│   ├── persistence/
│   │   ├── in-memory/         store.ts
│   │   ├── repositories/      in-memory-*.ts
│   │   └── mongo/             documents+mappers, repositories, session, unit of work
│   ├── transactions/          in-memory-unit-of-work.ts
│   ├── outbox/                outbox-worker.ts
│   ├── kafka/                 kafka-messages.ts, kafka-topics.ts,
│   │                          kafka-event-publisher.ts, order-events-consumer.ts
│   ├── redis/                 redis-client.ts, cache, idempotency, rate limiter
│   ├── rate-limit/            in-memory-rate-limiter.ts
│   ├── idempotency/           in-memory-idempotency-store.ts
│   ├── observability/         metrics.ts
│   ├── health/                health-check.ts
│   ├── cache/                 in-memory-cache.ts
│   ├── events/                console-event-publisher.ts
│   ├── payments/              in-memory-payment-gateway.ts
│   └── system/                system-clock.ts, uuid-generator.ts
└── main/
    ├── container.ts           composition root: adapters → use cases → controllers
    └── server.ts              entry point: config, HTTP, worker, shutdown

tests/
├── unit/                      domain/, application/, infrastructure/
├── integration/mongo/         real MongoDB (gated by MONGODB_TEST_URI)
├── integration/redis/         real Redis (gated by REDIS_TEST_URL)
├── e2e/http/                  Fastify inject: flow, platform endpoints
├── architecture/              dependency rule read from the sources
└── support/                   test environment

docker/prometheus/prometheus.yml
.github/workflows/ci.yml
Dockerfile, compose.yaml, .dockerignore
```

## The dependency rule

| Layer            | May import                        | May **not** import                                            |
| ---------------- | --------------------------------- | ------------------------------------------------------------- |
| `domain`         | `domain`                          | `application`, `infrastructure`, `main`, frameworks, `node:*` |
| `application`    | `application`, `domain`           | `infrastructure`, `main`, frameworks, `node:*`                |
| `infrastructure` | `application`, `domain`, adapters | `main`                                                        |
| `main`           | anything inward                   | anything outside the graph; no business rules                 |

`tests/architecture/dependency-rules.test.ts` reads the sources and fails on a framework import in `domain`/`application` (Fastify, Zod, MongoDB, ioredis, KafkaJS, prom-client), an `infrastructure` → `main` import, or `process.env` / `Date.now` / `randomUUID` in the inner layers. The rules survive someone editing the ESLint config.

## Transactions

`application/ports/unit-of-work.ts`:

```ts
execute<T, E>(work: () => Promise<Result<T, E>>): Promise<Result<T, E | UnitOfWorkError>>;
```

The work returns a `Result`, and **a failure value rolls back**. Two adapters honour it: the in-memory snapshot (restore on failure, serialised queue) and MongoDB (snapshot reads, majority writes, abort on failure, retries on `TransientTransactionError` / `WriteConflict`). No use case changes when the adapter changes.

The MongoDB adapter propagates its session through an `AsyncLocalStorage`, so repositories join the transaction without the application threading a session argument through every port. The boundary stays explicit at the use case.

## Checkout, idempotency, and concurrency

```text
POST /checkout
      │
      ├─ key? ──► stored outcome? ──► replay (200, idempotent-replay: true)
      │      └──► acquire key ──► busy? ──► 409 checkout_in_progress
      │
      ▼
create-order ──► transaction { reserve stock, snapshot prices, clear cart, queue order.created }
      │
      ▼
process-payment ──► charge (outside the transaction, provider idempotency key)
      │
 success ────┤──── decline
   │                │
   ▼                ▼
commit stock     cancel-order ──► transaction { release stock, queue order.cancelled }
+ order.paid
```

- The key is scoped `checkout:<customerId>:<key>`, so customers cannot collide.
- Only successful outcomes are stored (24h). A decline is a real answer, so the claim is released and the caller may retry.
- The claim is atomic: the in-memory store checks and writes without yielding; Redis uses `SET NX EX`. Two simultaneous requests cannot both charge.
- If the store fails on lookup, checkout **fails closed** with `503 idempotency_unavailable`.
- A successful charge whose local commit fails returns `payment_requires_reconciliation` — surfaced, never silently retried.

## The outbox and Kafka

```text
transaction { state + outbox row } ──commit──► outbox worker
                                                   │
                                     dispatch primitive (at-least-once)
                                                   │
                                   EventPublisher ─┴─► stdout | Kafka producer
                                                   │
                                     mark published / record lastError + retry

Kafka topic (partitioned by order id) ──► consumer group (dedupes x-event-id)
```

- `OutboxMessage` carries a `DomainEvent`, an id, timestamps, `attempts`, `lastError` — no topic, header, group, or offset.
- `dispatch-outbox.ts` publishes one message at a time, records failures, and continues; the worker polls every `OUTBOX_POLL_INTERVAL_MS`.
- `infrastructure/kafka/kafka-messages.ts` owns the broker vocabulary: topic routing (`ecommerce.orders.v1`, `ecommerce.customers.v1`, catch-all), partition key (order id, then customer id), JSON body, and `x-event-id` / `x-event-name` / `x-event-version` headers.
- `kafka-topics.ts` creates missing topics at start-up, so a consumer never races auto-creation.
- The consumer subscribes to the order and customer topics and deduplicates by `x-event-id`, because delivery is at-least-once. Its seen-set is per-process and bounded; a real projection persists processed ids in the same transaction as the projection update.

## Redis

One connection, three adapters:

- **Cache** — `Cache` port used by `get-product`; JSON values with TTL. A miss or corrupt entry is just a miss.
- **Idempotency** — `SET NX EX` claim plus a TTL record; `save` writes the record and deletes the claim atomically in a `MULTI`.
- **Rate limiting** — `INCR` + `EXPIRE` inside a Lua script so a crash cannot leave a counter without a window.

The in-memory adapters remain the default, which is what lets the unit tests run without Docker; the Redis ones are covered by `tests/integration/redis`.

## Observability and operations

- **`GET /health`** — liveness: the process is up.
- **`GET /ready`** — readiness: pings MongoDB (`ping`), Redis (`PING`), Kafka (producer connect). Returns `503` with a per-dependency report when something is down.
- **`GET /metrics`** — Prometheus: `http_requests_total`, `http_request_duration_seconds` (route pattern, never raw URL), `checkout_total{outcome}`, `outbox_messages_total{result}`, plus Node defaults. Compose runs Prometheus to scrape it.
- **Request ids** — `x-request-id` is honoured when supplied and echoed on every response, so logs from different services join up.
- **Rate limiting** — a `preHandler` hook keyed by caller IP and route pattern; `x-ratelimit-*` headers on every response, `429` + `Retry-After` when exceeded. Exempt: `/health`, `/ready`, `/metrics`. Fails open if Redis is down (under-limiting beats a total outage).
- **Graceful shutdown** — on `SIGTERM`/`SIGINT`: stop the worker, close HTTP, then close adapters in reverse order.

### Error mapping

| Application error                                                                                                                                                             | HTTP          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `*_not_found`                                                                                                                                                                 | 404           |
| `invalid_*`                                                                                                                                                                   | 400           |
| `insufficient_stock`, `empty_cart`, `email_already_registered`, `order_already_paid`, `order_cancelled`, `item_not_in_cart`, `cart_currency_mismatch`, `checkout_in_progress` | 409           |
| `payment_declined`                                                                                                                                                            | 402           |
| `payment_gateway_unavailable`                                                                                                                                                 | 502           |
| `idempotency_unavailable`                                                                                                                                                     | 503           |
| `transaction_failed`, `payment_requires_reconciliation`, `repository_error`, `outbox_unavailable`                                                                             | 500 (generic) |

Server faults are logged once and answered as `{ "message": "Internal server error" }`; storage, driver, broker, and provider details never reach a client.

## Testing

| Suite        | Path                                                                                                | What it proves                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Domain       | `tests/unit/domain/*.test.ts`                                                                       | Cart totals, stock reserve/release/commit, pure availability check, order transitions |
| Application  | `tests/unit/application/checkout.test.ts`                                                           | Checkout success, decline compensation, stock conflicts, outbox queueing              |
| Idempotency  | `tests/unit/application/checkout-idempotency.test.ts`                                               | Replay, customer scoping, no duplicate events                                         |
| Concurrency  | `tests/unit/application/checkout-concurrency.test.ts`                                               | One winner for two simultaneous requests; claim released on failure                   |
| Outbox       | `tests/unit/application/outbox.test.ts`                                                             | Pending → published once, failure recorded and retried, broker-agnostic payload       |
| Transactions | `tests/unit/infrastructure/unit-of-work.test.ts`                                                    | Commit, rollback, thrown error, rollback inside a real use case                       |
| Adapters     | `tests/unit/infrastructure/{mongo-documents,kafka-messages,idempotency-store,rate-limiter}.test.ts` | Mappers, topic/partition mapping, claim semantics, window reset                       |
| Platform     | `tests/e2e/http/platform-endpoints.test.ts`                                                         | Readiness 200/503, metrics, request id echo, 429 + `Retry-After`                      |
| MongoDB      | `tests/integration/mongo/mongodb.test.ts`                                                           | Real transactions, outbox atomicity, rollback, idempotent replay                      |
| Redis        | `tests/integration/redis/redis-adapters.test.ts`                                                    | Cache TTL, `SET NX` claim, shared limiter                                             |
| Architecture | `tests/architecture/dependency-rules.test.ts`                                                       | The dependency rule holds in the sources                                              |
| E2E HTTP     | `tests/e2e/http/checkout-flow.test.ts`                                                              | Real routes through `inject`: 201/200/409/404/400, replay header                      |

Integration suites skip automatically unless the URIs are set:

```sh
docker compose up -d mongo mongo-init redis
MONGODB_TEST_URI="mongodb://127.0.0.1:27017/ecommerce_test?directConnection=true" \
REDIS_TEST_URL="redis://127.0.0.1:6379" \
npm test
```

## CI

`.github/workflows/ci.yml` runs format check, lint, typecheck, tests, build, and `docker build` on Node 22 for every push and pull request.

## Known limitations

- **At-least-once delivery without a dead-letter queue.** Failed outbox rows retry every poll; a poison message would retry forever. `nextAttemptAt` + a DLQ after N attempts is the next step.
- **Consumer dedupe is per-process.** Restarting replays recent events to the handler; a real projection needs an inbox table written in the same transaction.
- **No reconciliation job.** `payment_requires_reconciliation` is surfaced and logged; nothing retries the commit or refunds the charge yet.
- **Payment is a stub.** `createInMemoryPaymentGateway` approves unless told to decline and remembers charges by idempotency key; a Stripe adapter implements the same port, with webhooks — not the request — confirming payment.
- **No auth.** There are no identity or authorization rules, so nothing could honestly be enforced.
- **No migrations.** Mongo collections and indexes are created at start-up; schema changes have no versioned migration yet.
- **Single-node MongoDB replica set and single Kafka broker.** Enough for correctness on one machine, not for production durability.
- **Metrics, not traces.** Prometheus counters and a scrape config exist; OpenTelemetry spans across HTTP → Mongo → outbox → Kafka do not.

### What to add next

1. **Stripe** — webhook confirmation, provider idempotency keys, refunds, reconciliation job.
2. **Outbox hardening** — backoff, `nextAttemptAt`, DLQ, and an inbox table for consumers.
3. **Auth** — JWT/cookie authentication at the HTTP boundary, authorization rules in the application.
4. **OpenTelemetry** — spans across HTTP, Mongo, outbox, Kafka, consumer; logs correlated by `x-request-id`.
5. **Grafana dashboard** — checkout outcomes, outbox lag, p99 latency, rate-limit rejections.
6. **Migrations + seed scripts** — versioned indexes/collections, deterministic demo data.
