export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const isApiError = (error: unknown): error is ApiError => {
  return error instanceof ApiError;
};
