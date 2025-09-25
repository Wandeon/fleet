import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/db.js';
import {
  createLibraryTrack,
  createPlaylist,
  startPlayback,
  setMasterVolume
} from '../services/audio.js';

export async function seedAudioFixtures() {
  await prisma.$transaction([
    prisma.audioPlaylistTrack.deleteMany(),
    prisma.audioPlaylist.deleteMany(),
    prisma.audioSession.deleteMany(),
    prisma.audioDeviceStatus.deleteMany(),
    prisma.audioTrack.deleteMany(),
    prisma.audioSetting.deleteMany()
  ]);

  const ambiance = await createLibraryTrack({
    title: 'Lobby Ambiance',
    artist: 'Fleet',
    durationSeconds: 180,
    format: 'audio/mp3',
    buffer: Buffer.from('ambient-audio'),
    filename: `${randomUUID()}.mp3`,
    tags: ['ambient', 'welcome']
  });

  const paging = await createLibraryTrack({
    title: 'Paging Tone',
    durationSeconds: 10,
    format: 'audio/wav',
    buffer: Buffer.from('paging-tone'),
    filename: `${randomUUID()}.wav`,
    tags: ['alert']
  });

  const playlist = await createPlaylist({
    name: 'Daily Rotation',
    loop: true,
    syncMode: 'synced',
    tracks: [
      { trackId: ambiance.id, order: 0 },
      { trackId: paging.id, order: 1, startOffsetSeconds: 2 }
    ]
  });

  await setMasterVolume(55);

  await startPlayback({
    deviceIds: ['pi-audio-test', 'pi-audio-lounge'],
    playlistId: playlist.id,
    syncMode: 'synced'
  });
}

if (require.main === module) {
  seedAudioFixtures()
    .then(() => {
      console.log('Seeded audio fixtures');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to seed audio fixtures', error);
      process.exit(1);
    });
}
