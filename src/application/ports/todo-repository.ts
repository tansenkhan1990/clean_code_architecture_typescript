import type { Todo } from "../../domain/entities/todo.js";

/** Data the repository needs after a use case has validated a new Todo. */
export interface NewTodo {
  title: string;
}

export interface TodoChanges {
  title?: string;
  completed?: boolean;
}

/** The application owns this port; infrastructure supplies an implementation. */
export interface TodoRepository {
  create(todo: NewTodo): Promise<Todo>;
  findAll(): Promise<Todo[]>;
  findById(id: string): Promise<Todo | undefined>;
  update(id: string, changes: TodoChanges): Promise<Todo | undefined>;
  delete(id: string): Promise<boolean>;
}
