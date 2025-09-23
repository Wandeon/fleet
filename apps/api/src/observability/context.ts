import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  correlationId: string;
  startTime?: [number, number];
  durationMs?: number;
  errorCode?: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

export function setContextValue<TKey extends keyof RequestContext>(key: TKey, value: RequestContext[TKey]) {
  const ctx = storage.getStore();
  if (ctx) {
    ctx[key] = value as RequestContext[TKey];
  }
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

export { storage as contextStorage };
