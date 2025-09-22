import { writable } from 'svelte/store';
import { streamUrl } from '$lib/api';
import { goto } from '$app/navigation';

export const deviceStates = writable<Record<string, any>>({});
export const jobs = writable<Record<string, any>>({});
export const sseConnected = writable(false);

export function connectSSE(url = streamUrl()) {
  const es = new EventSource(url, { withCredentials: false });

  es.onopen = () => {
    sseConnected.set(true);
  };

  es.onerror = (error) => {
    sseConnected.set(false);
    // Handle 401 by redirecting to login
    if (error && 'status' in error && error.status === 401) {
      goto('/auth/login');
    }
  };

  // Listen for DEVICE_STATE_UPDATE events
  es.addEventListener('DEVICE_STATE_UPDATE', (event: MessageEvent) => {
    const data = JSON.parse(event.data);
    const { deviceId, state } = data;
    deviceStates.update((current) => ({ ...current, [deviceId]: state }));
  });

  // Listen for JOB_UPDATE events
  es.addEventListener('JOB_UPDATE', (event: MessageEvent) => {
    const data = JSON.parse(event.data);
    const { job_id: jobId, status, error } = data;
    jobs.update((current) => ({ ...current, [jobId]: { status, error } }));
  });

  // Keep legacy event handlers for backward compatibility
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
