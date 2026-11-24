import type { Todo, UpdateTodoInput } from "../../domain/entities/todo.js";
import type { TodoRepository } from "../../domain/ports/todo-repository.js";
import { CreateTodo } from "./create-todo.js";
import { DeleteTodo } from "./delete-todo.js";
import { GetTodo } from "./get-todo.js";
import { ListTodos } from "./list-todos.js";
import { UpdateTodo } from "./update-todo.js";

/** The application surface the presentation layer depends on. */
export interface TodoUseCases {
  create(title: string): Promise<Todo>;
  list(): Promise<Todo[]>;
  get(id: string): Promise<Todo>;
  update(id: string, input: UpdateTodoInput): Promise<Todo>;
  delete(id: string): Promise<void>;
}

export function createTodoUseCases(todos: TodoRepository): TodoUseCases {
  const createTodo = new CreateTodo(todos);
  const listTodos = new ListTodos(todos);
  const getTodo = new GetTodo(todos);
  const updateTodo = new UpdateTodo(todos);
  const deleteTodo = new DeleteTodo(todos);

  return {
    create: (title) => createTodo.execute(title),
    list: () => listTodos.execute(),
    get: (id) => getTodo.execute(id),
    update: (id, input) => updateTodo.execute(id, input),
    delete: (id) => deleteTodo.execute(id),
  };
}
