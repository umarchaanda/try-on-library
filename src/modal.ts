import { ApiClient, TryOnError, sleep } from './api';
import { Emitter } from './emitter';
import { makeT } from './i18n';
import { bodyGuide, icons } from './icons';
import { captureFrame, preparePhoto } from './image';
import css from './styles.css?inline';
import type { ErrorCode, Product, ResolvedConfig, StringKey, TryOnResult, TryOnStatus } from './types';

type Screen = 'start' | 'camera' | 'review' | 'processing' | 'result' | 'error';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const FOCUSABLE = 'button:not([disabled]), [href], input:not([type="file"]):not([disabled]), [tabindex]:not([tabindex="-1"])';
const FILE_INPUT = '<input type="file" accept="image/jpeg,image/png,image/webp" hidden>';

/* ---------- shared Tailwind class sets ---------- */
const BTN =
  'inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-[22px] text-[15px] font-semibold transition active:scale-[.98] disabled:cursor-default';
const BTN_PRIMARY = `${BTN} bg-accent text-on-accent hover:brightness-110 [&.done]:bg-ink [&.done]:text-surface [&.done]:brightness-100`;
const BTN_SECONDARY = `${BTN} border border-line bg-surface hover:border-ink`;
const BTN_GHOST = `${BTN} text-muted hover:bg-soft hover:text-ink`;
const ICON_BTN = 'grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-soft';
const CHOICE =
  'flex w-full items-center gap-3.5 rounded-vto border border-line bg-surface px-4 py-3.5 text-left transition hover:border-accent hover:bg-accent-soft active:scale-[.99]';
const CHOICE_IC = 'grid h-[46px] w-[46px] flex-none place-items-center rounded-xl';
const CAM_CHIP =
  'absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded-full bg-cam/55 px-3.5 py-[7px] text-[13px] font-medium backdrop-blur-md';
const CAM_BTN =
  'grid h-12 w-12 place-items-center rounded-full bg-white/[.12] text-white transition-colors hover:bg-white/20 aria-pressed:bg-white aria-pressed:text-cam';
const STAGE = 'grid h-full grid-rows-[minmax(0,1fr)_auto] justify-items-center gap-5 p-4 md:p-6';
const FRAME = 'relative aspect-[3/4] h-full max-w-full overflow-hidden rounded-vto bg-soft';
const ROW = 'flex flex-wrap justify-center gap-2.5';
const TAG = 'pointer-events-none absolute top-3 rounded-full px-[11px] py-[5px] text-xs font-semibold backdrop-blur-md';
const FULL_IMG = 'h-full w-full object-cover';

export class TryOnModal {
  private host!: HTMLDivElement;
  private root!: ShadowRoot;
  private wrap!: HTMLElement;
  private dialog!: HTMLElement;
  private screenEl!: HTMLElement;
  private backBtn!: HTMLButtonElement;

  private screen: Screen = 'start';
  private photo: Blob | null = null;
  private photoUrl: string | null = null;
  private photoSource: 'camera' | 'upload' = 'upload';
  private result: TryOnResult | null = null;
  private stream: MediaStream | null = null;
  private facing: 'user' | 'environment' = 'user';
  private timerOn = false;
  private counting = false;
  private abort: AbortController | null = null;
  private progressTimer = 0;
  private compare: 'side' | 'slider';
  private pos = 50;
  private size: string | null;
  private lastError: ErrorCode = 'server';
  private prevFocus: Element | null = null;
  private prevOverflow = '';
  private closed = false;
  private t: (key: StringKey) => string;

  constructor(
    private cfg: ResolvedConfig,
    private product: Product,
    private api: ApiClient,
    private events: Emitter,
    private onClosed: () => void,
  ) {
    this.t = makeT(cfg.locale, cfg.strings);
    this.size = product.sizes && product.sizes.length === 1 ? product.sizes[0] : null;
    this.compare =
      cfg.compareMode === 'auto'
        ? window.matchMedia('(max-width: 680px)').matches ? 'slider' : 'side'
        : cfg.compareMode;
  }

