import { derived, get, writable } from 'svelte/store';

export type ConnectivityStatus = 'online' | 'degraded' | 'offline';
export type PanelState = 'success' | 'loading' | 'error' | 'empty';
export type ModuleKey = 'audio' | 'video' | 'zigbee' | 'camera' | 'health' | 'logs';

export interface ToastMessage {
  id: string;
  message: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
  actionLabel?: string;
  action?: () => void;
  timeout?: number;
}

const defaultModuleStates: Record<ModuleKey, PanelState> = {
  audio: 'success',
  video: 'success',
  zigbee: 'success',
  camera: 'success',
  health: 'success',
  logs: 'success',
};

export const connectivity = writable<ConnectivityStatus>('online');
export const toasts = writable<ToastMessage[]>([]);
export const moduleStates = writable<Record<ModuleKey, PanelState>>({
  ...defaultModuleStates,
});

export const useMocks = writable(import.meta.env.VITE_USE_MOCKS === '1');

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function addToast(toast: Omit<ToastMessage, 'id'> & { id?: string }) {
  const id = toast.id ?? crypto.randomUUID();
  const entry: ToastMessage = { id, variant: 'default', ...toast };
  toasts.update((list) => [...list, entry]);

  if (entry.timeout && typeof window !== 'undefined') {
    const timer = setTimeout(() => removeToast(id), entry.timeout);
    timers.set(id, timer);
  }

  return id;
}

export function removeToast(id: string) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts.update((list) => list.filter((toast) => toast.id !== id));
}

export function clearToasts() {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  toasts.set([]);
}

export function setConnectivity(status: ConnectivityStatus) {
  connectivity.set(status);
}

export function setModuleState(key: ModuleKey, state: PanelState) {
  moduleStates.update((current) => ({ ...current, [key]: state }));
}

export function resetModuleStates() {
  moduleStates.set({ ...defaultModuleStates });
}

export function createModuleStateStore(key: ModuleKey) {
  return derived(moduleStates, ($states) => $states[key] ?? 'success');
}

export function toggleMockUsage(enabled: boolean) {
  useMocks.set(enabled);
}

export function getModuleState(key: ModuleKey) {
  return get(moduleStates)[key] ?? 'success';
}
