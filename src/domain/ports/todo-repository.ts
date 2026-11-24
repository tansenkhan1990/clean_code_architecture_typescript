import type { CreateTodoInput, Todo, UpdateTodoInput } from "../entities/todo.js";

/** The application depends on this contract, not on MongoDB or HTTP. */
export interface TodoRepository {
  create(input: CreateTodoInput): Promise<Todo>;
  findAll(): Promise<Todo[]>;
  findById(id: string): Promise<Todo | undefined>;
  update(id: string, input: UpdateTodoInput): Promise<Todo | undefined>;
  delete(id: string): Promise<boolean>;
}
