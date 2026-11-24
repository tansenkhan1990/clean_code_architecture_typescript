import type { Todo } from "../../domain/entities/todo.js";
import type { TodoRepository } from "../../domain/ports/todo-repository.js";

export class CreateTodo {
  constructor(private readonly todos: TodoRepository) {}

  execute(title: string): Promise<Todo> {
    return this.todos.create({ title });
  }
}
