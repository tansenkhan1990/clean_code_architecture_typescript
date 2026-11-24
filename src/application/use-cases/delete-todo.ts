import { NotFoundError } from "../../domain/errors/app-error.js";
import type { TodoRepository } from "../../domain/ports/todo-repository.js";

export class DeleteTodo {
  constructor(private readonly todos: TodoRepository) {}

  async execute(id: string): Promise<void> {
    if (!(await this.todos.delete(id))) throw new NotFoundError("Todo");
  }
}
