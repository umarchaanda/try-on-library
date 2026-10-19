// Google Gemini image model (AI Studio key, has a free tier). Prompt-driven, so it can keep the garment's
// real styling (untucked kurti, length, sleeves) and cope with tightly cropped photos.

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image';

export class GeminiError extends Error {
  constructor(public code: 'invalid_photo' | 'rate_limited' | 'timeout' | 'server', message: string) {
    super(message);
  }
}

const b64 = async (b: Blob) => Buffer.from(await b.arrayBuffer()).toString('base64');

function buildPrompt(description: string): string {
  return [
    'You are a virtual try-on engine. Image 1 is the shopper. Image 2 is the product photo (the garment on a model or mannequin).',
    `Product: ${description}.`,
    'Dress the shopper in the exact garment from image 2: same colour, fabric, print, neckline, sleeves, trim and, importantly, the same length and fit.',
    'Style it exactly like image 2 shows it. If the garment is a long top, kurti or kameez, wear it untucked, falling over whatever the shopper has on below; never tuck it in or shorten it.',
    'If image 2 shows matching trousers/shalwar and the shopper photo shows legs, dress the shopper in them too; otherwise keep the shopper\'s own bottoms.',
    'Keep the shopper\'s face, hair, skin tone, body shape, pose, hands, background and lighting unchanged. Replace only the clothing.',
    'If the shopper photo is tightly cropped and the garment would extend beyond the frame, extend the image downward naturally so the full garment length is visible, keeping the same background.',
    'Output only the final photo of the shopper wearing the garment. Realistic photograph, no text, no collage.',
  ].join(' ');
}

export async function runGeminiTryOn(person: Blob, garment: Blob, description: string, deadlineMs: number): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError('server', 'GEMINI_API_KEY is not set');

  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(deadlineMs),
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: buildPrompt(description) },
              { inline_data: { mime_type: person.type || 'image/jpeg', data: await b64(person) } },
              { inline_data: { mime_type: garment.type || 'image/jpeg', data: await b64(garment) } },
            ],
          },
        ],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') throw new GeminiError('timeout', 'Try-on took too long');
    throw new GeminiError('server', 'Could not reach Gemini');
  }

  if (res.status === 429) throw new GeminiError('rate_limited', 'Gemini quota reached: ' + (await res.text().catch(() => '')).slice(0, 1500));
  if (res.status === 401 || res.status === 403) throw new GeminiError('server', 'Gemini key rejected');
  if (!res.ok) throw new GeminiError('server', `Gemini error ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);

  const data: any = await res.json();
  const parts: any[] = data?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
  if (!img) {
    const block = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || 'no image returned';
    throw new GeminiError('invalid_photo', `Gemini returned no image (${block})`);
  }
  const d = img.inlineData || img.inline_data;
  return `data:${d.mimeType || d.mime_type || 'image/png'};base64,${d.data}`;
}
