import { describe, expect, it } from 'vitest';
import {
  audioMasterVolumeSchema,
  audioPlaybackRequestSchema,
  audioPlaybackSessionSchema,
  audioPlaylistSchema,
  audioPlaylistReorderSchema,
  audioSeekSchema,
  audioVolumeSchema,
  deviceIdParamSchema,
  audioSessionSyncSchema,
  audioLibraryUploadRegistrationSchema,
} from '../../src/util/schema/audio.js';

describe('audio schemas', () => {
  it('validates device id param', () => {
    const parsed = deviceIdParamSchema.parse({ deviceId: 'pi-audio-01' });
    expect(parsed.deviceId).toBe('pi-audio-01');
  });

  it('parses master volume range', () => {
    const parsed = audioMasterVolumeSchema.parse({ volumePercent: 40 });
    expect(parsed.volumePercent).toBe(40);
  });

  it('rejects out-of-range master volume', () => {
    expect(() => audioMasterVolumeSchema.parse({ volumePercent: 120 })).toThrow();
  });

  it('validates playlist payload', () => {
    const parsed = audioPlaylistSchema.parse({
      name: 'Morning',
      loop: true,
      syncMode: 'synced',
      tracks: [{ trackId: 'trk_1', order: 0 }],
    });
    expect(parsed.tracks[0].trackId).toBe('trk_1');
  });

  it('validates playlist reorder payload', () => {
    const parsed = audioPlaylistReorderSchema.parse({
      ordering: [
        { trackId: 'trk_2', position: 0 },
        { trackId: 'trk_1', position: 1 },
      ],
    });
    expect(parsed.ordering[0].position).toBe(0);
  });

  it('rejects playlist without name', () => {
    expect(() =>
      audioPlaylistSchema.parse({ loop: false, syncMode: 'independent', tracks: [] })
    ).toThrow();
  });

  it('validates playback request with playlist', () => {
    const parsed = audioPlaybackRequestSchema.parse({
      deviceIds: ['pi-audio-01'],
      playlistId: 'pl_1',
      syncMode: 'synced',
    });
    expect(parsed.deviceIds).toHaveLength(1);
  });

  it('requires playback source', () => {
    expect(() =>
      audioPlaybackRequestSchema.parse({ deviceIds: ['pi-audio-01'], syncMode: 'synced' })
    ).toThrow();
  });

  it('accepts playback session payload with label', () => {
    const parsed = audioPlaybackSessionSchema.parse({
      deviceIds: ['pi-audio-01'],
      trackId: 'track-1',
      syncMode: 'grouped',
      label: 'Evening',
    });
    expect(parsed.label).toBe('Evening');
  });

  it('validates seek payload', () => {
    const parsed = audioSeekSchema.parse({ positionSeconds: 12 });
    expect(parsed.positionSeconds).toBe(12);
  });

  it('rejects negative seek position', () => {
    expect(() => audioSeekSchema.parse({ positionSeconds: -4 })).toThrow();
  });

  it('validates per-device volume', () => {
    const parsed = audioVolumeSchema.parse({ volumePercent: 55 });
    expect(parsed.volumePercent).toBe(55);
  });

  it('validates session sync report', () => {
    const parsed = audioSessionSyncSchema.parse({
      referenceTimestamp: new Date().toISOString(),
      maxDriftSeconds: 0.12,
      perDevice: { 'pi-audio-01': 0.04 },
      correctionsApplied: true,
    });
    expect(parsed.maxDriftSeconds).toBeCloseTo(0.12);
  });

  it('parses upload registration payload defaults', () => {
    const parsed = audioLibraryUploadRegistrationSchema.parse({ filename: 'clip.wav' });
    expect(parsed.contentType).toBe('application/octet-stream');
  });
});
