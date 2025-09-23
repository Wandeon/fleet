#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { normalizeAddress, resolveBearerToken } from '../lib/device-address.js';

const prisma = new PrismaClient();

async function debugPoll() {
  console.log('=== DEBUG POLL START ===');

  try {
    const devices = await prisma.device.findMany({ where: { managed: true } });
    console.log(`Found ${devices.length} devices`);

    for (const device of devices) {
      console.log(`\n--- Device: ${device.id} ---`);
      console.log('Raw address:', device.address);

      // Parse address
      const addressData = typeof device.address === 'string'
        ? JSON.parse(device.address)
        : device.address;
      console.log('Parsed address:', addressData);

      const address = normalizeAddress(addressData);
      console.log('Normalized address:', address);

      const baseUrl = address.baseUrl;
      console.log('Base URL:', baseUrl);

      if (!baseUrl) {
        console.log('SKIP: No baseUrl');
        continue;
      }

      const token = resolveBearerToken(address);
      console.log('Token resolved:', token ? 'YES' : 'NO');
      console.log('Token value:', token || 'NONE');
    }

    // Check DeviceState count
    const count = await prisma.deviceState.count();
    console.log(`\nCurrent DeviceState count: ${count}`);

  } catch (error) {
    console.error('Debug poll error:', error);
  } finally {
    await prisma.$disconnect();
  }

  console.log('=== DEBUG POLL END ===');
}

debugPoll();