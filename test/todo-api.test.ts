import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import type { CreateTodoInput, Todo, UpdateTodoInput } from "../src/domain/entities/todo.js";
import type { TodoRepository } from "../src/domain/ports/todo-repository.js";
import { createTodoUseCases } from "../src/application/use-cases/todo-use-cases.js";
import { createApp } from "../src/presentation/http/app.js";
import { TodoController } from "../src/presentation/http/todo-controller.js";

class InMemoryTodoRepository implements TodoRepository {
  private readonly todos = new Map<string, Todo>();
  private nextId = 1;

  async create(input: CreateTodoInput): Promise<Todo> {
    const now = new Date();
    const todo: Todo = {
      id: this.nextId.toString(16).padStart(24, "0"),
      title: input.title,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    this.nextId += 1;
    this.todos.set(todo.id, todo);
    return todo;
  }

  async findAll(): Promise<Todo[]> {
    return [...this.todos.values()];
  }

  async findById(id: string): Promise<Todo | undefined> {
    return this.todos.get(id);
  }

  async update(id: string, input: UpdateTodoInput): Promise<Todo | undefined> {
    const current = this.todos.get(id);
    if (!current) return undefined;

    const updated: Todo = {
      ...current,
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.completed === undefined ? {} : { completed: input.completed }),
      updatedAt: new Date(),
    };
    this.todos.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.todos.delete(id);
  }
}

async function startTestApi(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const repository = new InMemoryTodoRepository();
  const controller = new TodoController(createTodoUseCases(repository));

  const server = createApp(controller).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

test("Todo API validates input and supports the CRUD flow", async (context) => {
  const api = await startTestApi();
  context.after(api.close);

  const invalidCreate = await fetch(`${api.baseUrl}/api/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "   " }),
  });
  assert.equal(invalidCreate.status, 400);
  assert.ok(invalidCreate.headers.get("x-request-id"));

  const createResponse = await fetch(`${api.baseUrl}/api/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "  Learn clean architecture  " }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json() as Todo;
  assert.equal(created.title, "Learn clean architecture");
  assert.equal(created.completed, false);
  assert.match(created.id, /^[a-f\d]{24}$/i);

  const getResponse = await fetch(`${api.baseUrl}/api/todos/${created.id}`);
  assert.equal(getResponse.status, 200);
  assert.deepEqual(await getResponse.json(), created);

  const updateResponse = await fetch(`${api.baseUrl}/api/todos/${created.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed: true }),
  });
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json() as Todo).completed, true);

  const listResponse = await fetch(`${api.baseUrl}/api/todos`);
  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json() as Todo[]).length, 1);

  const invalidId = await fetch(`${api.baseUrl}/api/todos/not-an-object-id`);
  assert.equal(invalidId.status, 400);

  const deleteResponse = await fetch(`${api.baseUrl}/api/todos/${created.id}`, { method: "DELETE" });
  assert.equal(deleteResponse.status, 204);

  const missingTodo = await fetch(`${api.baseUrl}/api/todos/${created.id}`);
  assert.equal(missingTodo.status, 404);
});

test("Todo API reports malformed JSON as a client error", async (context) => {
  const api = await startTestApi();
  context.after(api.close);

  const response = await fetch(`${api.baseUrl}/api/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid json",
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "INVALID_JSON");
});
