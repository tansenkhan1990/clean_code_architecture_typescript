# Clean Architecture Todo API

A small TypeScript backend for learning clean architecture. It exposes a Todo HTTP API and stores data in MongoDB. Docker Compose starts both services and keeps database files in a named volume.

## Run with Docker

Requirements: Docker with the Compose plugin.

```sh
docker compose up --build
```

The API listens on `http://localhost:3000`. MongoDB is available on `localhost:27017` for local development. Compose creates a restricted `readWrite` database user for the API; the root user is only used by MongoDB's health check. The committed credentials are for local learning. Set `MONGO_ROOT_PASSWORD` and `MONGO_APP_PASSWORD` in `.env` before using this setup beyond local learning. Keep the app password URL-safe, or URL-encode it in `MONGODB_URI` when running the API directly.

To stop the services, press `Ctrl+C`. To stop them and delete the database volume, run `docker compose down -v`.

## Run the API directly with Node.js

Requirements: Node.js 22 or newer, npm, and a MongoDB instance.

```sh
npm install
cp .env.example .env
npm run dev
```

The `.env` file connects to MongoDB on `localhost:27017`. Start the database separately, or run only the database container with `docker compose up mongo` in another terminal. If you change the app user's credentials or database name in `.env`, update `MONGODB_URI` too. Use `npm run build && npm start` to run the compiled API. Run `npm test` for the HTTP/API checks; these use an in-memory repository and do not require MongoDB.

## Try the API

Create a Todo:

```sh
curl -i http://localhost:3000/api/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"Read about clean architecture"}'
```

List Todos:

```sh
curl http://localhost:3000/api/todos
```

Fetch, update, or delete one Todo by replacing `<id>` with the id returned when it was created:

```sh
curl http://localhost:3000/api/todos/<id>
curl -X PATCH http://localhost:3000/api/todos/<id> \
  -H 'Content-Type: application/json' \
  -d '{"completed":true}'
curl -i -X DELETE http://localhost:3000/api/todos/<id>
```

`GET /health` returns the service health. Invalid request data receives a `400`, an unknown Todo receives a `404`, and unexpected errors receive a generic `500` response. Todo ids are opaque to clients; the current MongoDB adapter happens to generate ObjectId-shaped ids. Requests include an `X-Request-Id` response header and JSON log line.

## How the architecture fits together

```text
HTTP request
  -> presentation/http (routes, controller, validation)
  -> application/use-cases (the actions the app supports)
  -> domain (Todo model and business rules)
  <- infrastructure/repositories (MongoDB implementation of the application port)
  <- infrastructure/database (connection and index)
```

- **Domain** contains the Todo shape and the title rule (`parseTodoTitle`). Timestamps are `Date` values; ISO strings appear only when a response is serialized. It does not import Express, MongoDB, or persistence contracts.
- **Application** contains one class per action, owns the `TodoRepository` port, enforces domain rules, and throws application errors such as `NotFoundError` and `ValidationError`. `createTodoUseCases` exposes the use cases to the presentation layer. A use case depends on the repository port, so the same action can work with another storage adapter.
- **Infrastructure** implements that interface with the MongoDB driver. Database documents are converted into the domain Todo shape here.
- **Presentation** translates HTTP requests into use-case calls and formats HTTP responses. It owns HTTP-specific errors, and Zod validates request structure at the boundary. Business rules, such as trimming and limiting Todo titles, are enforced by the application through the domain model.
- **`server.ts`** is the composition root: it connects to MongoDB, connects the adapter to the use cases, creates the controller, and starts the server.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `POST` | `/api/todos` | Create a Todo with `{ "title": "..." }` |
| `GET` | `/api/todos` | List all Todos |
| `GET` | `/api/todos/:id` | Get one Todo |
| `PATCH` | `/api/todos/:id` | Update `title` and/or `completed` |
| `DELETE` | `/api/todos/:id` | Delete one Todo |

`title` must contain 1–120 characters. Unknown fields and empty patch bodies are rejected.
