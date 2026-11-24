import type { Request, Response } from "express";
import { z } from "zod";
import { BadRequestError } from "../../domain/errors/app-error.js";
import type { UpdateTodoInput } from "../../domain/entities/todo.js";
import type { CreateTodo } from "../../application/use-cases/create-todo.js";
import type { DeleteTodo } from "../../application/use-cases/delete-todo.js";
import type { GetTodo } from "../../application/use-cases/get-todo.js";
import type { ListTodos } from "../../application/use-cases/list-todos.js";
import type { UpdateTodo } from "../../application/use-cases/update-todo.js";

const idSchema = z.string().regex(/^[a-f\d]{24}$/i);
const createTodoSchema = z.object({
  title: z.string().trim().min(1).max(120),
}).strict();
const updateTodoSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  completed: z.boolean().optional(),
}).strict().refine((input) => Object.keys(input).length > 0, {
  message: "Provide at least one field to update.",
});

export interface TodoUseCases {
  create: CreateTodo;
  list: ListTodos;
  get: GetTodo;
  update: UpdateTodo;
  delete: DeleteTodo;
}

export class TodoController {
  constructor(private readonly useCases: TodoUseCases) {}

  create = async (request: Request, response: Response): Promise<void> => {
    const input = createTodoSchema.parse(request.body);
    response.status(201).json(await this.useCases.create.execute(input.title));
  };

  list = async (_request: Request, response: Response): Promise<void> => {
    response.json(await this.useCases.list.execute());
  };

  get = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.useCases.get.execute(this.parseId(request.params.id)));
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const parsedInput = updateTodoSchema.parse(request.body);
    const input: UpdateTodoInput = {};
    if (parsedInput.title !== undefined) input.title = parsedInput.title;
    if (parsedInput.completed !== undefined) input.completed = parsedInput.completed;
    response.json(await this.useCases.update.execute(this.parseId(request.params.id), input));
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    await this.useCases.delete.execute(this.parseId(request.params.id));
    response.status(204).end();
  };

  private parseId(id: string | string[] | undefined): string {
    if (typeof id !== "string") throw new BadRequestError("Todo id must be a valid MongoDB ObjectId.");
    const result = idSchema.safeParse(id);
    if (!result.success) throw new BadRequestError("Todo id must be a valid MongoDB ObjectId.");
    return result.data;
  }
}
