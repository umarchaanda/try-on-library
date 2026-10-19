import type { ErrorCode, Product, ResolvedConfig, TryOnResult, TryOnStatus } from './types';
export declare class TryOnError extends Error {
    code: ErrorCode;
    constructor(code: ErrorCode, message?: string);
}
export declare function sleep(ms: number, signal?: AbortSignal): Promise<void>;
export interface RunOptions {
    signal?: AbortSignal;
    onStatus?: (status: TryOnStatus) => void;
}
/**
 * Backend contract:
 *   POST {endpoint}/v1/tryon        multipart: person_image (file), garment_image_url, product_id?
 *                                    -> { job_id, status }
 *   GET  {endpoint}/v1/tryon/{id}   -> { job_id, status, result_url?, error_code?, error? }
 * Every request carries the X-Api-Key header.
 */
export declare class ApiClient {
    private cfg;
    constructor(cfg: ResolvedConfig);
    get isMock(): boolean;
    run(photo: Blob, product: Product, opts?: RunOptions): Promise<TryOnResult>;
    private request;
    private runMock;
}
