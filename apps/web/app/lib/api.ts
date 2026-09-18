export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
let refreshRequest: Promise<boolean> | null = null;

async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
}

async function refreshSession(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = fetchApi('/auth/refresh', { method: 'POST' })
      .then((response) => response.ok)
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response = await fetchApi(path, init);
  const refreshable = !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh') && !path.startsWith('/auth/password-reset');
  if (response.status === 401 && refreshable && (await refreshSession())) response = await fetchApi(path, init);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
