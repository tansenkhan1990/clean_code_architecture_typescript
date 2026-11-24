import type { Todo, UpdateTodoInput } from "../../domain/entities/todo.js";
import { NotFoundError } from "../../domain/errors/app-error.js";
import type { TodoRepository } from "../../domain/ports/todo-repository.js";

export class UpdateTodo {
  constructor(private readonly todos: TodoRepository) {}

  async execute(id: string, input: UpdateTodoInput): Promise<Todo> {
    const todo = await this.todos.update(id, input);
    if (!todo) throw new NotFoundError("Todo");
    return todo;
  }
}