  /* ------------------------------------------------------------------ */
  /* lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  open(): void {
    const { cfg, product, t } = this;
    const host = document.createElement('div');
    host.setAttribute('data-virtual-tryon', '');
    if (cfg.theme !== 'auto') host.dataset.theme = cfg.theme;
    if (cfg.accent) host.style.setProperty('--vto-accent', cfg.accent);
    if (cfg.onAccent) host.style.setProperty('--vto-on-accent', cfg.onAccent);
    if (cfg.radius != null) host.style.setProperty('--vto-radius', `${cfg.radius}px`);
    const font = cfg.fontFamily || getComputedStyle(document.body).fontFamily;
    if (font) host.style.setProperty('--vto-font', font);
    this.host = host;

    this.root = host.attachShadow({ mode: 'open' });
    this.root.innerHTML = `
      <style>${css}</style>
      <div class="group/root fixed inset-0 font-vto text-[15px] leading-normal text-ink antialiased">
        <div class="absolute inset-0 bg-backdrop opacity-0 transition-opacity duration-300 ease-vto group-[.in]/root:opacity-100" data-act="close"></div>
        <div class="group/dialog absolute inset-0 grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-surface pt-[env(safe-area-inset-top)] opacity-0 translate-y-6 transition duration-300 ease-vto group-[.in]/root:translate-y-0 group-[.in]/root:opacity-100
                    md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(680px,calc(100dvh-48px))] md:w-[min(920px,calc(100vw-48px))] md:-translate-x-1/2 md:-translate-y-[47%] md:scale-[.985] md:rounded-[22px] md:pt-0
                    md:shadow-[0_40px_90px_-30px_rgba(20,10,30,.55),0_0_0_1px_rgba(0,0,0,.04)] md:group-[.in]/root:-translate-y-1/2 md:group-[.in]/root:scale-100"
             role="dialog" aria-modal="true" aria-labelledby="vto-title">
          <header class="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b border-line px-3 py-2.5">
            <button class="${ICON_BTN} col-start-1" data-act="back" aria-label="${esc(t('back'))}">${icons.arrowLeft}</button>
            <div class="col-start-2 grid min-w-0 text-center leading-tight">
              <span id="vto-title" class="text-[14.5px] font-semibold">${esc(t('title'))}</span>
              ${product.name ? `<span class="truncate text-[12.5px] text-muted">${esc(product.name)}</span>` : ''}
            </div>
            <button class="${ICON_BTN} col-start-3" data-act="close" aria-label="${esc(t('close'))}">${icons.x}</button>
          </header>
          <main class="relative overflow-auto overscroll-contain [&>*]:animate-in" aria-live="polite"></main>
          <footer class="flex items-center justify-center gap-[7px] border-t border-line px-5 pt-[11px] pb-[calc(11px+env(safe-area-inset-bottom))] text-center text-xs text-muted md:pb-[11px] group-data-[screen=camera]/dialog:hidden [&>svg]:flex-none">
            ${icons.lock}<span>${esc(t('privacy'))}</span>
          </footer>
        </div>
      </div>`;
    this.wrap = this.root.querySelector('.group\\/root')!;
    this.dialog = this.root.querySelector('[role="dialog"]')!;
    this.screenEl = this.root.querySelector('main')!;
    this.backBtn = this.root.querySelector('[data-act="back"]')!;

    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('change', this.onChange);
    host.addEventListener('keydown', this.onKeydown);

    this.prevFocus = document.activeElement;
    this.prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(host);

    this.goto('start');
    requestAnimationFrame(() => requestAnimationFrame(() => this.wrap.classList.add('in')));
    this.events.emit('open', { product });
  }

  close(reason = 'user'): void {
    if (this.closed) return;
    this.closed = true;
    this.abort?.abort();
    this.stopCamera();
    this.stopProgress();
    this.wrap.classList.remove('in');
    document.documentElement.style.overflow = this.prevOverflow;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      this.host.remove();
      if (this.photoUrl) URL.revokeObjectURL(this.photoUrl);
      if (this.result?.mock) URL.revokeObjectURL(this.result.imageUrl);
    }, reduce ? 0 : 300);
    if (this.prevFocus instanceof HTMLElement) this.prevFocus.focus({ preventScroll: true });
    this.events.emit('close', { product: this.product, reason });
    this.onClosed();
  }

  /* ------------------------------------------------------------------ */
  /* events                                                              */
  /* ------------------------------------------------------------------ */

