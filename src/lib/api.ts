/** Small fetch helper for the browser: JSON in/out, readable errors. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public field?: string, public data?: Record<string, unknown>) { super(message); }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('Could not reach PageGrade. Check your connection and try again.', 0, 'network');
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(String(data.error ?? 'Something went wrong. Please try again.'), res.status, data.code as string | undefined, data.field as string | undefined, data);
  return data as T;
}
