import type { Todo } from "../../domain/entities/todo.js";
import { NotFoundError } from "../errors/application-error.js";
import type { TodoRepository } from "../ports/todo-repository.js";

export class GetTodo {
  constructor(private readonly todos: TodoRepository) {}

  async execute(id: string): Promise<Todo> {
    const todo = await this.todos.findById(id);
    if (!todo) throw new NotFoundError("Todo");
    return todo;
  }
}
