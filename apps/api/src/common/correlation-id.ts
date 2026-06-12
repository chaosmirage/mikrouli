import { AsyncLocalStorage } from 'async_hooks';

interface CorrelationStore {
  correlationId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<CorrelationStore>();

export { asyncLocalStorage };

export function getCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId;
}
