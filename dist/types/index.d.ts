import type { EventMap, EventName, Product, ResolvedConfig, TryOnConfig, TryOnResult } from './types';
export type { TryOnConfig, Product, TryOnResult, EventMap, EventName } from './types';
declare function init(cfg?: TryOnConfig): {
    version: string;
    init: typeof init;
    open: typeof open;
    close: typeof close;
    tryOn: typeof tryOn;
    on: typeof on;
    off: typeof off;
    bind: typeof bind;
    readonly config: Readonly<ResolvedConfig>;
};
declare function open(product: Product): void;
declare function close(): void;
/** Headless: run a try-on without any UI. */
declare function tryOn(options: {
    product: Product;
    photo: Blob;
    signal?: AbortSignal;
}): Promise<TryOnResult>;
declare function on<E extends EventName>(event: E, handler: (data: EventMap[E]) => void): () => void;
declare function off<E extends EventName>(event: E, handler: (data: EventMap[E]) => void): void;
/** Listen for clicks on [data-tryon-product], including buttons added later. */
declare function bind(): void;
declare const VirtualTryOn: {
    version: string;
    init: typeof init;
    open: typeof open;
    close: typeof close;
    tryOn: typeof tryOn;
    on: typeof on;
    off: typeof off;
    bind: typeof bind;
    readonly config: Readonly<ResolvedConfig>;
};
export default VirtualTryOn;
