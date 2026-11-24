import type { Todo } from "../../src/domain/entities/todo.js";
import type {
  NewTodo,
  TodoRepository,
  TodoChanges,
} from "../../src/application/ports/todo-repository.js";

export class InMemoryTodoRepository implements TodoRepository {
  private readonly todos = new Map<string, Todo>();
  private nextId = 1;

  async create(input: NewTodo): Promise<Todo> {
    const now = new Date();
    const todo: Todo = {
      id: this.nextId.toString(16).padStart(24, "0"),
      title: input.title,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    this.nextId += 1;
    this.todos.set(todo.id, todo);
    return todo;
  }

  async findAll(): Promise<Todo[]> {
    return [...this.todos.values()];
  }

  async findById(id: string): Promise<Todo | undefined> {
    return this.todos.get(id);
  }

  async update(id: string, input: TodoChanges): Promise<Todo | undefined> {
    const current = this.todos.get(id);
    if (!current) return undefined;

    const updated: Todo = {
      ...current,
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.completed === undefined ? {} : { completed: input.completed }),
      updatedAt: new Date(),
    };
    this.todos.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.todos.delete(id);
  }
}
