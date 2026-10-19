import type { EventMap, EventName } from './types';
type Handler<E extends EventName> = (data: EventMap[E]) => void;
export declare class Emitter {
    private handlers;
    on<E extends EventName>(event: E, handler: Handler<E>): () => void;
    off<E extends EventName>(event: E, handler: Handler<E>): void;
    emit<E extends EventName>(event: E, data: EventMap[E]): void;
}
export {};
