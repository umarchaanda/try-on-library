import { GeminiError, runGeminiTryOn } from './_gemini.js';
import { fetchGarment, HfError, runHfTryOn } from './_hf.js';
import { checkAuth, json, MODEL_VERSION, preflight, replicate, replicateToken } from './_lib.js';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const CATEGORIES = ['upper_body', 'lower_body', 'dresses'];

function validGarmentUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function OPTIONS(req: Request) {
  return preflight(req);
}

// POST /v1/tryon  (multipart: person_image, garment_image_url, product_id?, category?, garment_description?)
export async function POST(req: Request) {
  const denied = checkAuth(req);
  if (denied) return denied;
  const provider = process.env.TRYON_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : replicateToken() ? 'replicate' : 'hf');
  if (provider === 'replicate' && !replicateToken()) {
    return json(req, { error_code: 'server', detail: 'Backend is not configured' }, 500);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json(req, { error_code: 'invalid_photo', detail: 'Expected multipart form data' }, 422);
  }

  const photo = form.get('person_image');
  const garment = String(form.get('garment_image_url') || '');
  if (!(photo instanceof Blob) || photo.size === 0) {
    return json(req, { error_code: 'invalid_photo', detail: 'person_image is required' }, 422);
  }
  if (photo.size > MAX_PHOTO_BYTES) return json(req, { error_code: 'invalid_photo', detail: 'Photo too large' }, 422);
  if (!/^image\/(jpeg|png|webp)$/.test(photo.type || 'image/jpeg')) {
    return json(req, { error_code: 'invalid_photo', detail: 'Photo must be JPEG, PNG or WebP' }, 422);
  }
  if (!validGarmentUrl(garment)) return json(req, { error_code: 'invalid_photo', detail: 'garment_image_url is invalid' }, 422);

  const category = String(form.get('category') || process.env.DEFAULT_CATEGORY || 'upper_body');
  const description = String(form.get('garment_description') || 'clothing').slice(0, 200) + (provider !== 'replicate' ? ', worn untucked and loose, long hip-length top' : '');

  let useHf = provider === 'hf';
  if (provider === 'gemini') {
    try {
      const garmentBlob = await fetchGarment(garment);
      const resultUrl = await runGeminiTryOn(photo, garmentBlob, description, 55_000);
      return json(req, { job_id: crypto.randomUUID(), status: 'done', result_url: resultUrl });
    } catch (e) {
      const err = e instanceof HfError || e instanceof GeminiError ? e : new HfError('server', 'Try-on failed');
      console.error('gemini try-on failed', err.code, err.message);
      // Free-tier Gemini image quota is often 0: fall back to the free Hugging Face model.
      if (err.code === 'rate_limited' || (err.code === 'server' && /key|reach|error 4\d\d/i.test(err.message))) {
        useHf = true;
      } else {
        const status = err.code === 'invalid_photo' ? 422 : err.code === 'timeout' ? 504 : 502;
        return json(req, { error_code: err.code, detail: err.message }, status);
      }
    }
  }

  if (useHf) {
    try {
      const garmentBlob = await fetchGarment(garment);
      const resultUrl = await runHfTryOn(photo, garmentBlob, description, 52_000);
      return json(req, { job_id: crypto.randomUUID(), status: 'done', result_url: resultUrl });
    } catch (e) {
      const err = e instanceof HfError ? e : new HfError('server', 'Try-on failed');
      console.error('hf try-on failed', err.code, err.message);
      const status = err.code === 'invalid_photo' ? 422 : err.code === 'rate_limited' ? 429 : err.code === 'timeout' ? 504 : 502;
      return json(req, { error_code: err.code, detail: err.message }, status);
    }
  }

  // Replicate: the photo is passed inline as a data URI and never written to disk or storage.
  const bytes = Buffer.from(await photo.arrayBuffer());
  const humanImg = `data:${photo.type || 'image/jpeg'};base64,${bytes.toString('base64')}`;

  const res = await replicate('/predictions', {
    method: 'POST',
    body: JSON.stringify({
      version: MODEL_VERSION,
      input: {
        human_img: humanImg,
        garm_img: garment,
        garment_des: description,
        category: CATEGORIES.includes(category) ? category : 'upper_body',
        crop: true,
        steps: 30,
      },
    }),
  });

  if (res.status === 429) return json(req, { error_code: 'rate_limited' }, 429);
  if (!res.ok) {
    console.error('replicate create failed', res.status, await res.text().catch(() => ''));
    return json(req, { error_code: 'server', detail: 'Could not start try-on' }, 502);
  }
  const p = (await res.json()) as { id: string };
  return json(req, { job_id: p.id, status: 'queued' }, 202);
}
