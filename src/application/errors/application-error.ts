export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string) {
    super(`${resource} was not found.`, "NOT_FOUND");
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
  }
}
