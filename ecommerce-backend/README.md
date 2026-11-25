# E-commerce Backend

An e-commerce backend that demonstrates Clean Architecture with **functional TypeScript**, plus the operational pieces a real service needs. It covers the full purchase path — registration, login, product, stock, cart, order, payment — with Fastify for HTTP, Zod at the edge, Vitest for tests, PostgreSQL through Prisma at the persistence edge, and no classes and no DI container in the application.

Identity is part of the model, not a route decorator: registration creates the profile and its credential in one transaction, passwords are scrypt-hashed, access tokens are short-lived HS256 JWTs, and authorization (ownership plus roles) is decided by a pure application policy.

Every external dependency sits behind a port with an in-process adapter, so the whole flow runs and is tested with no infrastructure. Real adapters are selected by configuration, without changing a single use case:

| Capability     | In-process default | Production adapter                   |
| -------------- | ------------------ | ------------------------------------ |
| Persistence    | shared maps        | PostgreSQL 16 (Prisma, transactions) |
| Cache          | TTL map            | Redis                                |
| Idempotency    | TTL map + claims   | Redis `SET NX`                       |
| Rate limiting  | fixed window       | Redis + Lua                          |
| Event delivery | stdout publisher   | Kafka producer (via outbox)          |
| Consumer       | —                  | Kafka, idempotent by event id        |
| Passwords      | scrypt (Node)      | scrypt (Node), same format           |
| Access tokens  | HS256 JWT (`jose`) | HS256 JWT, secret from the platform  |
| Metrics        | —                  | Prometheus `/metrics`                |

The second goal is the part most Clean Architecture examples skip: **runtime consistency**. Multi-write workflows have explicit transaction boundaries, events leave through a transactional outbox, checkout is idempotent with an atomic claim, and delivery is at-least-once with an idempotent consumer.

```text
POST   /auth/register          (email, name, password → customer + bearer token)
POST   /auth/login             (email, password → bearer token)
GET    /auth/me                (current profile and role)
GET    /customers/:id          (self or admin)
POST   /products               (admin)
GET    /products               (public)
GET    /products/:id           (public)
GET    /customers/:customerId/cart
POST   /customers/:customerId/cart/items
DELETE /customers/:customerId/cart/items/:productId
POST   /orders
GET    /orders/:id
POST   /orders/:id/cancel
POST   /orders/:id/pay
POST   /checkout               (optional Idempotency-Key header)
GET    /health                 (liveness)
GET    /ready                  (readiness: postgres, redis, kafka)
GET    /metrics                (Prometheus)
```

Everything except `/auth/register`, `/auth/login`, the health/metrics endpoints, and the product catalogue requires `Authorization: Bearer <token>`. A customer may only touch its own cart, orders, and profile; an administrator may act for anyone.

## Quick start

### In-memory, no services

```sh
npm install
BOOTSTRAP_ADMIN_EMAILS=owner@example.com npm run dev
```

The API listens on `http://localhost:3000` (override with `PORT`). With nothing configured, the composition root picks every in-process adapter and state resets on restart. The bootstrap variable is what lets the very first registration create a product; without it every account is a customer.

### Docker: API + PostgreSQL + Redis + Kafka + Prometheus

```sh
docker compose up --build
```

| Service      | What it is                                                         |
| ------------ | ------------------------------------------------------------------ |
| `postgres`   | `postgres:16-alpine`; data in a named volume                       |
| `redis`      | `redis:7-alpine` with AOF persistence                              |
| `kafka`      | `apache/kafka:3.9.0` in KRaft mode, topics created at app start-up |
| `prometheus` | Scrapes `app:3000/metrics` every 15s, UI on `:9090`                |
| `app`        | The API image; runs `prisma migrate deploy`, then serves           |

```sh
docker compose ps
docker compose logs -f app
docker compose down        # keep data
docker compose down -v     # delete data
```

Migrations are versioned SQL under `prisma/migrations/`. The container applies them with `prisma migrate deploy` before the server starts, so a fresh volume converges on the schema in the image. Locally, use `npm run db:migrate` (or `npm run db:migrate:dev` while changing the schema).

