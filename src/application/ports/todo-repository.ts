import type { Todo } from "../../domain/entities/todo.js";

/** Data the application needs to create or update a Todo through the storage port. */
export interface CreateTodoInput {
  title: string;
}

export interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
}

/** The application owns this port; infrastructure supplies an implementation. */
export interface TodoRepository {
  create(input: CreateTodoInput): Promise<Todo>;
  findAll(): Promise<Todo[]>;
  findById(id: string): Promise<Todo | undefined>;
  update(id: string, input: UpdateTodoInput): Promise<Todo | undefined>;
  delete(id: string): Promise<boolean>;
}
