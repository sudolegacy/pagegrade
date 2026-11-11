/** Error with an HTTP status, safe to show to the user. Kept free of Next.js imports so the worker can use it. */
export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly code = 'error', public readonly extra?: Record<string, unknown>) { super(message); }
}
