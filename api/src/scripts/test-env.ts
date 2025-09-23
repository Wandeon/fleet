#!/usr/bin/env tsx

console.log('=== ENVIRONMENT TEST ===');
console.log('AUDIO_PI_AUDIO_01_TOKEN:', process.env.AUDIO_PI_AUDIO_01_TOKEN || 'MISSING');
console.log('AUDIO_PI_AUDIO_02_TOKEN:', process.env.AUDIO_PI_AUDIO_02_TOKEN || 'MISSING');
console.log('VIDEO_PI_VIDEO_01_TOKEN:', process.env.VIDEO_PI_VIDEO_01_TOKEN || 'MISSING');
console.log('HDMI_PI_VIDEO_01_TOKEN:', process.env.HDMI_PI_VIDEO_01_TOKEN || 'MISSING');
console.log('CAMERA_PI_CAMERA_01_TOKEN:', process.env.CAMERA_PI_CAMERA_01_TOKEN || 'MISSING');

console.log('\nAll environment variables with TOKEN:');
Object.keys(process.env)
  .filter(key => key.includes('TOKEN'))
  .forEach(key => console.log(`${key}: ${process.env[key]}`));