The image is a three-stage build (dependencies → compile → runtime), runs as the non-root `node` user, installs production dependencies only, ships `dist/` plus `prisma/` (for migrations), and healthchecks itself with Node's `fetch` (no `curl` in the image).

### Golden path

`owner@example.com` is the bootstrap administrator in `compose.yaml`; for a local run set it with `BOOTSTRAP_ADMIN_EMAILS` as in the quick start.

```sh
SESSION=$(curl -s -X POST localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","name":"Owner","password":"correct horse battery staple"}')

CUSTOMER=$(printf '%s' "$SESSION" | node -pe 'JSON.parse(require("fs").readFileSync(0)).customer.id')
TOKEN=$(printf '%s' "$SESSION" | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken.token')

PRODUCT=$(curl -s -X POST localhost:3000/products \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Mechanical keyboard","price":{"amountInMinorUnits":1999,"currency":"usd"},"availableQuantity":5}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')

curl -s -X POST localhost:3000/customers/$CUSTOMER/cart/items \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"productId\":\"$PRODUCT\",\"quantity\":2}"

curl -s -X POST localhost:3000/checkout \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Idempotency-Key: order-42' \
  -d "{\"customerId\":\"$CUSTOMER\"}"
```

The response contains a `paid` order and a `succeeded` payment, the cart is emptied, and the reserved stock is committed. Logging in again with the same address and password returns a fresh token via `/auth/login`. `order.created` / `order.paid` are written to the outbox in the same transaction, delivered by the worker, and (when Kafka is configured) consumed by the order-events consumer.

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

npm run db:generate                     # regenerate the Prisma client after schema edits
npm run db:migrate                      # apply pending migrations
npm run db:migrate:dev                  # create a migration while developing
npm run admin:grant -- ada@example.com  # grant the admin role to an existing account

docker compose up --build               # everything
docker compose up -d postgres redis kafka          # only the dependencies
docker compose logs -f app
docker compose down -v
```

## Configuration

Parsed once, at the edge (`infrastructure/config/environment.ts`); nothing else reads `process.env`.

| Variable                         | Default                  | Meaning                                                     |
| -------------------------------- | ------------------------ | ----------------------------------------------------------- |
| `PORT`                           | `3000`                   | HTTP port                                                   |
| `NODE_ENV`                       | `development`            | `development \| test \| production`                         |
| `DATABASE_URL`                   | _(unset)_                | Unset → in-memory repositories; set → PostgreSQL            |
| `REDIS_URL`                      | _(unset)_                | Unset → in-process cache/idempotency/limiter; set → Redis   |
| `KAFKA_BROKERS`                  | _(unset)_                | Comma separated; unset → stdout publisher, no consumer      |
| `KAFKA_CLIENT_ID`                | `ecommerce-backend`      | Kafka client id                                             |
| `KAFKA_CONSUMER_GROUP`           | `ecommerce-order-events` | Consumer group                                              |
| `RATE_LIMIT_MAX`                 | `120`                    | Requests per caller per route per window                    |
| `RATE_LIMIT_WINDOW_SECONDS`      | `60`                     | Window length                                               |
| `JWT_SECRET`                     | dev fallback             | HS256 signing secret; **required in production**, ≥32 chars |
| `JWT_ISSUER`                     | `ecommerce-backend`      | Issuer claim, verified on every request                     |
| `JWT_AUDIENCE`                   | `ecommerce-api`          | Audience claim, verified on every request                   |
| `ACCESS_TOKEN_TTL_SECONDS`       | `900`                    | Access token lifetime                                       |
| `AUTH_RATE_LIMIT_MAX`            | `10`                     | Register/login attempts per caller per window               |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS` | `60`                     | Window for the auth budget                                  |
| `BOOTSTRAP_ADMIN_EMAILS`         | _(empty)_                | Comma-separated addresses that register as admin            |
| `OUTBOX_POLL_INTERVAL_MS`        | `1000`                   | Outbox worker poll interval                                 |

