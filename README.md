# Virtual Try-On

A drop-in virtual try-on for any clothing store. Shoppers take or upload a photo and see the outfit on themselves, compared side by side (or with a slider) against the original model photo.

The whole UI lives in a Shadow DOM, so the store's CSS can't break it and it can't break the store. It's styled with Tailwind CSS, compiled at build time into the bundle (about 20 KB gzipped, no runtime dependencies), so stores don't need Tailwind themselves.

## Try it now

```bash
npm install
npm run dev          # opens the demo store with live reload from src/
```

Or, without installing anything, serve the folder and open the static demo, which uses the prebuilt `dist/tryon.umd.js` exactly like a real store would:

```bash
python3 -m http.server 8080
# open http://localhost:8080/demo/store.html
```

The camera only works on `https://` or `localhost`. With no `endpoint` set the library runs in **demo mode**: the whole flow works and your own photo is shown as the result.

## Adding it to a store

### 1. One script tag (no code)

```html
<script src="https://cdn.yourbrand.com/tryon.umd.js"
        data-api-key="pk_live_xxx"
        data-endpoint="https://api.yourbrand.com"
        data-accent="#5B2A4E"
        data-locale="en" async></script>

<button data-tryon-product="https://store.com/images/suit.jpg"
        data-tryon-id="SKU-123"
        data-tryon-name="Gulbahar lawn 3-piece"
        data-tryon-price="Rs 6,490"
        data-tryon-sizes="S,M,L,XL">
  Try it on
</button>
```

Any element with `data-tryon-product` opens the try-on, including buttons added to the page later. Change the data attributes (for example when the shopper picks another colour) and the next click uses the new values.

Script tag options: `data-api-key`, `data-endpoint`, `data-accent`, `data-locale` (`en` or `ur` for Roman Urdu), `data-theme` (`auto`, `light`, `dark`), `data-compare` (`auto`, `side`, `slider`), `data-mock="true"`.

### 2. JavaScript API

```js
VirtualTryOn.init({
  apiKey: 'pk_live_xxx',
  endpoint: 'https://api.yourbrand.com',
  accent: '#5B2A4E',
  locale: 'ur',
});

VirtualTryOn.open({
  image: 'https://store.com/images/suit.jpg',
  id: 'SKU-123',
  name: 'Gulbahar lawn 3-piece',
  price: 'Rs 6,490',
  sizes: ['S', 'M', 'L'],
});

VirtualTryOn.on('addToCart', ({ product, size }) => {
  myStore.cart.add(product.id, size);
});
```

### 3. Headless (your own UI)

```js
const { imageUrl } = await VirtualTryOn.tryOn({
  product: { image: 'https://store.com/images/suit.jpg', id: 'SKU-123' },
  photo: fileInput.files[0],
});
```

### 4. npm (once you publish the package)

```bash
npm install virtual-tryon
```
```js
import VirtualTryOn from 'virtual-tryon';
```

## Events

Listen with `VirtualTryOn.on(name, fn)` or as DOM events on `window` named `tryon:<name>`, which needs no access to the JS API:

```js
window.addEventListener('tryon:addToCart', (e) => console.log(e.detail));
```

| Event | Detail |
| --- | --- |
| `open` | `{ product }` |
| `photo` | `{ product, source: 'camera' \| 'upload' }` |
| `result` | `{ product, imageUrl, mock }` |
| `error` | `{ product, code, message }` |
| `addToCart` | `{ product, size, imageUrl }` |
| `close` | `{ product, reason }` |

## All options

| Option | Default | |
| --- | --- | --- |
| `apiKey` | | Sent as `X-Api-Key` |
| `endpoint` | | Backend base URL. Empty = demo mode |
| `mock` | `false` | Force demo mode |
| `locale` | `'en'` | `'en'` or `'ur'` (Roman Urdu) |
| `strings` | `{}` | Override any text, keys in `src/i18n.ts` |
| `theme` | `'auto'` | `'auto'`, `'light'`, `'dark'` |
| `accent` / `onAccent` | `#0F6B5C` / `#fff` | Store brand colour |
| `radius` | `14` | Image corner radius in px |
| `fontFamily` | store's body font | |
| `compareMode` | `'auto'` | Side by side on desktop, slider on phones |
| `autoBind` | `true` | Handle `[data-tryon-product]` clicks |
| `closeOnAddToCart` | `true` | |
| `maxPhotoEdge` | `1280` | Photo is resized before upload |
| `maxFileSize` | 15 MB | |
| `pollInterval` | `1500` | ms |
| `timeout` | `90000` | ms |