  private onClick = (e: Event) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-act], [data-size], [data-mode]');
    if (!el) return;
    if (el.dataset.size != null) return this.pickSize(el.dataset.size);
    if (el.dataset.mode) return this.setCompare(el.dataset.mode as 'side' | 'slider');

    switch (el.dataset.act) {
      case 'close': return this.close('user');
      case 'back': return this.goto('start');
      case 'camera': return this.goto('camera');
      case 'pick': return this.pickFile();
      case 'flip': return this.flipCamera();
      case 'timer': return this.toggleTimer(el);
      case 'shutter': return void this.shoot();
      case 'retake': return this.photoSource === 'camera' ? this.goto('camera') : this.pickFile();
      case 'go': return void this.process();
      case 'cancel': return this.abort?.abort();
      case 'cart': return this.addToCart(el as HTMLButtonElement);
      case 'save': return void this.save();
      case 'again': return this.goto('start');
      case 'retry': return void this.process();
    }
  };

  private onChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.type !== 'file') return;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.handleFile(file);
  };

  private onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.close('escape');
      return;
    }
    if (e.key !== 'Tab') return;
    const items = Array.from(this.root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden',
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = this.root.activeElement;
    if (e.shiftKey && (active === first || !active)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  /* ------------------------------------------------------------------ */
  /* navigation                                                          */
  /* ------------------------------------------------------------------ */

  private goto(screen: Screen): void {
    if (this.screen === 'camera' && screen !== 'camera') this.stopCamera();
    if (screen !== 'processing') this.stopProgress();
    this.screen = screen;
    this.dialog.dataset.screen = screen;
    this.backBtn.style.visibility = ['camera', 'review', 'error'].includes(screen) ? 'visible' : 'hidden';
    this.screenEl.scrollTop = 0;

    switch (screen) {
      case 'start': this.renderStart(); break;
      case 'camera': this.renderCamera(); break;
      case 'review': this.renderReview(); break;
      case 'processing': this.renderProcessing(); break;
      case 'result': this.renderResult(); break;
      case 'error': this.renderError(); break;
    }

    const focusTarget =
      this.screenEl.querySelector<HTMLElement>('[data-autofocus]') ||
      this.screenEl.querySelector<HTMLElement>(FOCUSABLE);
    focusTarget?.focus({ preventScroll: true });
  }

  private $<T extends Element = HTMLElement>(sel: string): T | null {
    return this.screenEl.querySelector<T>(sel) as T | null;
  }

  /* ------------------------------------------------------------------ */
  /* start                                                               */
  /* ------------------------------------------------------------------ */

  private renderStart(): void {
    const { t, product } = this;
    const hasCamera = !!navigator.mediaDevices?.getUserMedia;
    this.screenEl.innerHTML = `
      <div data-zone class="group/start relative grid min-h-full content-start gap-[22px] px-5 pb-7 pt-[22px]
                  md:grid-cols-[300px_minmax(0,1fr)] md:content-center md:items-center md:gap-11 md:px-11 md:py-8">
        <figure class="relative aspect-[3/4] w-[112px] overflow-hidden rounded-vto bg-soft md:w-full">
          <img class="${FULL_IMG}" src="${esc(product.image)}" alt="${esc(product.name || '')}">
          <figcaption class="absolute bottom-3 left-3 hidden rounded-full bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-[11px] py-1.5 text-xs font-semibold text-ink backdrop-blur md:block">${esc(t('tryingOn'))}</figcaption>
        </figure>
        <div>
          <h2 class="mb-2.5 text-[25px] font-semibold leading-[1.12] tracking-[-0.015em] md:text-[30px]">${esc(t('startHeading'))}</h2>
          <p class="mb-5 max-w-[38ch] text-[15.5px] text-muted md:mb-[26px]">${esc(t('startBody'))}</p>
          <div class="grid max-w-[440px] gap-2.5">
            ${hasCamera ? `
            <button class="${CHOICE}" data-act="camera" data-autofocus>
              <span class="${CHOICE_IC} bg-accent text-on-accent">${icons.camera}</span>
              <span><strong class="block text-[15px] font-semibold">${esc(t('takePhoto'))}</strong><span class="block text-[13px] text-muted">${esc(t('takePhotoSub'))}</span></span>
            </button>` : ''}
            <button class="${CHOICE}" data-act="pick">
              <span class="${CHOICE_IC} ${hasCamera ? 'bg-soft text-ink' : 'bg-accent text-on-accent'}">${icons.upload}</span>
              <span><strong class="block text-[15px] font-semibold">${esc(t('uploadPhoto'))}</strong><span class="block text-[13px] text-muted">${esc(t('uploadPhotoSub'))}</span></span>
            </button>
            ${FILE_INPUT}
          </div>
          <p data-inline-error class="mt-3.5 max-w-[440px] rounded-[10px] bg-danger-soft px-[13px] py-2.5 text-[13.5px] text-danger" role="alert" hidden></p>
          <ul class="mt-5 grid list-none gap-[9px] p-0 md:mt-[26px]">
            ${(['tip1', 'tip2', 'tip3'] as const)
              .map((k, i) => `<li class="flex items-center gap-2.5 text-[13.5px] text-muted [&>svg]:flex-none [&>svg]:text-accent-text">${[icons.person, icons.sun, icons.frame][i]}<span>${esc(t(k))}</span></li>`)
              .join('')}
          </ul>
        </div>
        <div class="pointer-events-none absolute inset-3.5 grid place-items-center rounded-[18px] border-2 border-dashed border-accent-text bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] text-base font-semibold text-accent-text opacity-0 transition-opacity group-[.dragging]/start:opacity-100">${esc(t('dropHere'))}</div>
      </div>`;

    const zone = this.$('[data-zone]')!;
    let depth = 0;
    zone.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; zone.classList.add('dragging'); });
    zone.addEventListener('dragover', (e) => e.preventDefault());
    zone.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; zone.classList.remove('dragging'); } });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      zone.classList.remove('dragging');
      const file = (e as DragEvent).dataTransfer?.files?.[0];
      if (file) void this.handleFile(file);
    });
  }

  private pickFile(): void {
    this.root.querySelector<HTMLInputElement>('input[type="file"]')?.click();
  }

  private showInlineError(code: ErrorCode): void {
    if (this.screen !== 'start') this.goto('start');
    const box = this.$<HTMLElement>('[data-inline-error]');
    if (!box) return;
    box.textContent = this.t(`err_${code}` as StringKey);
    box.hidden = false;
  }

  private async handleFile(file: File): Promise<void> {
    if (!/^image\/(jpe?g|png|webp)$/i.test(file.type)) return this.showInlineError('file_type');
    if (file.size > this.cfg.maxFileSize) return this.showInlineError('file_size');
    try {
      const blob = await preparePhoto(file, this.cfg.maxPhotoEdge);
      if (this.closed) return;
      this.setPhoto(blob, 'upload');
      this.goto('review');
    } catch {
      this.showInlineError('file_type');
    }
  }

  private setPhoto(blob: Blob, source: 'camera' | 'upload'): void {
    if (this.photoUrl) URL.revokeObjectURL(this.photoUrl);
    this.photo = blob;
    this.photoUrl = URL.createObjectURL(blob);
    this.photoSource = source;
    this.events.emit('photo', { product: this.product, source });
  }

  /* ------------------------------------------------------------------ */
  /* camera                                                              */
  /* ------------------------------------------------------------------ */

  private renderCamera(): void {
    const { t } = this;
    this.screenEl.innerHTML = `
      <div data-cam class="grid h-full grid-rows-[minmax(0,1fr)_auto] bg-cam text-white [&.mirror_video]:[transform:scaleX(-1)]${this.facing === 'user' ? ' mirror' : ''}">
        <div class="relative grid place-items-center overflow-hidden">
          <video class="${FULL_IMG}" playsinline muted autoplay></video>
          ${bodyGuide}
          <div data-cam-status class="${CAM_CHIP}">${esc(t('cameraStarting'))}</div>
          <div data-cam-hint class="${CAM_CHIP}" hidden>${esc(t('cameraHint'))}</div>
          <div data-countdown class="pointer-events-none absolute inset-0 grid place-items-center text-[110px] font-bold [text-shadow:0_4px_30px_rgba(0,0,0,.4)]" aria-live="assertive"></div>
          <div data-flash class="pointer-events-none absolute inset-0 bg-white opacity-0 [&.go]:animate-flash"></div>
          <div data-cam-msg class="absolute inset-0 grid place-content-center justify-items-center gap-[18px] bg-cam p-8 text-center text-[15px] text-white/85" hidden>
            <p class="max-w-[34ch]"></p>
            <button class="${BTN_PRIMARY}" data-act="pick">${icons.upload}<span>${esc(t('uploadInstead'))}</span></button>
            ${FILE_INPUT}
          </div>
        </div>
        <div class="flex items-center justify-center gap-11 px-4 pt-[18px] pb-[calc(18px+env(safe-area-inset-bottom))]">
          <button class="${CAM_BTN}" data-act="timer" aria-pressed="${this.timerOn}" aria-label="${esc(t('timer'))}">${icons.timer}</button>
          <button class="group/shutter grid h-[76px] w-[76px] place-items-center rounded-full border-4 border-white" data-act="shutter" aria-label="${esc(t('shutter'))}" data-autofocus disabled>
            <span class="h-[58px] w-[58px] rounded-full bg-white transition group-active/shutter:scale-[.88] group-disabled/shutter:opacity-35"></span>
          </button>
          <button class="${CAM_BTN}" data-act="flip" aria-label="${esc(t('flip'))}">${icons.flip}</button>
        </div>
      </div>`;
    void this.startCamera();
  }

  private async startCamera(): Promise<void> {
    const video = this.$<HTMLVideoElement>('video');
    if (!video) return;
    this.stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: this.facing, width: { ideal: 1440 }, height: { ideal: 1920 } },
      });
      if (this.closed || this.screen !== 'camera') {
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }
      this.stream = stream;
      video.srcObject = stream;
      await video.play().catch(() => {});
      this.$('[data-cam-status]')?.setAttribute('hidden', '');
      this.$('[data-cam-hint]')?.removeAttribute('hidden');
      const shutter = this.$<HTMLButtonElement>('[data-act="shutter"]');
      if (shutter) {
        shutter.disabled = false;
        shutter.focus({ preventScroll: true });
      }
    } catch (err) {
      const name = (err as DOMException)?.name;
      const denied = name === 'NotAllowedError' || name === 'SecurityError';
      const msg = this.$<HTMLElement>('[data-cam-msg]');
      if (!msg) return;
      msg.querySelector('p')!.textContent = this.t(denied ? 'cameraDenied' : 'cameraUnavailable');
      msg.hidden = false;
      this.$('[data-cam-status]')?.setAttribute('hidden', '');
      msg.querySelector<HTMLElement>('button')?.focus();
    }
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach((tr) => tr.stop());
    this.stream = null;
    this.counting = false;
  }

  private flipCamera(): void {
    this.facing = this.facing === 'user' ? 'environment' : 'user';
    this.$('[data-cam]')?.classList.toggle('mirror', this.facing === 'user');
    const shutter = this.$<HTMLButtonElement>('[data-act="shutter"]');
    if (shutter) shutter.disabled = true;
    void this.startCamera();
  }

  private toggleTimer(btn: HTMLElement): void {
    this.timerOn = !this.timerOn;
    btn.setAttribute('aria-pressed', String(this.timerOn));
  }

  private async shoot(): Promise<void> {
    const video = this.$<HTMLVideoElement>('video');
    if (!video || !this.stream || this.counting || !video.videoWidth) return;
    if (this.timerOn) {
      this.counting = true;
      const cd = this.$<HTMLElement>('[data-countdown]')!;
      for (let n = 3; n > 0; n--) {
        cd.textContent = String(n);
        await sleep(1000);
        if (!this.counting || this.screen !== 'camera') return;
      }
      cd.textContent = '';
      this.counting = false;
    }
    const flash = this.$<HTMLElement>('[data-flash]');
    flash?.classList.remove('go');
    void flash?.offsetWidth;
    flash?.classList.add('go');
    const blob = await captureFrame(video, this.facing === 'user', this.cfg.maxPhotoEdge);
    if (this.closed) return;
    this.setPhoto(blob, 'camera');
    this.goto('review');
  }

  /* ------------------------------------------------------------------ */
  /* review                                                              */
  /* ------------------------------------------------------------------ */

  private renderReview(): void {
    const { t } = this;
    this.screenEl.innerHTML = `
      <div class="${STAGE}">
        <div class="${FRAME}"><img class="${FULL_IMG}" src="${this.photoUrl}" alt="${esc(t('yourPhoto'))}"></div>
        <div class="${ROW}">
          <button class="${BTN_SECONDARY}" data-act="retake">${icons.refresh}<span>${esc(t(this.photoSource === 'camera' ? 'retake' : 'chooseAnother'))}</span></button>
          <button class="${BTN_PRIMARY}" data-act="go" data-autofocus>${icons.sparkle}<span>${esc(t('usePhoto'))}</span></button>
          ${FILE_INPUT}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* processing                                                          */
  /* ------------------------------------------------------------------ */

  private renderProcessing(): void {
    const { t } = this;
    this.screenEl.innerHTML = `
      <div class="${STAGE}">
        <div class="${FRAME}">
          <img class="${FULL_IMG} brightness-[.92] saturate-[.55]" src="${this.photoUrl}" alt="${esc(t('yourPhoto'))}">
          <div class="vto-seam"></div>
        </div>
        <div class="grid w-full max-w-[360px] justify-items-center gap-2.5 text-center">
          <p data-status class="min-h-[1.5em] text-[16.5px] font-semibold"></p>
          <div data-progress class="h-1 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <span class="block h-full w-0 rounded-full bg-accent transition-[width] duration-500 ease-vto"></span>
          </div>
          <p class="text-[13px] text-muted">${esc(t('waitNote'))}</p>
          <button class="${BTN_GHOST}" data-act="cancel">${esc(t('cancel'))}</button>
        </div>
      </div>`;
  }

  private setStatus(status: TryOnStatus): void {
    const line = this.$<HTMLElement>('[data-status]');
    if (line) line.textContent = this.t(`status_${status}` as StringKey);
  }

  private startProgress(): void {
    this.stopProgress();
    const expected = this.api.isMock ? 4200 : 16000;
    const started = performance.now();
    const tick = () => {
      const elapsed = performance.now() - started;
      this.setProgress(92 * (1 - Math.exp(-elapsed / (expected / 2.3))));
    };
    tick();
    this.progressTimer = window.setInterval(tick, 250);
  }

  private setProgress(pct: number): void {
    const bar = this.$<HTMLElement>('[data-progress]');
    if (!bar) return;
    (bar.firstElementChild as HTMLElement).style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(Math.round(pct)));
  }

  private stopProgress(): void {
    if (this.progressTimer) clearInterval(this.progressTimer);
    this.progressTimer = 0;
  }

  private async process(): Promise<void> {
    if (!this.photo) return this.goto('start');
    this.goto('processing');
    this.setStatus('upload');
    this.startProgress();
    const ac = new AbortController();
    this.abort = ac;
    try {
      const res = await this.api.run(this.photo, this.product, {
        signal: ac.signal,
        onStatus: (s) => this.setStatus(s),
      });
      if (this.closed) return;
      if (this.result?.mock) URL.revokeObjectURL(this.result.imageUrl);
      this.result = res;
      this.stopProgress();
      this.setProgress(100);
      await preload(res.imageUrl);
      if (this.closed) return;
      this.events.emit('result', { product: this.product, imageUrl: res.imageUrl, mock: res.mock });
      this.goto('result');
    } catch (err) {
      this.stopProgress();
      if (this.closed) return;
      const code: ErrorCode = err instanceof TryOnError ? err.code : 'server';
      if (code === 'cancelled') return this.goto('review');
      this.lastError = code;
      this.events.emit('error', { product: this.product, code, message: (err as Error)?.message });
      this.goto('error');
    } finally {
      if (this.abort === ac) this.abort = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /* result                                                              */
  /* ------------------------------------------------------------------ */

  private renderResult(): void {
    const { t, product, result } = this;
    if (!result) return;
    const sizes = product.sizes || [];
    const tab =
      'rounded-full px-[15px] py-[7px] text-[13px] font-semibold text-muted transition aria-selected:bg-surface aria-selected:text-ink aria-selected:shadow-[0_1px_3px_rgba(0,0,0,.12)]';
    this.screenEl.innerHTML = `
      <div class="grid gap-5 p-4 md:h-full md:grid-cols-[minmax(0,1fr)_280px] md:gap-7 md:px-[26px] md:py-[22px]">
        <div class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3.5">
          <div class="inline-flex justify-self-start rounded-full bg-soft p-1" role="tablist" aria-label="${esc(t('compareLabel'))}">
            <button class="${tab}" role="tab" data-mode="side" aria-selected="${this.compare === 'side'}">${esc(t('sideBySide'))}</button>
            <button class="${tab}" role="tab" data-mode="slider" aria-selected="${this.compare === 'slider'}">${esc(t('slider'))}</button>
          </div>
          <div data-compare class="grid min-h-0 justify-items-center"></div>
        </div>
        <aside class="flex min-h-0 flex-col gap-[22px]">
          <div>
            ${product.name ? `<h3 class="text-[19px] font-semibold leading-tight tracking-[-0.01em]">${esc(product.name)}</h3>` : ''}
            ${product.price ? `<p class="mt-1 text-[15px] tabular-nums text-muted">${esc(product.price)}</p>` : ''}
          </div>
          ${sizes.length ? `
          <div>
            <p class="mb-[9px] text-[13px] font-semibold" id="vto-size-label">${esc(t('size'))}</p>
            <div data-chips class="flex flex-wrap gap-2 [&.shake]:animate-shake" role="radiogroup" aria-labelledby="vto-size-label">
              ${sizes.map((s) => `<button class="h-[42px] min-w-12 rounded-[10px] border border-line px-[13px] text-sm font-semibold transition hover:border-ink aria-checked:border-ink aria-checked:bg-ink aria-checked:text-surface" role="radio" data-size="${esc(s)}" aria-checked="${this.size === s}">${esc(s)}</button>`).join('')}
            </div>
            <p data-size-error class="mt-2 text-[13px] text-danger" role="alert" hidden>${esc(t('selectSize'))}</p>
          </div>` : ''}
          ${result.mock ? `<p class="rounded-[10px] bg-soft px-3 py-2.5 text-[12.5px] leading-normal text-muted">${esc(t('demoNote'))}</p>` : ''}
          <div class="grid gap-2 md:mt-auto [&>button]:w-full">
            <button class="${BTN_PRIMARY}" data-act="cart" data-autofocus>${icons.bag}<span>${esc(t('addToCart'))}</span></button>
            <button class="${BTN_SECONDARY}" data-act="save">${icons.download}<span>${esc(t('save'))}</span></button>
            <button class="${BTN_GHOST}" data-act="again">${icons.refresh}<span>${esc(t('newPhoto'))}</span></button>
          </div>
        </aside>
      </div>`;
    this.renderCompare();
  }

  private setCompare(mode: 'side' | 'slider'): void {
    if (mode === this.compare) return;
    this.compare = mode;
    this.screenEl.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.mode === mode)),
    );
    this.renderCompare();
  }

  private renderCompare(): void {
    const area = this.$<HTMLElement>('[data-compare]');
    const { t, product, result } = this;
    if (!area || !result) return;
    const modelAlt = esc(`${t('model')}${product.name ? `, ${product.name}` : ''}`);
    const youAlt = esc(t('you'));
    const fig = 'grid min-h-0 grid-rows-[auto_auto] gap-[9px] md:grid-rows-[minmax(0,1fr)_auto]';
    const box = 'aspect-[3/4] min-h-0 overflow-hidden rounded-vto bg-soft md:aspect-auto';

    if (this.compare === 'side') {
      area.innerHTML = `
        <div class="grid min-h-0 w-full grid-cols-2 gap-2 md:gap-3">
          <figure class="${fig}">
            <div class="${box}"><img class="${FULL_IMG}" src="${esc(product.image)}" alt="${modelAlt}"></div>
            <figcaption class="flex items-center gap-[7px] text-[13px] text-muted">${esc(t('model'))}</figcaption>
          </figure>
          <figure class="${fig}">
            <div class="${box} shadow-[0_0_0_2px_var(--accent)]"><img class="${FULL_IMG}" src="${esc(result.imageUrl)}" alt="${youAlt}"></div>
            <figcaption class="flex items-center gap-[7px] text-[13px] font-semibold text-ink"><i class="h-2 w-2 rounded-full bg-accent"></i>${esc(t('you'))}</figcaption>
          </figure>
        </div>`;
      return;
    }

    const img = `pointer-events-none absolute inset-0 ${FULL_IMG}`;
    area.innerHTML = `
      <div data-slide class="group/slide relative aspect-[3/4] w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-vto bg-soft md:h-full md:w-auto md:max-w-full" style="--pos:${this.pos}%">
        <img class="${img}" src="${esc(result.imageUrl)}" alt="${youAlt}">
        <img class="${img} [clip-path:inset(0_calc(100%-var(--pos))_0_0)]" src="${esc(product.image)}" alt="${modelAlt}">
        <span class="absolute inset-y-0 left-[var(--pos)] w-0 -translate-x-px border-l-2 border-dashed border-white drop-shadow-[0_0_2px_rgba(0,0,0,.35)]"></span>
        <span data-knob class="absolute left-[var(--pos)] top-1/2 grid h-[46px] w-[46px] -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center rounded-full bg-surface text-ink shadow-[0_6px_18px_rgba(0,0,0,.28)] transition-transform group-[.dragging]/slide:scale-105 group-[.dragging]/slide:cursor-grabbing"
          role="slider" tabindex="0" aria-label="${esc(t('compareLabel'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${this.pos}">${icons.chevrons}</span>
        <span class="${TAG} left-3 bg-cam/55 text-white">${esc(t('model'))}</span>
        <span class="${TAG} right-3 bg-accent text-on-accent">${esc(t('you'))}</span>
      </div>`;
    this.bindSlider(area.querySelector<HTMLElement>('[data-slide]')!);
  }

  private bindSlider(slide: HTMLElement): void {
    const knob = slide.querySelector<HTMLElement>('[data-knob]')!;
    const set = (pct: number) => {
      this.pos = Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10;
      slide.style.setProperty('--pos', `${this.pos}%`);
      knob.setAttribute('aria-valuenow', String(Math.round(this.pos)));
    };
    const fromEvent = (e: PointerEvent) => {
      const r = slide.getBoundingClientRect();
      set(((e.clientX - r.left) / r.width) * 100);
    };
    slide.addEventListener('pointerdown', (e) => {
      slide.setPointerCapture(e.pointerId);
      slide.classList.add('dragging');
      fromEvent(e);
      knob.focus({ preventScroll: true });
    });
    slide.addEventListener('pointermove', (e) => {
      if (slide.hasPointerCapture(e.pointerId)) fromEvent(e);
    });
    const end = (e: PointerEvent) => {
      if (slide.hasPointerCapture(e.pointerId)) slide.releasePointerCapture(e.pointerId);
      slide.classList.remove('dragging');
    };
    slide.addEventListener('pointerup', end);
    slide.addEventListener('pointercancel', end);
    knob.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 4;
      if (e.key === 'ArrowLeft') set(this.pos - step);
      else if (e.key === 'ArrowRight') set(this.pos + step);
      else if (e.key === 'Home') set(0);
      else if (e.key === 'End') set(100);
      else return;
      e.preventDefault();
    });
  }

  private pickSize(size: string): void {
    this.size = size;
    this.screenEl.querySelectorAll<HTMLElement>('[data-size]').forEach((c) =>
      c.setAttribute('aria-checked', String(c.dataset.size === size)),
    );
    this.$('[data-size-error]')?.setAttribute('hidden', '');
  }

  private addToCart(btn: HTMLButtonElement): void {
    if (!this.result) return;
    const sizes = this.product.sizes || [];
    if (sizes.length && !this.size) {
      const err = this.$<HTMLElement>('[data-size-error]');
      const chips = this.$<HTMLElement>('[data-chips]');
      if (err) err.hidden = false;
      chips?.classList.remove('shake');
      void chips?.offsetWidth;
      chips?.classList.add('shake');
      chips?.querySelector<HTMLElement>('[data-size]')?.focus();
      return;
    }
    this.events.emit('addToCart', { product: this.product, size: this.size, imageUrl: this.result.imageUrl });
    btn.classList.add('done');
    btn.disabled = true;
    btn.innerHTML = `${icons.check}<span>${esc(this.t('added'))}</span>`;
    if (this.cfg.closeOnAddToCart) setTimeout(() => this.close('added_to_cart'), 1100);
  }

  private async save(): Promise<void> {
    if (!this.result) return;
    const url = this.result.imageUrl;
    const slug = (this.product.name || 'try-on').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const blobUrl = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${slug || 'try-on'}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  }

  /* ------------------------------------------------------------------ */
  /* error                                                               */
  /* ------------------------------------------------------------------ */

  private renderError(): void {
    const { t } = this;
    const code = this.lastError;
    const canRetry = !['invalid_photo', 'auth'].includes(code);
    this.screenEl.innerHTML = `
      <div class="grid min-h-full place-content-center justify-items-center gap-3.5 px-6 py-10 text-center">
        <div class="grid h-[60px] w-[60px] place-items-center rounded-full bg-danger-soft text-danger">${icons.alert}</div>
        <h2 class="text-[21px] font-semibold">${esc(t('errorHeading'))}</h2>
        <p class="mb-2 max-w-[42ch] text-muted">${esc(t(`err_${code}` as StringKey))}</p>
        <div class="${ROW}">
          <button class="${canRetry ? BTN_SECONDARY : BTN_PRIMARY}" data-act="again"${canRetry ? '' : ' data-autofocus'}>${esc(t('chooseAnother'))}</button>
          ${canRetry ? `<button class="${BTN_PRIMARY}" data-act="retry" data-autofocus>${esc(t('retry'))}</button>` : ''}
        </div>
      </div>`;
  }
}

function preload(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });
}