From the host, point at the published ports and apply the migrations once:

```sh
docker compose up -d postgres redis kafka
DATABASE_URL="postgresql://app:app@127.0.0.1:5432/ecommerce?schema=public" npm run db:migrate
DATABASE_URL="postgresql://app:app@127.0.0.1:5432/ecommerce?schema=public" \
REDIS_URL="redis://127.0.0.1:6379" \
KAFKA_BROKERS="127.0.0.1:29092" \
npm run dev
```

## Project structure

```text
src/
├── domain/                    entities, value objects, rules, events
│   └── auth/                  account.ts (password policy, roles), role.ts
├── application/
│   ├── auth/                  register/, login/, principal.ts, access-policy.ts
│   ├── customer/ product/ cart/ order/ payment/ checkout/
│   ├── outbox/                stage-event.ts, dispatch-outbox.ts, backoff.ts
│   └── ports/
│       ├── repositories/      account, customer, product, inventory, cart, order, outbox
│       ├── inbox-store.ts     durable consumer dedupe
│       ├── password-hasher.ts, token-service.ts
│       ├── unit-of-work.ts, idempotency-store.ts, rate-limiter.ts
│       ├── payment-gateway.ts, event-publisher.ts, cache.ts
│       └── id-generator.ts, clock.ts
├── infrastructure/
│   ├── config/                environment.ts, config.ts
│   ├── auth/                  scrypt-password-hasher.ts, jwt-token-service.ts
│   ├── http/                  fastify.ts, http-errors.ts, auth-guards.ts,
│   │                          health-routes.ts, rate-limit.ts,
│   │                          controllers/, routes/, schemas/, presenters/
│   ├── persistence/
│   │   ├── in-memory/         store.ts
│   │   ├── repositories/      in-memory-*.ts
│   │   └── prisma/            schema client, mappers, repositories, inbox, deps
│   ├── inbox/                 in-memory-inbox-store.ts
│   ├── transactions/          in-memory-unit-of-work.ts, prisma-unit-of-work.ts
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
    ├── grant-admin.ts         operator command: grant the admin role
    └── server.ts              entry point: config, HTTP, worker, shutdown

prisma/
├── schema.prisma              PostgreSQL models (timestamptz, JSON snapshots)
└── migrations/                versioned SQL, applied by `prisma migrate deploy`

tests/
├── unit/                      domain/, application/, infrastructure/
├── integration/prisma/        real PostgreSQL (gated by DATABASE_TEST_URL)
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

`tests/architecture/dependency-rules.test.ts` reads the sources and fails on a framework import in `domain`/`application` (Fastify, Zod, Prisma, ioredis, KafkaJS, jose, prom-client), an `infrastructure` → `main` import, or `process.env` / `Date.now` / `randomUUID` in the inner layers. The rules survive someone editing the ESLint config. That is why hashing and JWT signing live in `infrastructure/auth` and the application only sees `PasswordHasher` and `TokenService`.

## Authentication and authorization

```text
POST /auth/register ──► password policy (domain) ──► scrypt hash (outside the transaction)
                          │
                          ▼
                    transaction { Customer + Account + customer.registered }
                          │
                          ▼
                    access token (sub, email, role, iss, aud, exp)

request ──► onRequest: verify bearer token ──► request.principal
             │
             ├─ requireAuth      → 401 without a valid token
             ├─ requireAdmin     → 403 for a non-admin
             └─ access policy    → 403 when the principal does not own the resource
