import assert from "node:assert/strict";
import { test } from "node:test";
import type { Todo } from "../src/domain/entities/todo.js";
import { startTestApi } from "./support/test-api.js";

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

  const unknownId = await fetch(`${api.baseUrl}/api/todos/not-an-object-id`);
  assert.equal(unknownId.status, 404);

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
