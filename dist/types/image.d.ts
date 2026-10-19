/** Fix EXIF rotation, shrink to maxEdge and re-encode as JPEG. */
export declare function preparePhoto(file: Blob, maxEdge?: number): Promise<Blob>;
/** Grab the current camera frame. Mirrored frames are saved as the shopper saw them. */
export declare function captureFrame(video: HTMLVideoElement, mirror: boolean, maxEdge?: number): Promise<Blob>;