```

- **One registration path.** `POST /auth/register` is the only way a customer is created; there is no endpoint that produces a profile without a credential. The profile, the credential row, and the `customer.registered` event commit together, so a half-registered account is impossible.
- **Passwords.** scrypt with `N=2^15, r=8, p=1`, a random 16-byte salt per hash, and parameters embedded in the stored string so the cost can rise later without a migration. Verification uses `timingSafeEqual`. The policy is OWASP's 12-character floor and a 128-character ceiling; no composition rules.
- **No account enumeration.** Unknown address, missing credential, and wrong password all return the same `401 invalid_credentials` message, and a missing account still spends one key derivation.
- **Tokens.** HS256 JWTs with `sub` (customer id), `email`, `role`, plus `iss`/`aud`/`iat`/`exp`. Issuer and audience are verified, the algorithm is pinned, and a 5-second clock tolerance is allowed. Lifetime defaults to 15 minutes (`ACCESS_TOKEN_TTL_SECONDS`). The secret must be at least 32 characters and is **required in production**; development uses an obviously labelled fallback.
- **Roles.** `customer` and `admin`, a closed set in the domain. Self-registration is customer-only, except addresses listed in `BOOTSTRAP_ADMIN_EMAILS` (the first administrator). Later elevation is `npm run admin:grant -- <email>`, which updates the `Account` row. A role change reaches the API at the next login, because the role is carried in the token.
- **Ownership is a business rule.** `application/auth/access-policy.ts` decides whether a principal may act for a customer or read an order; controllers ask it, so the rule is unit-testable and not duplicated across routes. Route guards only answer "is there a principal" and "is it an admin".
- **Credential endpoints are rate limited harder.** Register and login use `AUTH_RATE_LIMIT_MAX` (default 10/min per caller and route) on top of the general limiter, in-process or shared through Redis.
- **Nothing sensitive is echoed.** Responses contain the profile and a token; password hashes never leave the process, and security headers (`nosniff`, `DENY`, `no-referrer`) are set on every response.
- **Refusals are deliberately vague.** A caller who does not own a resource gets `403` with one message that reveals neither the resource nor its owner.

## Transactions

`application/ports/unit-of-work.ts`:

```ts
execute<T, E>(work: () => Promise<Result<T, E>>): Promise<Result<T, E | UnitOfWorkError>>;
```

The work returns a `Result`, and **a failure value rolls back**. Two adapters honour it: the in-memory snapshot (restore on failure, serialised queue) and PostgreSQL (Prisma `$transaction` at serializable isolation; a failure result throws a sentinel so the partial writes are discarded, and `P2034` write conflicts are retried). No use case changes when the adapter changes.

The Prisma adapter propagates the transaction client through an `AsyncLocalStorage`, so repositories join the transaction without the application threading a client argument through every port. The boundary stays explicit at the use case.

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
                          published │ failed → nextAttemptAt (backoff)
                                    │        → dead letter after 5 attempts

Kafka topic (partitioned by order id) ──► consumer group
                                                   │
                                   inbox: INSERT ... ON CONFLICT DO NOTHING
```

- `OutboxMessage` carries a `DomainEvent`, an id, timestamps, `attempts`, `lastError`, `nextAttemptAt`, and `deadLetteredAt` — no topic, header, group, or offset.
- `dispatch-outbox.ts` publishes one message at a time; a failure is durable, retried with exponential backoff (1s, 2s, 4s, 8s, capped at 60s), and dead-lettered after 5 attempts instead of blocking the queue. The worker polls every `OUTBOX_POLL_INTERVAL_MS`.
- The due-message query is `publishedAt IS NULL AND deadLetteredAt IS NULL AND nextAttemptAt <= now`, so backoff survives a restart and a second worker agrees.
- `infrastructure/kafka/kafka-messages.ts` owns the broker vocabulary: topic routing (`ecommerce.orders.v1`, `ecommerce.customers.v1`, catch-all), partition key (order id, then customer id), JSON body, and `x-event-id` / `x-event-name` / `x-event-version` headers.
- `kafka-topics.ts` creates missing topics at start-up, so a consumer never races auto-creation.
- The consumer claims each `x-event-id` in the `ProcessedEvent` table before handling it. A redelivery — after a restart or on another replica — hits the unique key, is acknowledged, and the handler does not run. The port allows the claim to share a transaction with the projection write; today's handler only logs.

## Redis

One connection, three adapters:

- **Cache** — `Cache` port used by `get-product`; JSON values with TTL. A miss or corrupt entry is just a miss.
- **Idempotency** — `SET NX EX` claim plus a TTL record; `save` writes the record and deletes the claim atomically in a `MULTI`.
- **Rate limiting** — `INCR` + `EXPIRE` inside a Lua script so a crash cannot leave a counter without a window.

