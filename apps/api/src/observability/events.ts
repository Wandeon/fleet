export type EventSeverity = 'info' | 'warn' | 'error';

export interface FleetEvent {
  timestamp: string;
  type: string;
  target?: string;
  message: string;
  severity: EventSeverity;
  metadata?: Record<string, unknown>;
}

const MAX_EVENTS = 200;
const events: FleetEvent[] = [];

export function recordEvent(event: Omit<FleetEvent, 'timestamp'> & { timestamp?: string }): void {
  const enriched: FleetEvent = {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };

  events.push(enriched);
  if (events.length > MAX_EVENTS) {
    events.shift();
  }
}

export function listEvents(limit = 50): FleetEvent[] {
  return events.slice(-limit).reverse();
}

export function resetEvents(): void {
  events.length = 0;
}
