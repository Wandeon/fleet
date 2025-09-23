import { describe, expect, it } from 'vitest';
import { createHttpError, mapUpstreamError } from '../../src/util/errors';

describe('mapUpstreamError', () => {
  it('returns timeout error when abort code is present', () => {
    const upstream = mapUpstreamError(Object.assign(new Error('Aborted'), { code: 'ABORT_ERR' }), {
      deviceId: 'pi-audio-01',
      operation: 'GET /status'
    });
    expect(upstream.status).toBe(504);
    expect(upstream.code).toBe('upstream_timeout');
    expect(upstream.reason).toBe('timeout');
  });

  it('returns unreachable error when ECONNREFUSED', () => {
    const upstream = mapUpstreamError(Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' }), {
      deviceId: 'pi-audio-02',
      operation: 'GET /status'
    });
    expect(upstream.status).toBe(502);
    expect(upstream.code).toBe('upstream_unreachable');
    expect(upstream.reason).toBe('unreachable');
  });

  it('passes through http errors', () => {
    const err = Object.assign(createHttpError(409, 'conflict', 'Device busy'), { reason: 'http' as const });
    const upstream = mapUpstreamError(err, { deviceId: 'pi', operation: 'POST /play' });
    expect(upstream.status).toBe(409);
    expect(upstream.reason).toBe('http');
  });
});