The in-memory adapters remain the default, which is what lets the unit tests run without Docker; the Redis ones are covered by `tests/integration/redis`.

## Observability and operations

- **`GET /health`** — liveness: the process is up.
- **`GET /ready`** — readiness: pings PostgreSQL (`SELECT 1`), Redis (`PING`), Kafka (producer connect). Returns `503` with a per-dependency report when something is down.
- **`GET /metrics`** — Prometheus: `http_requests_total`, `http_request_duration_seconds` (route pattern, never raw URL), `checkout_total{outcome}`, `outbox_messages_total{result="published|failed|dead_lettered"}`, plus Node defaults. Compose runs Prometheus to scrape it.
- **Request ids** — `x-request-id` is honoured when supplied and echoed on every response, so logs from different services join up.
- **Rate limiting** — a `preHandler` hook keyed by caller IP and route pattern; `x-ratelimit-*` headers on every response, `429` + `Retry-After` when exceeded. Exempt: `/health`, `/ready`, `/metrics`. Fails open if Redis is down (under-limiting beats a total outage).
- **Graceful shutdown** — on `SIGTERM`/`SIGINT`: stop the worker, close HTTP, then close adapters in reverse order.

### Error mapping

| Application error                                                                                                                                                             | HTTP          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `*_not_found`                                                                                                                                                                 | 404           |
| `invalid_credentials`                                                                                                                                                         | 401           |
| `forbidden`                                                                                                                                                                   | 403           |
| `invalid_*` (except `invalid_credentials`)                                                                                                                                    | 400           |
| `insufficient_stock`, `empty_cart`, `email_already_registered`, `order_already_paid`, `order_cancelled`, `item_not_in_cart`, `cart_currency_mismatch`, `checkout_in_progress` | 409           |
| `payment_declined`                                                                                                                                                            | 402           |
| `payment_gateway_unavailable`                                                                                                                                                 | 502           |
| `idempotency_unavailable`                                                                                                                                                     | 503           |
| `transaction_failed`, `payment_requires_reconciliation`, `repository_error`, `outbox_unavailable`                                                                             | 500 (generic) |

Server faults are logged once and answered as `{ "message": "Internal server error" }`; storage, driver, broker, and provider details never reach a client.

## Testing

| Suite        | Path                                                                                | What it proves                                                                          |
| ------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Domain       | `tests/unit/domain/*.test.ts`                                                       | Cart totals, stock reserve/release/commit, pure availability check, order transitions   |
| Application  | `tests/unit/application/checkout.test.ts`                                           | Checkout success, decline compensation, stock conflicts, outbox queueing                |
| Idempotency  | `tests/unit/application/checkout-idempotency.test.ts`                               | Replay, customer scoping, no duplicate events                                           |
| Concurrency  | `tests/unit/application/checkout-concurrency.test.ts`                               | One winner for two simultaneous requests; claim released on failure                     |
| Outbox       | `tests/unit/application/{outbox,outbox-backoff}.test.ts`                            | Published once, backoff schedule, dead letter after 5 attempts, broker-agnostic payload |
| Inbox        | `tests/unit/infrastructure/inbox-store.test.ts`                                     | First delivery wins; redelivery is reported as seen                                     |
| Transactions | `tests/unit/infrastructure/unit-of-work.test.ts`                                    | Commit, rollback, thrown error, rollback inside a real use case                         |
| Adapters     | `tests/unit/infrastructure/{kafka-messages,idempotency-store,rate-limiter}.test.ts` | Topic/partition mapping, claim semantics, window reset                                  |
| Auth domain  | `tests/unit/domain/account.test.ts`                                                 | Password policy, credential shape, role changes                                         |
| Auth cases   | `tests/unit/application/auth.test.ts`                                               | Registration transaction, duplicate refusal, login, enumeration-resistant failures      |
| Auth HTTP    | `tests/e2e/http/auth-flow.test.ts`                                                  | Token round trip, 401/403, admin-only writes, cart/order ownership                      |
| Platform     | `tests/e2e/http/platform-endpoints.test.ts`                                         | Readiness 200/503, metrics, request id echo, 429 + `Retry-After`                        |
| PostgreSQL   | `tests/integration/prisma/prisma-persistence.test.ts`                               | Real transactions (registration included), JSON snapshots, rollback, backoff/DLQ, inbox |
| Redis        | `tests/integration/redis/redis-adapters.test.ts`                                    | Cache TTL, `SET NX` claim, shared limiter                                               |
| Architecture | `tests/architecture/dependency-rules.test.ts`                                       | The dependency rule holds in the sources                                                |
| E2E HTTP     | `tests/e2e/http/checkout-flow.test.ts`                                              | Real routes through `inject`: 201/200/409/404/400, replay header                        |