## Backend contract

The library expects two endpoints. Every request carries `X-Api-Key`.

**`POST {endpoint}/v1/tryon`** as `multipart/form-data` with `person_image` (JPEG file), `garment_image_url` and optional `product_id`. Responds with:

```json
{ "job_id": "a1b2c3", "status": "queued" }
```

**`GET {endpoint}/v1/tryon/{job_id}`** responds with one of:

```json
{ "job_id": "a1b2c3", "status": "queued" }
{ "job_id": "a1b2c3", "status": "processing" }
{ "job_id": "a1b2c3", "status": "done", "result_url": "https://..." }
{ "job_id": "a1b2c3", "status": "failed", "error_code": "invalid_photo", "error": "No person found" }
```

Error responses can include `error_code`: `invalid_photo`, `rate_limited`, `auth`, `timeout` or `server`. Without one, the HTTP status decides (401/403 → `auth`, 422 → `invalid_photo`, 429 → `rate_limited`). The backend must allow CORS from store domains and should delete the shopper's photo once the result is made, since the interface tells shoppers their photo isn't stored.

## Styling with Tailwind

All markup in `src/modal.ts` uses Tailwind utility classes. At build time Vite runs Tailwind over `src/**/*.ts`, and the compiled CSS is imported as a string (`styles.css?inline`) and injected into the Shadow DOM. Nothing leaks into the store page and the store's own Tailwind (or any other CSS) can't reach inside.

Colours are CSS variables mapped to Tailwind names in `tailwind.config.js`: `ink`, `muted`, `line`, `surface`, `soft`, `accent`, `on-accent`, `danger` and a few more. Dark mode only swaps the variables in `src/styles.css`, so classes like `bg-surface text-ink` work in both themes, and a store's `accent` option recolours every `bg-accent` / `text-accent` at once.

To change the look, edit the classes in `src/modal.ts` (shared button and card styles are constants at the top of the file) or the tokens in `src/styles.css`, then run `npm run build`. The `md:` breakpoint is set to 681px: below it the window is a full-screen sheet.

## Project layout

```
src/
  index.ts     public API and script-tag setup
  modal.ts     the try-on window and all its screens
  api.ts       backend client, polling, demo mode
  image.ts     EXIF fix, resizing, camera capture
  styles.css   Tailwind entry, design tokens, light and dark
  i18n.ts      English and Roman Urdu text
  icons.ts     inline SVG icons
tailwind.config.js  colour tokens, breakpoint, animations
dist/          prebuilt files (npm run build)
demo/          static demo store using dist/
index.html     dev demo store using src/
```

## Backend (included, deploys to Vercel)

The `api/` folder is a serverless backend that implements the contract above (`/v1/tryon`).

- **Default, free:** the public IDM-VTON Space on Hugging Face. No key needed. It is shared ZeroGPU capacity, so it can be slow (about 25 s when warm) or hit its quota. Set a free `HF_TOKEN` (huggingface.co/settings/tokens) in Vercel env vars for a bigger quota.
- **Best quality (free tier): Gemini.** Set `GEMINI_API_KEY` (aistudio.google.com/apikey). It keeps the garment's real styling (kurtis stay untucked) and handles tight crops. Used first when the key is present.
- **Paid, more reliable:** set `REPLICATE_API_TOKEN` and it switches to Replicate (or force it with `TRYON_PROVIDER=replicate` / `hf`).
- Optional: `TRYON_API_KEYS` (comma list, enforced against `X-Api-Key`), `ALLOWED_ORIGINS` (comma list, default `*`).
- The garment URL must be a public JPEG/PNG/WebP photo of the garment (flat lay or on a model). SVG drawings are rejected. The shopper's photo is never stored.
