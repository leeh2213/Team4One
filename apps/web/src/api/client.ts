const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4100";
const API_TOKEN = import.meta.env.VITE_API_TOKEN ?? "viewer-local-token";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { authorization: `Bearer ${API_TOKEN}` },
  });
  if (!response.ok) throw new Error(`GET ${path} failed`);
  return response.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${API_TOKEN}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`POST ${path} failed`);
  return response.json();
}
