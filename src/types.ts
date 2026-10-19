export type Locale = 'en' | 'ur';
export type Theme = 'auto' | 'light' | 'dark';
export type CompareMode = 'auto' | 'side' | 'slider';

export interface TryOnConfig {
  /** Publishable key for your try-on backend. Sent as the X-Api-Key header. */
  apiKey?: string;
  /** Base URL of your try-on backend, e.g. https://api.example.com. Leave empty to run in demo mode. */
  endpoint?: string;
  /** Force demo mode even when an endpoint is set. */
  mock?: boolean;
  /** Interface language. 'ur' is Roman Urdu. */
  locale?: Locale;
  /** Override any interface text. */
  strings?: Partial<Record<StringKey, string>>;
  /** 'auto' follows the shopper's system setting. */
  theme?: Theme;
  /** Store brand colour used for primary actions, e.g. '#0F6B5C'. */
  accent?: string;
  /** Text colour on top of the accent colour. */
  onAccent?: string;
  /** Corner radius in pixels for images and cards. */
  radius?: number;
  /** Font for the try-on window. Defaults to the store page's own body font. */
  fontFamily?: string;
  /** How the result is compared. 'auto' = side by side on desktop, slider on phones. */
  compareMode?: CompareMode;
  /** Bind clicks on [data-tryon-product] elements automatically. Default true. */
  autoBind?: boolean;
  /** Close the window shortly after Add to cart is pressed. Default true. */
  closeOnAddToCart?: boolean;
  /** Longest edge, in pixels, the shopper's photo is resized to before upload. Default 1280. */
  maxPhotoEdge?: number;
  /** Largest photo file accepted, in bytes. Default 15 MB. */
  maxFileSize?: number;
  /** How often to ask the backend for job status, in ms. Default 1500. */
  pollInterval?: number;
  /** Give up after this many ms. Default 90000. */
  timeout?: number;
}

export interface ResolvedConfig extends Required<Omit<TryOnConfig, 'apiKey' | 'endpoint' | 'accent' | 'onAccent' | 'fontFamily' | 'strings' | 'radius'>> {
  apiKey?: string;
  endpoint?: string;
  accent?: string;
  onAccent?: string;
  fontFamily?: string;
  radius?: number;
  strings: Partial<Record<StringKey, string>>;
}

export interface Product {
  /** URL of the product photo (model wearing the garment). Required. */
  image: string;
  id?: string;
  name?: string;
  price?: string;
  sizes?: string[];
}

export interface TryOnResult {
  imageUrl: string;
  jobId?: string;
  /** True when produced by demo mode rather than a real backend. */
  mock: boolean;
}

export type TryOnStatus = 'upload' | 'queued' | 'processing' | 'finishing';

export type ErrorCode =
  | 'network'
  | 'invalid_photo'
  | 'rate_limited'
  | 'timeout'
  | 'auth'
  | 'server'
  | 'cancelled'
  | 'file_type'
  | 'file_size';

export interface EventMap {
  open: { product: Product };
  close: { product: Product; reason: string };
  photo: { product: Product; source: 'camera' | 'upload' };
  result: { product: Product; imageUrl: string; mock: boolean };
  error: { product: Product; code: ErrorCode; message?: string };
  addToCart: { product: Product; size: string | null; imageUrl: string };
}

export type EventName = keyof EventMap;

export type StringKey =
  | 'title' | 'back' | 'close' | 'privacy'
  | 'tryingOn' | 'startHeading' | 'startBody'
  | 'takePhoto' | 'takePhotoSub' | 'uploadPhoto' | 'uploadPhotoSub' | 'dropHere'
  | 'tip1' | 'tip2' | 'tip3'
  | 'cameraHint' | 'cameraStarting' | 'flip' | 'shutter' | 'timer'
  | 'cameraDenied' | 'cameraUnavailable' | 'uploadInstead'
  | 'retake' | 'chooseAnother' | 'usePhoto' | 'yourPhoto'
  | 'status_upload' | 'status_queued' | 'status_processing' | 'status_finishing' | 'waitNote' | 'cancel'
  | 'compareLabel' | 'sideBySide' | 'slider' | 'model' | 'you'
  | 'size' | 'selectSize' | 'addToCart' | 'added' | 'save' | 'newPhoto' | 'demoNote'
  | 'errorHeading' | 'retry'
  | 'err_network' | 'err_invalid_photo' | 'err_rate_limited' | 'err_timeout' | 'err_auth'
  | 'err_server' | 'err_file_type' | 'err_file_size';
