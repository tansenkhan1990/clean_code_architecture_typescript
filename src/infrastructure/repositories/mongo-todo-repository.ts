import { ObjectId, type Collection } from "mongodb";
import type { CreateTodoInput, Todo, UpdateTodoInput } from "../../domain/entities/todo.js";
import type { TodoRepository } from "../../domain/ports/todo-repository.js";

export interface TodoDocument {
  _id: ObjectId;
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toTodo(document: TodoDocument): Todo {
  return {
    id: document._id.toHexString(),
    title: document.title,
    completed: document.completed,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function toObjectId(id: string): ObjectId | undefined {
  return /^[a-f\d]{24}$/i.test(id) ? new ObjectId(id) : undefined;
}

export class MongoTodoRepository implements TodoRepository {
  constructor(private readonly todos: Collection<TodoDocument>) {}

  async create(input: CreateTodoInput): Promise<Todo> {
    const now = new Date();
    const document: TodoDocument = {
      _id: new ObjectId(),
      title: input.title,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.todos.insertOne(document);
    return toTodo(document);
  }

  async findAll(): Promise<Todo[]> {
    const documents = await this.todos.find().sort({ createdAt: -1 }).toArray();
    return documents.map(toTodo);
  }

  async findById(id: string): Promise<Todo | undefined> {
    const objectId = toObjectId(id);
    if (!objectId) return undefined;

    const document = await this.todos.findOne({ _id: objectId });
    return document ? toTodo(document) : undefined;
  }

  async update(id: string, input: UpdateTodoInput): Promise<Todo | undefined> {
    const objectId = toObjectId(id);
    if (!objectId) return undefined;

    const changes: Partial<Pick<TodoDocument, "title" | "completed">> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (input.title !== undefined) changes.title = input.title;
    if (input.completed !== undefined) changes.completed = input.completed;

    const result = await this.todos.updateOne({ _id: objectId }, { $set: changes });
    if (result.matchedCount === 0) return undefined;

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const objectId = toObjectId(id);
    if (!objectId) return false;

    const result = await this.todos.deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }
}
