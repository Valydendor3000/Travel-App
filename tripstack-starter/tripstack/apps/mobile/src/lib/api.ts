// apps/mobile/src/lib/api.ts
export const API_BASE = "https://travel-app.thebusinessshapeup.workers.dev";

export async function apiFetch(
  path: string,
  opts: RequestInit & { token?: string | null } = {}
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as any),
  };

  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-json response
  }

  if (!res.ok) {
    const msg = json?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return json;
}
