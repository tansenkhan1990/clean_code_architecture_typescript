import { z } from "zod";
import type { CreateTodoCommand, UpdateTodoCommand } from "../../application/todo-commands.js";
import { BadRequestError } from "./http-error.js";

const createTodoSchema = z.object({
  title: z.string(),
}).strict();
const updateTodoSchema = z.object({
  title: z.string().optional(),
  completed: z.boolean().optional(),
}).strict();

/** HTTP request parsing stays in presentation, separate from controller orchestration. */
export function parseCreateTodoRequest(body: unknown): CreateTodoCommand {
  return createTodoSchema.parse(body);
}

export function parseUpdateTodoRequest(body: unknown): UpdateTodoCommand {
  const parsed = updateTodoSchema.parse(body);
  const command: UpdateTodoCommand = {};
  if (parsed.title !== undefined) command.title = parsed.title;
  if (parsed.completed !== undefined) command.completed = parsed.completed;
  return command;
}

export function parseTodoId(id: unknown): string {
  if (typeof id !== "string" || id.length === 0) {
    throw new BadRequestError("Todo id is required.");
  }
  return id;
}
