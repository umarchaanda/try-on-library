import type { EventMap, EventName } from './types';

type Handler<E extends EventName> = (data: EventMap[E]) => void;

export class Emitter {
  private handlers = new Map<EventName, Set<Handler<any>>>();

  on<E extends EventName>(event: E, handler: Handler<E>): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off<E extends EventName>(event: E, handler: Handler<E>): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit<E extends EventName>(event: E, data: EventMap[E]): void {
    this.handlers.get(event)?.forEach((h) => {
      try {
        h(data);
      } catch (err) {
        console.error(`[VirtualTryOn] "${event}" handler threw:`, err);
      }
    });
    // Also fire a DOM event so stores can listen without touching the JS API.
    try {
      window.dispatchEvent(new CustomEvent(`tryon:${event}`, { detail: data }));
    } catch {
      /* very old browsers */
    }
  }
}
