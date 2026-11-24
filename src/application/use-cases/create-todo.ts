import { parseTodoTitle, type Todo } from "../../domain/entities/todo.js";
import type { TodoRepository } from "../../domain/ports/todo-repository.js";
import { ValidationError } from "../errors/application-error.js";

export class CreateTodo {
  constructor(private readonly todos: TodoRepository) {}

  execute(title: string): Promise<Todo> {
    const parsedTitle = parseTodoTitle(title);
    if (!parsedTitle.valid) throw new ValidationError(parsedTitle.message);

    return this.todos.create({ title: parsedTitle.title });
  }
}
