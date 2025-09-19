import { writable } from 'svelte/store';

export const deviceStates = writable<Record<string, any>>({});
export const jobs = writable<Record<string, any>>({});

export function connectSSE(base = '/api') {
  const es = new EventSource(`${base.replace(/\/$/, '')}/stream`, { withCredentials: false });
  es.addEventListener('state', (event: MessageEvent) => {
    const { deviceId, state } = JSON.parse(event.data);
    deviceStates.update((current) => ({ ...current, [deviceId]: state }));
  });
  es.addEventListener('job', (event: MessageEvent) => {
    const { jobId, status, error } = JSON.parse(event.data);
    jobs.update((current) => ({ ...current, [jobId]: { status, error } }));
  });
  return es;
}
