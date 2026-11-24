import type { Request, Response } from "express";
import { z } from "zod";
import type { TodoUseCases } from "../../application/use-cases/todo-use-cases.js";
import type { UpdateTodoInput } from "../../application/ports/todo-repository.js";
import { BadRequestError } from "./http-error.js";

const createTodoSchema = z.object({
  title: z.string(),
}).strict();
const updateTodoSchema = z.object({
  title: z.string().optional(),
  completed: z.boolean().optional(),
}).strict();

export class TodoController {
  constructor(private readonly useCases: TodoUseCases) {}

  create = async (request: Request, response: Response): Promise<void> => {
    const input = createTodoSchema.parse(request.body);
    response.status(201).json(await this.useCases.create(input.title));
  };

  list = async (_request: Request, response: Response): Promise<void> => {
    response.json(await this.useCases.list());
  };

  get = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.useCases.get(this.parseId(request.params.id)));
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const parsedInput = updateTodoSchema.parse(request.body);
    const input: UpdateTodoInput = {};
    if (parsedInput.title !== undefined) input.title = parsedInput.title;
    if (parsedInput.completed !== undefined) input.completed = parsedInput.completed;
    response.json(await this.useCases.update(this.parseId(request.params.id), input));
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    await this.useCases.delete(this.parseId(request.params.id));
    response.status(204).end();
  };

  private parseId(id: string | string[] | undefined): string {
    if (typeof id !== "string" || id.length === 0) {
      throw new BadRequestError("Todo id is required.");
    }
    return id;
  }
}
