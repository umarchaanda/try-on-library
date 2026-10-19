// Free provider: the public IDM-VTON Gradio Space on Hugging Face (ZeroGPU).
// Gradio drops the job when its event stream closes, so the whole try-on runs inside one request
// and the finished image is returned straight away (the client library accepts "done" on the first reply).

interface SpaceCfg {
  url: string;
  fnIndex: number;
  triggerId: number;
  /** Builds the Gradio input list from the uploaded person/garment files. */
  inputs: (person: any, garment: any, description: string) => unknown[];
}

// Default: Kolors Virtual Try-On. It keeps the garment's real length and styling (untucked kurtis, matching trousers).
export const KOLORS: SpaceCfg = {
  url: (process.env.KOLORS_SPACE_URL || 'https://kwai-kolors-kolors-virtual-try-on.hf.space').replace(/\/+$/, ''),
  fnIndex: 2,
  triggerId: 26,
  inputs: (p, g) => [p, g, 0, true],
};

// Fallback: IDM-VTON. Good for short tops, but it only repaints the torso.
export const IDM: SpaceCfg = {
  url: (process.env.HF_SPACE_URL || 'https://yisol-idm-vton.hf.space').replace(/\/+$/, ''),
  fnIndex: Number(process.env.HF_FN_INDEX || 2),
  triggerId: Number(process.env.HF_TRIGGER_ID || 25),
  inputs: (p, g, d) => [{ background: p, layers: [], composite: p }, g, d, true, true, 30, 42],
};
const MAX_GARMENT_BYTES = 8 * 1024 * 1024;

export class HfError extends Error {
  constructor(public code: 'invalid_photo' | 'rate_limited' | 'timeout' | 'server', message: string) {
    super(message);
  }
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const t = process.env.HF_TOKEN;
  return t ? { Authorization: `Bearer ${t}`, ...extra } : extra;
}

function isPrivateHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === '[::1]' ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  );
}

export async function fetchGarment(url: string): Promise<Blob> {
  const u = new URL(url);
  if (isPrivateHost(u.hostname)) throw new HfError('invalid_photo', 'Garment URL is not allowed');
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'follow' });
  } catch {
    throw new HfError('invalid_photo', 'Could not download the garment image');
  }
  if (!res.ok) throw new HfError('invalid_photo', `Garment image returned ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0];
  if (!/^image\/(jpeg|png|webp)$/.test(type)) throw new HfError('invalid_photo', 'Garment must be a JPEG, PNG or WebP photo');
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_GARMENT_BYTES) throw new HfError('invalid_photo', 'Garment image too large');
  return new Blob([buf], { type });
}

async function upload(SPACE: string, blob: Blob, name: string) {
  const fd = new FormData();
  fd.append('files', blob, name);
  const res = await fetch(`${SPACE}/upload`, { method: 'POST', body: fd, headers: headers() });
  if (!res.ok) throw new HfError(res.status === 429 ? 'rate_limited' : 'server', `Upload failed (${res.status})`);
  const paths = (await res.json()) as string[];
  return { path: paths[0], meta: { _type: 'gradio.FileData' }, orig_name: name };
}

/** Runs one try-on and returns the result as a data URL. */
export async function runHfTryOn(person: Blob, garment: Blob, description: string, deadlineMs: number, cfg: SpaceCfg = KOLORS): Promise<string> {
  const SPACE = cfg.url;
  const deadline = Date.now() + deadlineMs;
  const [p, g] = await Promise.all([upload(SPACE, person, 'person.jpg'), upload(SPACE, garment, 'garment.jpg')]);
  const session = crypto.randomUUID().replace(/-/g, '').slice(0, 11);

  const join = await fetch(`${SPACE}/queue/join`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      data: cfg.inputs(p, g, description),
      event_data: null,
      fn_index: cfg.fnIndex,
      trigger_id: cfg.triggerId,
      session_hash: session,
    }),
  });
  if (!join.ok) throw new HfError(join.status === 429 ? 'rate_limited' : 'server', `Queue join failed (${join.status})`);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Math.max(1000, deadline - Date.now()));
  try {
    const res = await fetch(`${SPACE}/queue/data?session_hash=${session}`, { headers: headers(), signal: ac.signal });
    if (!res.ok || !res.body) throw new HfError('server', `Stream failed (${res.status})`);
    const dec = new TextDecoder();
    let buf = '';
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buf += dec.decode(chunk, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const line = buf.slice(0, i).replace(/^data: /, '');
        buf = buf.slice(i + 2);
        let m: any;
        try {
          m = JSON.parse(line);
        } catch {
          continue;
        }
        if (m.msg === 'unexpected_error' || (m.msg === 'process_completed' && !m.success)) {
          const text = String(m.output?.error || m.message || '');
          if (/quota|zerogpu|rate/i.test(text)) throw new HfError('rate_limited', text);
          if (/person|pose|detect|keypoint/i.test(text)) throw new HfError('invalid_photo', text);
          throw new HfError('server', text || 'Try-on failed');
        }
        if (m.msg === 'process_completed') {
          const out = m.output?.data?.[0];
          const url: string | undefined = out?.url || (out?.path ? `${SPACE}/file=${out.path}` : undefined);
          if (!url) throw new HfError('server', 'No result produced');
          const img = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(15_000) });
          if (!img.ok) throw new HfError('server', 'Could not read the result image');
          const type = img.headers.get('content-type') || 'image/png';
          return `data:${type};base64,${Buffer.from(await img.arrayBuffer()).toString('base64')}`;
        }
      }
    }
    throw new HfError('server', 'Stream ended without a result');
  } catch (e) {
    if (e instanceof HfError) throw e;
    if (ac.signal.aborted) throw new HfError('timeout', 'Try-on took too long');
    throw new HfError('server', 'Try-on failed');
  } finally {
    clearTimeout(timer);
  }
}
