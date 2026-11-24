import { parseTodoTitle, type Todo } from "../../domain/entities/todo.js";
import type { TodoRepository } from "../ports/todo-repository.js";
import type { CreateTodoCommand } from "../todo-commands.js";
import { ValidationError } from "../errors/application-error.js";

export class CreateTodo {
  constructor(private readonly todos: TodoRepository) {}

  execute(input: CreateTodoCommand): Promise<Todo> {
    const parsedTitle = parseTodoTitle(input.title);
    if (!parsedTitle.valid) throw new ValidationError(parsedTitle.message);

    return this.todos.create({ title: parsedTitle.title });
  }
}
