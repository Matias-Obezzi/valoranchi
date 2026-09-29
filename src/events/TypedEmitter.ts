import { EventEmitter } from "node:events";

export class TypedEmitter<Events extends Record<string, unknown[]>> {
  private readonly emitter = new EventEmitter();

  on<E extends keyof Events & string>(event: E, listener: (...args: Events[E]) => void): this {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
    return this;
  }

  off<E extends keyof Events & string>(event: E, listener: (...args: Events[E]) => void): this {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
    return this;
  }

  once<E extends keyof Events & string>(event: E, listener: (...args: Events[E]) => void): this {
    this.emitter.once(event, listener as (...args: unknown[]) => void);
    return this;
  }

  emit<E extends keyof Events & string>(event: E, ...args: Events[E]): boolean {
    if (event === "error" && this.emitter.listenerCount("error") === 0) {
      return false;
    }
    return this.emitter.emit(event, ...args);
  }

  removeAllListeners<E extends keyof Events & string>(event?: E): this {
    this.emitter.removeAllListeners(event);
    return this;
  }

  listenerCount<E extends keyof Events & string>(event: E): number {
    return this.emitter.listenerCount(event);
  }
}
