export class ServiceError extends Error {
  status: number;
  payload?: Record<string, unknown>;

  constructor(message: string, status = 400, payload?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  );
}

export function serviceErrorBody(error: ServiceError) {
  return error.payload ?? { error: error.message };
}
