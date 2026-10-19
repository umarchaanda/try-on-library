import { checkAuth, json, mapStatus, preflight, replicate, replicateToken } from './_lib.js';

export function OPTIONS(req: Request) {
  return preflight(req);
}

// GET /v1/tryon/:id  (rewritten to /api/tryon-status?id=:id)
export async function GET(req: Request) {
  const denied = checkAuth(req);
  if (denied) return denied;
  if (!replicateToken()) return json(req, { error_code: 'server', detail: 'Backend is not configured' }, 500);

  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[a-z0-9]{10,64}$/i.test(id)) return json(req, { error_code: 'invalid_photo', detail: 'Bad job id' }, 422);

  const res = await replicate(`/predictions/${id}`);
  if (res.status === 404) return json(req, { error_code: 'server', detail: 'Job not found' }, 404);
  if (!res.ok) return json(req, { error_code: 'server', detail: 'Status check failed' }, 502);

  const p = (await res.json()) as { id: string; status: string; output?: string | string[]; error?: string };
  const status = mapStatus(p.status);
  if (status === 'done') {
    const url = Array.isArray(p.output) ? p.output[0] : p.output;
    if (!url) return json(req, { job_id: id, status: 'failed', error_code: 'server', error: 'No result produced' });
    return json(req, { job_id: id, status, result_url: url });
  }
  if (status === 'failed') {
    const msg = p.error || 'Try-on failed';
    const code = /no (person|human)|pose|detect/i.test(msg) ? 'invalid_photo' : 'server';
    return json(req, { job_id: id, status, error_code: code, error: msg });
  }
  return json(req, { job_id: id, status });
}
