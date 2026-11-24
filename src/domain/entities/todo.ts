export const TODO_TITLE_MAX_LENGTH = 120;

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTodoInput {
  title: string;
}

export interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
}

export type ParsedTodoTitle =
  | { readonly valid: true; readonly title: string }
  | { readonly valid: false; readonly message: string };

/** The title rule belongs to the entity, so every adapter enforces the same invariant. */
export function parseTodoTitle(input: string): ParsedTodoTitle {
  const title = input.trim();
  if (title.length === 0) {
    return { valid: false, message: "Title must not be empty." };
  }
  if (title.length > TODO_TITLE_MAX_LENGTH) {
    return {
      valid: false,
      message: `Title must contain at most ${TODO_TITLE_MAX_LENGTH} characters.`,
    };
  }
  return { valid: true, title };
}
