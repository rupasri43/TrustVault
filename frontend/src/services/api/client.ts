export const API_BASE_URL: string =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "/api";

export const USE_MOCKS: boolean =
  (import.meta.env["VITE_USE_MOCKS"] as string | undefined) !== "false";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const needsCsrf = !["GET", "HEAD", "OPTIONS"].includes(method);

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  const isForm = init.body instanceof FormData;

  if (!isForm && init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (needsCsrf) {
    const csrfResponse = await fetch(`${API_BASE_URL}/csrf-token`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!csrfResponse.ok) {
      throw new ApiError(csrfResponse.status, "Unable to obtain CSRF token");
    }

    const csrfData = await csrfResponse.json();
    headers.set("X-CSRFToken", csrfData.csrf_token);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    method,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    let msg = res.statusText;

    try {
      const body = await res.json();
      msg = body.message ?? body.error ?? msg;
    } catch {
      // Response was not JSON.
    }

    throw new ApiError(res.status, msg);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}