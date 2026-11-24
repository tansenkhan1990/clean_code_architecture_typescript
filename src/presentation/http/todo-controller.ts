import type { Request, Response } from "express";
import type { TodoUseCases } from "../../application/use-cases/todo-use-cases.js";
import {
  parseCreateTodoRequest,
  parseTodoId,
  parseUpdateTodoRequest,
} from "./todo-request.js";
import { toTodoResponse } from "./todo-response.js";

/** Translates HTTP requests into application calls and formats HTTP responses. */
export class TodoController {
  constructor(private readonly useCases: TodoUseCases) {}

  create = async (request: Request, response: Response): Promise<void> => {
    const command = parseCreateTodoRequest(request.body);
    const todo = await this.useCases.create(command);
    response.status(201).json(toTodoResponse(todo));
  };

  list = async (_request: Request, response: Response): Promise<void> => {
    const todos = await this.useCases.list();
    response.json(todos.map(toTodoResponse));
  };

  get = async (request: Request, response: Response): Promise<void> => {
    const todo = await this.useCases.get(parseTodoId(request.params.id));
    response.json(toTodoResponse(todo));
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const id = parseTodoId(request.params.id);
    const command = parseUpdateTodoRequest(request.body);
    const todo = await this.useCases.update(id, command);
    response.json(toTodoResponse(todo));
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    await this.useCases.delete(parseTodoId(request.params.id));
    response.status(204).end();
  };
}