Integration suites skip automatically unless the URIs are set:

```sh
docker compose up -d postgres redis
docker exec <postgres-container> createdb -U app ecommerce_test   # once
DATABASE_URL="postgresql://app:app@127.0.0.1:5432/ecommerce_test?schema=public" npm run db:migrate
DATABASE_TEST_URL="postgresql://app:app@127.0.0.1:5432/ecommerce_test?schema=public" \
REDIS_TEST_URL="redis://127.0.0.1:6379" \
npm test
```

## CI

`.github/workflows/ci.yml` runs format check, lint, typecheck, tests, build, and `docker build` on Node 22 for every push and pull request.

## Known limitations

- **Dead letters have no operator surface.** They are stored and counted (`outbox_messages_total{result="dead_lettered"}`), but replaying one is a manual SQL update; an admin endpoint is still missing.
- **Inbox rows are kept forever.** Dedupe is correct but unbounded; a retention job needs to delete ids older than the broker's retention window.
- **No reconciliation job.** `payment_requires_reconciliation` is surfaced and logged; nothing retries the commit or refunds the charge yet.
- **Payment is a stub.** `createInMemoryPaymentGateway` approves unless told to decline and remembers charges by idempotency key; a Stripe adapter implements the same port, with webhooks — not the request — confirming payment.
- **No refresh tokens or revocation.** Access tokens are short-lived and stateless; there is no refresh/rotation pair, no logout server-side, and no "revoke all sessions" path. Rotating `JWT_SECRET` invalidates everything at once.
- **No email verification, password reset, or MFA.** Registration trusts the address, and there is no out-of-band channel yet.
- **Role changes lag one login.** The role is a token claim, so an elevation or demotion applies when the current access token expires.
- **HS256 with a shared secret.** Fine for one service; multiple services should move to asymmetric keys (`RS256`/`ES256`) with a published JWKS.
- **Login throttling is per IP and route.** That stops single-source guessing, not a distributed credential-stuffing attack; a per-account counter would be the next step.
- **`/metrics` is unauthenticated.** Keep it on the internal network (or behind the platform's access control); the Prometheus sidecar expects plain HTTP.
- **Single PostgreSQL instance and single Kafka broker.** Enough for correctness on one machine, not for production durability.
- **Metrics, not traces.** Prometheus counters and a scrape config exist; OpenTelemetry spans across HTTP → PostgreSQL → outbox → Kafka do not.

### What to add next

1. **Payment reconciliation** — a job that finds `payment_requires_reconciliation`, re-queries the provider, and commits or refunds.
2. **Session lifecycle** — refresh tokens with rotation and reuse detection, plus a revocation list for logout and incident response.
3. **Account lifecycle** — email verification, password reset, and per-account login throttling.
4. **OpenTelemetry** — spans across HTTP, Prisma, outbox, Kafka, consumer; logs correlated by `x-request-id`.
5. **Grafana** — a provisioned dashboard for checkout outcomes, outbox lag, dead letters, p99 latency, auth failures, rate-limit rejections.
6. **Production deployment** — managed PostgreSQL with backups, multi-broker Kafka, TLS, secrets, horizontal scaling, rollout/rollback.
7. **Retention and admin tooling** — inbox retention and dead-letter replay.
