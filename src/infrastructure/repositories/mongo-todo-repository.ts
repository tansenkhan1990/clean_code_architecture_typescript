import { ObjectId, type Collection, type Db } from "mongodb";
import type { Todo } from "../../domain/entities/todo.js";
import type {
  NewTodo,
  TodoRepository,
  TodoChanges,
} from "../../application/ports/todo-repository.js";

export interface TodoDocument {
  _id: ObjectId;
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TODOS_COLLECTION = "todos";

function toTodo(document: TodoDocument): Todo {
  return {
    id: document._id.toHexString(),
    title: document.title,
    completed: document.completed,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function toObjectId(id: string): ObjectId | undefined {
  return /^[a-f\d]{24}$/i.test(id) ? new ObjectId(id) : undefined;
}

export class MongoTodoRepository implements TodoRepository {
  private readonly todos: Collection<TodoDocument>;

  constructor(db: Db) {
    this.todos = db.collection<TodoDocument>(TODOS_COLLECTION);
  }

  /** Creates the indexes this repository's queries rely on. */
  async initialize(): Promise<void> {
    await this.todos.createIndex({ createdAt: -1 });
  }

  async create(input: NewTodo): Promise<Todo> {
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

  async update(id: string, input: TodoChanges): Promise<Todo | undefined> {
    const objectId = toObjectId(id);
    if (!objectId) return undefined;

    const changes: Partial<Pick<TodoDocument, "title" | "completed">> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (input.title !== undefined) changes.title = input.title;
    if (input.completed !== undefined) changes.completed = input.completed;

    const document = await this.todos.findOneAndUpdate(
      { _id: objectId },
      { $set: changes },
      { returnDocument: "after", includeResultMetadata: false },
    );

    return document ? toTodo(document) : undefined;
  }

  async delete(id: string): Promise<boolean> {
    const objectId = toObjectId(id);
    if (!objectId) return false;

    const result = await this.todos.deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }
}
