import { writable } from 'svelte/store';
import { streamUrl } from '$lib/api';

export const deviceStates = writable<Record<string, any>>({});
export const jobs = writable<Record<string, any>>({});

export function connectSSE(url = streamUrl()) {
  const es = new EventSource(url, { withCredentials: false });
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
