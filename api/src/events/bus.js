import { EventEmitter } from 'events';

export const EVENTS = {
  JOB_CREATED: 'job.created',
  JOB_UPDATED: 'job.updated',
  STATE_UPDATED: 'state.updated',
  EVENT_APPENDED: 'device.event',
};

export const bus = new EventEmitter();
bus.setMaxListeners(0);
