import { ApiClient, TryOnError } from './api';
import { Emitter } from './emitter';
import { preparePhoto } from './image';
import { TryOnModal } from './modal';
import type {
  EventMap, EventName, Locale, Product, ResolvedConfig, Theme, TryOnConfig, TryOnResult, CompareMode,
} from './types';

export type { TryOnConfig, Product, TryOnResult, EventMap, EventName } from './types';

const VERSION = '0.1.0';

const DEFAULTS: ResolvedConfig = {
  mock: false,
  locale: 'en',
  strings: {},
  theme: 'auto',
  compareMode: 'auto',
  autoBind: true,
  closeOnAddToCart: true,
  maxPhotoEdge: 1280,
  maxFileSize: 15 * 1024 * 1024,
  pollInterval: 1500,
  timeout: 90000,
};

const resolve = (cfg: TryOnConfig): ResolvedConfig => {
  const out: ResolvedConfig = { ...DEFAULTS, strings: {} };
  (Object.keys(cfg) as (keyof TryOnConfig)[]).forEach((k) => {
    if (cfg[k] !== undefined) (out as any)[k] = cfg[k];
  });
  return out;
};

let config = resolve({});
let api = new ApiClient(config);
const events = new Emitter();
let current: TryOnModal | null = null;
let bound = false;
let warned = false;

function init(cfg: TryOnConfig = {}) {
  config = resolve(cfg);
  api = new ApiClient(config);
  if (config.autoBind) bind();
  if (api.isMock && !warned) {
    warned = true;
    console.info('[VirtualTryOn] Running in demo mode. Set `endpoint` to connect your try-on backend.');
  }
  return VirtualTryOn;
}

function open(product: Product) {
  if (!product || !product.image) throw new Error('[VirtualTryOn] open() needs a product with an `image` URL.');
  current?.close('replaced');
  const modal = new TryOnModal(config, product, api, events, () => {
    if (current === modal) current = null;
  });
  current = modal;
  modal.open();
}

function close() {
  current?.close('api');
}

/** Headless: run a try-on without any UI. */
async function tryOn(options: { product: Product; photo: Blob; signal?: AbortSignal }): Promise<TryOnResult> {
  const { product, photo, signal } = options;
  if (!product?.image) throw new TryOnError('server', 'tryOn() needs a product with an `image` URL.');
  const prepared = await preparePhoto(photo, config.maxPhotoEdge);
  return api.run(prepared, product, { signal });
}

function on<E extends EventName>(event: E, handler: (data: EventMap[E]) => void) {
  return events.on(event, handler);
}

function off<E extends EventName>(event: E, handler: (data: EventMap[E]) => void) {
  events.off(event, handler);
}

function productFromElement(el: HTMLElement): Product {
  const d = el.dataset;
  return {
    image: d.tryonProduct || '',
    id: d.tryonId || undefined,
    name: d.tryonName || undefined,
    price: d.tryonPrice || undefined,
    category: d.tryonCategory || undefined,
    sizes: d.tryonSizes ? d.tryonSizes.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
  };
}

function onDocumentClick(e: MouseEvent) {
  const target = e.target as Element | null;
  const el = target?.closest?.('[data-tryon-product]') as HTMLElement | null;
  if (!el) return;
  e.preventDefault();
  const product = productFromElement(el);
  if (!product.image) {
    console.warn('[VirtualTryOn] data-tryon-product is empty on', el);
    return;
  }
  open(product);
}

/** Listen for clicks on [data-tryon-product], including buttons added later. */
function bind() {
  if (bound || typeof document === 'undefined') return;
  bound = true;
  document.addEventListener('click', onDocumentClick);
}

const VirtualTryOn = {
  version: VERSION,
  init,
  open,
  close,
  tryOn,
  on,
  off,
  bind,
  get config(): Readonly<ResolvedConfig> {
    return config;
  },
};

/* ---------- script-tag setup ---------- */
if (typeof document !== 'undefined') {
  const script =
    (document.currentScript as HTMLScriptElement | null) ||
    document.querySelector<HTMLScriptElement>('script[data-api-key], script[data-endpoint]');
  const d = script?.dataset;
  // Loaded from our own host (.../tryon.umd.js)? Then that host is the backend unless data-endpoint says otherwise.
  let hostOrigin: string | undefined;
  try {
    if (script?.src && /\/tryon[^/]*\.js(\?|$)/.test(script.src)) hostOrigin = new URL(script.src).origin;
  } catch {
    /* ignore */
  }
  if (d && (hostOrigin || d.apiKey || d.endpoint || d.mock || d.locale || d.accent || d.theme)) {
    init({
      apiKey: d.apiKey,
      endpoint: d.endpoint || (d.mock === 'true' ? undefined : hostOrigin),
      mock: d.mock === 'true' ? true : undefined,
      locale: d.locale as Locale | undefined,
      theme: d.theme as Theme | undefined,
      accent: d.accent,
      compareMode: d.compare as CompareMode | undefined,
    });
  } else {
    bind();
  }
  (window as any).VirtualTryOn ||= VirtualTryOn;
}

export default VirtualTryOn;
