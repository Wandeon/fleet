import crypto from 'crypto';
import { prisma } from '../lib/db.js';
import { getAudioAdapter } from '../adapters/devices.js';
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

    const audioDevices = groupMemberships
      .filter(membership => membership.device.kind === 'audio')
      .map(membership => membership.device);

    if (audioDevices.length === 0) {
      throw new Error(`No audio devices found in group ${job.groupId}`);
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

    // Execute command on all devices
    const results: DeviceResult[] = [];
    const adapter = getAudioAdapter();

    for (const device of audioDevices) {
      try {
        await executeCommand(adapter, device.id, job.command, parsedPayload);
        results.push({
          deviceId: device.id,
          status: 'success',
        });
      } catch (error) {
        results.push({
          deviceId: device.id,
          status: 'error',
          error: error.message,
        });
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

async function executeCommand(adapter: any, deviceId: string, command: string, payload: any): Promise<void> {
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
      throw new Error(`Unknown command: ${command}`);
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