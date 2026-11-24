import type { Todo } from "../../domain/entities/todo.js";
import type { TodoRepository } from "../../domain/ports/todo-repository.js";

export class ListTodos {
  constructor(private readonly todos: TodoRepository) {}

  execute(): Promise<Todo[]> {
    return this.todos.findAll();
  }
}
