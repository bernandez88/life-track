export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (message: string) => new AppError("not_found", 404, message);
export const conflict = (message: string, details?: unknown) => new AppError("conflict", 409, message, details);
export const badRequest = (message: string, details?: unknown) => new AppError("bad_request", 400, message, details);
