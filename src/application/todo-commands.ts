/** Commands are the data the application accepts from adapters such as HTTP. */
export interface CreateTodoCommand {
  title: string;
}

export interface UpdateTodoCommand {
  title?: string;
  completed?: boolean;
}
