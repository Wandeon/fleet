import crypto from 'crypto';
import { prisma } from '../lib/db.js';
import { getAudioAdapter, getVideoAdapter, getCameraAdapter, getZigbeeAdapter } from '../adapters/devices.js';
import { bus } from '../http/sse.js';

export type CommandStatus = 'pending' | 'in_progress' | 'completed' | 'partial_success' | 'failed';

interface DeviceResult {
  deviceId: string;
  status: 'success' | 'error';
  error?: string;
}

export async function enqueueGroupJob(
  groupId: string,
  command: string,
  payload?: any,
  userId?: string
): Promise<{ jobId: string }> {
  const jobId = crypto.randomUUID();

  // Create CommandLog entry
  await prisma.commandLog.create({
    data: {
      id: jobId,
      userId,
      groupId,
      command,
      payload: payload ? JSON.stringify(payload) : null,
      status: 'pending',
    },
  });

  // Emit SSE event
  bus.emit('job', {
    type: 'JOB_UPDATE',
    data: {
      jobId,
      groupId,
      command,
      status: 'pending' as CommandStatus,
    },
  });

  // Process job asynchronously
  processGroupJob(jobId).catch(error => {
    console.error('Group job processing error:', error);
  });

  return { jobId };
}

async function processGroupJob(jobId: string): Promise<void> {
  try {
    // Update status to in_progress
    await updateJobStatus(jobId, 'in_progress');

    // Get job details
    const job = await prisma.commandLog.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Get group members
    const groupMemberships = await prisma.groupMembership.findMany({
      where: { groupId: job.groupId },
      include: { device: true },
    });

    // Group devices by kind
    const devicesByKind = groupMemberships.reduce((acc, membership) => {
      const kind = membership.device.kind;
      if (!acc[kind]) {
        acc[kind] = [];
      }
      acc[kind].push(membership.device);
      return acc;
    }, {} as Record<string, any[]>);

    if (Object.keys(devicesByKind).length === 0) {
      throw new Error(`No devices found in group ${job.groupId}`);
    }

    // Parse payload
    let parsedPayload: any = null;
    if (job.payload) {
      try {
        parsedPayload = JSON.parse(job.payload);
      } catch (error) {
        console.warn('Failed to parse job payload:', error);
      }
    }

    // Execute command on all devices grouped by kind
    const results: DeviceResult[] = [];

    // Process audio devices
    if (devicesByKind.audio?.length > 0) {
      const adapter = getAudioAdapter();
      for (const device of devicesByKind.audio) {
        try {
          await executeAudioCommand(adapter, device.id, job.command, parsedPayload);
          results.push({
            deviceId: device.id,
            status: 'success',
          });

          // Emit individual device state update
          await emitDeviceStateUpdate(device.id);
        } catch (error) {
          results.push({
            deviceId: device.id,
            status: 'error',
            error: error.message,
          });
        }
      }
    }

    // Process video devices
    if (devicesByKind.video?.length > 0) {
      const adapter = getVideoAdapter();
      for (const device of devicesByKind.video) {
        try {
          await executeVideoCommand(adapter, device.id, job.command, parsedPayload);
          results.push({
            deviceId: device.id,
            status: 'success',
          });

          // Emit individual device state update
          await emitDeviceStateUpdate(device.id);
        } catch (error) {
          results.push({
            deviceId: device.id,
            status: 'error',
            error: error.message,
          });
        }
      }
    }

    // Process camera devices
    if (devicesByKind.camera?.length > 0) {
      const adapter = getCameraAdapter();
      for (const device of devicesByKind.camera) {
        try {
          await executeCameraCommand(adapter, device.id, job.command, parsedPayload);
          results.push({
            deviceId: device.id,
            status: 'success',
          });

          // Emit individual device state update
          await emitDeviceStateUpdate(device.id);
        } catch (error) {
          results.push({
            deviceId: device.id,
            status: 'error',
            error: error.message,
          });
        }
      }
    }

    // Process Zigbee devices (note: video Pi also handles Zigbee)
    if (devicesByKind.zigbee?.length > 0 ||
        (job.command.startsWith('permit_join') || job.command.startsWith('reset') || job.command.startsWith('publish'))) {
      const adapter = getZigbeeAdapter();
      const zigbeeDevices = devicesByKind.zigbee || devicesByKind.video || [];

      for (const device of zigbeeDevices) {
        try {
          await executeZigbeeCommand(adapter, device.id, job.command, parsedPayload);
          results.push({
            deviceId: device.id,
            status: 'success',
          });

          // Emit individual device state update
          await emitDeviceStateUpdate(device.id);
        } catch (error) {
          results.push({
            deviceId: device.id,
            status: 'error',
            error: error.message,
          });
        }
      }
    }

    // Determine overall status
    const successCount = results.filter(r => r.status === 'success').length;
    const totalCount = results.length;

    let finalStatus: CommandStatus;
    if (successCount === totalCount) {
      finalStatus = 'completed';
    } else if (successCount > 0) {
      finalStatus = 'partial_success';
    } else {
      finalStatus = 'failed';
    }

    // Update job with results
    await updateJobStatus(jobId, finalStatus, results);

  } catch (error) {
    console.error('Group job execution error:', error);
    await updateJobStatus(jobId, 'failed', [], error.message);
  }
}

