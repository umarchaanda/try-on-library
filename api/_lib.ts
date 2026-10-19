// Shared helpers for the try-on API (Vercel functions). Files starting with "_" are not routes.

export const REPLICATE = 'https://api.replicate.com/v1';
export const MODEL_VERSION =
  process.env.REPLICATE_MODEL_VERSION || '0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985'; // cuuupid/idm-vton

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowAll = ALLOWED_ORIGINS.includes('*');
  const ok = allowAll || ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? (allowAll ? '*' : origin) : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'X-Api-Key, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(req) },
  });
}

export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/** Returns an error response when the key is wrong. If TRYON_API_KEYS is unset, requests are open. */
export function checkAuth(req: Request): Response | null {
  const keys = (process.env.TRYON_API_KEYS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!keys.length) return null;
  if (keys.includes(req.headers.get('x-api-key') || '')) return null;
  return json(req, { error_code: 'auth', detail: 'Invalid API key' }, 401);
}

export function replicateToken(): string | null {
  return process.env.REPLICATE_API_TOKEN || null;
}

export async function replicate(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${REPLICATE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${replicateToken()}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}

export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

export function mapStatus(s: string): JobStatus {
  if (s === 'succeeded') return 'done';
  if (s === 'failed' || s === 'canceled') return 'failed';
  if (s === 'processing') return 'processing';
  return 'queued';
}
