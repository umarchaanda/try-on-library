import type { ErrorCode, Product, ResolvedConfig, TryOnResult, TryOnStatus } from './types';

export class TryOnError extends Error {
  constructor(public code: ErrorCode, message?: string) {
    super(message || code);
    this.name = 'TryOnError';
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new TryOnError('cancelled'));
    const id = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new TryOnError('cancelled'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

const KNOWN_CODES: ErrorCode[] = ['network', 'invalid_photo', 'rate_limited', 'timeout', 'auth', 'server'];
const toCode = (value: unknown, fallback: ErrorCode): ErrorCode =>
  KNOWN_CODES.includes(value as ErrorCode) ? (value as ErrorCode) : fallback;

function statusToCode(status: number): ErrorCode {
  if (status === 401 || status === 403) return 'auth';
  if (status === 422) return 'invalid_photo';
  if (status === 429) return 'rate_limited';
  return 'server';
}

function absoluteUrl(url: string): string {
  try {
    return new URL(url, document.baseURI).href;
  } catch {
    return url;
  }
}

export interface RunOptions {
  signal?: AbortSignal;
  onStatus?: (status: TryOnStatus) => void;
}

interface JobResponse {
  job_id: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  result_url?: string;
  error_code?: string;
  error?: string;
}

/**
 * Backend contract:
 *   POST {endpoint}/v1/tryon        multipart: person_image (file), garment_image_url, product_id?
 *                                    -> { job_id, status }
 *   GET  {endpoint}/v1/tryon/{id}   -> { job_id, status, result_url?, error_code?, error? }
 * Every request carries the X-Api-Key header.
 */
export class ApiClient {
  constructor(private cfg: ResolvedConfig) {}

  get isMock(): boolean {
    return this.cfg.mock || !this.cfg.endpoint;
  }

  async run(photo: Blob, product: Product, opts: RunOptions = {}): Promise<TryOnResult> {
    if (this.isMock) return this.runMock(photo, opts);

    const base = this.cfg.endpoint!.replace(/\/+$/, '');
    const { signal, onStatus } = opts;

    const form = new FormData();
    form.append('person_image', photo, 'person.jpg');
    form.append('garment_image_url', absoluteUrl(product.image));
    if (product.id) form.append('product_id', product.id);

    onStatus?.('upload');
    let job = await this.request<JobResponse>(`${base}/v1/tryon`, { method: 'POST', body: form, signal });

    const started = Date.now();
    let processingSince = 0;
    for (;;) {
      if (job.status === 'done' && job.result_url) {
        return { imageUrl: job.result_url, jobId: job.job_id, mock: false };
      }
      if (job.status === 'failed') {
        throw new TryOnError(toCode(job.error_code, 'server'), job.error);
      }
      if (Date.now() - started > this.cfg.timeout) throw new TryOnError('timeout');

      if (job.status === 'queued') {
        onStatus?.('queued');
      } else {
        processingSince ||= Date.now();
        onStatus?.(Date.now() - processingSince > 9000 ? 'finishing' : 'processing');
      }

      await sleep(this.cfg.pollInterval, signal);
      job = await this.request<JobResponse>(`${base}/v1/tryon/${encodeURIComponent(job.job_id)}`, { signal });
    }
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: this.cfg.apiKey ? { 'X-Api-Key': this.cfg.apiKey } : undefined,
      });
    } catch {
      if (init.signal?.aborted) throw new TryOnError('cancelled');
      throw new TryOnError('network');
    }
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* empty or non-JSON body */
    }
    if (!res.ok) {
      throw new TryOnError(toCode(data?.error_code, statusToCode(res.status)), data?.detail || data?.message);
    }
    return data as T;
  }

  private async runMock(photo: Blob, { signal, onStatus }: RunOptions): Promise<TryOnResult> {
    onStatus?.('upload');
    await sleep(700, signal);
    onStatus?.('queued');
    await sleep(700, signal);
    onStatus?.('processing');
    await sleep(1900, signal);
    onStatus?.('finishing');
    await sleep(800, signal);
    return { imageUrl: URL.createObjectURL(photo), mock: true };
  }
}
