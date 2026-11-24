import type { Todo } from "../../domain/entities/todo.js";

/** The HTTP representation of a Todo; keeps the domain model off the wire. */
export interface TodoResponse {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toTodoResponse(todo: Todo): TodoResponse {
  return {
    id: todo.id,
    title: todo.title,
    completed: todo.completed,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
  };
}