// ===============================================
// DEVICE-SPECIFIC COMMAND EXECUTORS
// ===============================================

async function executeAudioCommand(adapter: any, deviceId: string, command: string, payload: any): Promise<void> {
  switch (command) {
    case 'play':
      if (!payload?.fileId) {
        throw new Error('fileId required for play command');
      }
      const file = await prisma.file.findUnique({
        where: { id: payload.fileId },
      });
      if (!file) {
        throw new Error(`File ${payload.fileId} not found`);
      }
      await adapter.play(deviceId, file.path);
      break;

    case 'pause':
      await adapter.pause(deviceId);
      break;

    case 'stop':
      await adapter.stop(deviceId);
      break;

    case 'volume':
      if (typeof payload?.value !== 'number') {
        throw new Error('value required for volume command');
      }
      await adapter.volume(deviceId, payload.value);
      break;

    case 'next':
    case 'previous':
      // TODO: Implement playlist navigation
      throw new Error(`Command ${command} not yet implemented`);

    default:
      throw new Error(`Unknown audio command: ${command}`);
  }
}

async function executeVideoCommand(adapter: any, deviceId: string, command: string, payload: any): Promise<void> {
  switch (command) {
    case 'power_on':
      await adapter.powerOn(deviceId);
      break;

    case 'power_off':
      await adapter.powerOff(deviceId);
      break;

    case 'input':
      if (!payload?.source) {
        throw new Error('source required for input command');
      }
      await adapter.setInput(deviceId, payload.source);
      break;

    default:
      throw new Error(`Unknown video command: ${command}`);
  }
}

async function executeCameraCommand(adapter: any, deviceId: string, command: string, payload: any): Promise<void> {
  switch (command) {
    case 'reboot':
      await adapter.reboot(deviceId);
      break;

    case 'probe':
      // Note: probe returns data, but for group commands we just execute it
      await adapter.probe(deviceId);
      break;

    default:
      throw new Error(`Unknown camera command: ${command}`);
  }
}

async function executeZigbeeCommand(adapter: any, deviceId: string, command: string, payload: any): Promise<void> {
  switch (command) {
    case 'permit_join':
      const duration = payload?.duration || 60;
      await adapter.permitJoin(deviceId, duration);
      break;

    case 'reset':
      await adapter.reset(deviceId);
      break;

    case 'publish':
      if (!payload?.topic) {
        throw new Error('topic required for publish command');
      }
      if (payload?.payload === undefined) {
        throw new Error('payload required for publish command');
      }
      await adapter.publish(deviceId, payload.topic, payload.payload);
      break;

    default:
      throw new Error(`Unknown Zigbee command: ${command}`);
  }
}

// ===============================================
// UTILITY FUNCTIONS
// ===============================================

async function emitDeviceStateUpdate(deviceId: string): Promise<void> {
  try {
    // Get latest device state and emit SSE update
    const latestState = await prisma.deviceState.findFirst({
      where: { deviceId },
      orderBy: { updatedAt: 'desc' },
    });

    if (latestState) {
      bus.emit('device_state', {
        type: 'DEVICE_STATE_UPDATE',
        data: {
          deviceId: latestState.deviceId,
          status: latestState.status,
          lastSeen: latestState.lastSeen,
          updatedAt: latestState.updatedAt,
          state: JSON.parse(latestState.state),
        },
      });
    }
  } catch (error) {
    console.warn(`Failed to emit device state update for ${deviceId}:`, error);
  }
}

async function updateJobStatus(
  jobId: string,
  status: CommandStatus,
  results?: DeviceResult[],
  error?: string
): Promise<void> {
  // Update database
  await prisma.commandLog.update({
    where: { id: jobId },
    data: {
      status,
      result: results ? JSON.stringify(results) : null,
    },
  });

  // Get updated job for SSE
  const job = await prisma.commandLog.findUnique({
    where: { id: jobId },
  });

  if (job) {
    // Emit SSE event
    bus.emit('job', {
      type: 'JOB_UPDATE',
      data: {
        jobId: job.id,
        groupId: job.groupId,
        command: job.command,
        status: job.status as CommandStatus,
        result: results,
        error,
      },
    });
  }
}