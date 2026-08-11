type Listener<T> = (payload: T) => void;

/** Minimal typed pub/sub bus. Decouples chess rules from the visual layer. */
export class EventManager<EventMap extends object> {
  private listeners = new Map<keyof EventMap, Set<Listener<never>>>();

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener as Listener<never>);
    return () => this.off(event, listener);
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<never>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.listeners.get(event)?.forEach((listener) => (listener as Listener<EventMap[K]>)(payload));
  }

  clear(): void {
    this.listeners.clear();
  }
}
