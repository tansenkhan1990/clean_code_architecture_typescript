import { parseTodoTitle, type Todo } from "../../domain/entities/todo.js";
import type { TodoRepository, UpdateTodoInput } from "../ports/todo-repository.js";
import { NotFoundError, ValidationError } from "../errors/application-error.js";

export class UpdateTodo {
  constructor(private readonly todos: TodoRepository) {}

  async execute(id: string, input: UpdateTodoInput): Promise<Todo> {
    const changes: UpdateTodoInput = {};
    if (input.title !== undefined) {
      const parsedTitle = parseTodoTitle(input.title);
      if (!parsedTitle.valid) throw new ValidationError(parsedTitle.message);
      changes.title = parsedTitle.title;
    }
    if (input.completed !== undefined) changes.completed = input.completed;
    if (Object.keys(changes).length === 0) {
      throw new ValidationError("Provide at least one field to update.");
    }

    const todo = await this.todos.update(id, changes);
    if (!todo) throw new NotFoundError("Todo");
    return todo;
  }
}
