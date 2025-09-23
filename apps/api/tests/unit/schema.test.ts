import { describe, expect, it } from 'vitest';
import {
  audioConfigSchema,
  audioPlaySchema,
  audioVolumeSchema,
  deviceIdParamSchema
} from '../../src/util/schema/audio';

describe('audio schemas', () => {
  it('validates volume within range', () => {
    const parsed = audioVolumeSchema.parse({ volume: 1.2 });
    expect(parsed.volume).toBeCloseTo(1.2);
  });

  it('rejects volume above max', () => {
    expect(() => audioVolumeSchema.parse({ volume: 3.5 })).toThrow();
  });

  it('validates play payload', () => {
    const parsed = audioPlaySchema.parse({ source: 'stream', mode: 'auto' });
    expect(parsed.source).toBe('stream');
  });

  it('rejects invalid play source', () => {
    expect(() => audioPlaySchema.parse({ source: 'bluetooth' })).toThrow();
  });

  it('validates config payload', () => {
    const parsed = audioConfigSchema.parse({ stream_url: 'http://example.com/stream.mp3' });
    expect(parsed.stream_url).toContain('example.com');
  });

  it('rejects bad config URL', () => {
    expect(() => audioConfigSchema.parse({ stream_url: 'not-a-url' })).toThrow();
  });

  it('parses device id param', () => {
    const parsed = deviceIdParamSchema.parse({ deviceId: 'pi-audio-01' });
    expect(parsed.deviceId).toBe('pi-audio-01');
  });
});
