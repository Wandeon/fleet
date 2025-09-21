import express from 'express';
import { prisma } from '../lib/db.js';
import { httpError } from './errors.js';
import { enqueueGroupJob } from '../services/group-jobs.js';

export const groupsRouter = express.Router();
groupsRouter.use(express.json());

// GET /api/fleet/layout - Get groups and devices
groupsRouter.get('/fleet/layout', async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      include: {
        members: {
          include: {
            device: true,
          },
        },
      },
    });

    const devices = await prisma.device.findMany();

    // Transform groups to include device details
    const transformedGroups = groups.reduce((acc, group) => {
      acc[group.id] = {
        id: group.id,
        name: group.name,
        kind: group.kind,
        devices: group.members.map(member => ({
          id: member.device.id,
          name: member.device.name,
          kind: member.device.kind,
        })),
      };
      return acc;
    }, {} as Record<string, any>);

    res.json({
      groups: transformedGroups,
      devices: devices.map(device => {
        let address, capabilities;
        try {
          address = JSON.parse(device.address);
          capabilities = JSON.parse(device.capabilities);
        } catch (error) {
          console.warn(`Failed to parse JSON for device ${device.id}:`, error);
          address = {};
          capabilities = {};
        }

        return {
          id: device.id,
          name: device.name,
          kind: device.kind,
          managed: device.managed,
          address,
          capabilities,
          createdAt: device.createdAt,
          updatedAt: device.updatedAt,
        };
      }),
    });
  } catch (error) {
    console.error('Fleet layout error:', error);
    return httpError(res, 500, 'DATABASE_ERROR', 'Failed to retrieve fleet layout');
  }
});

// GET /api/fleet/state - Get latest device states
groupsRouter.get('/fleet/state', async (req, res) => {
  try {
    // Get the latest state for each device
    const latestStates = await prisma.deviceState.findMany({
      distinct: ['deviceId'],
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Transform to key-value format
    const stateMap = latestStates.reduce((acc, state) => {
      let parsedState;
      try {
        parsedState = JSON.parse(state.state);
      } catch (error) {
        console.warn(`Failed to parse state for device ${state.deviceId}:`, error);
        parsedState = {};
      }

      acc[state.deviceId] = {
        deviceId: state.deviceId,
        status: state.status,
        lastSeen: state.lastSeen,
        updatedAt: state.updatedAt,
        state: parsedState,
      };
      return acc;
    }, {} as Record<string, any>);

    res.json({ states: stateMap });
  } catch (error) {
    console.error('Fleet state error:', error);
    return httpError(res, 500, 'DATABASE_ERROR', 'Failed to retrieve fleet state');
  }
});

// POST /api/groups/:groupId/play
groupsRouter.post('/groups/:groupId/play', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { fileId } = req.body;

    if (!fileId) {
      return httpError(res, 400, 'MISSING_FILE_ID', 'fileId is required');
    }

    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return httpError(res, 404, 'GROUP_NOT_FOUND', `Group ${groupId} not found`);
    }

    // Verify file exists
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return httpError(res, 404, 'FILE_NOT_FOUND', `File ${fileId} not found`);
    }

    const { jobId } = await enqueueGroupJob(groupId, 'play', { fileId });

    res.status(202).json({
      accepted: true,
      job_id: jobId,
    });
  } catch (error) {
    console.error('Group play error:', error);
    return httpError(res, 500, 'COMMAND_ERROR', `Failed to execute play command: ${error.message}`);
  }
});

// POST /api/groups/:groupId/pause
groupsRouter.post('/groups/:groupId/pause', async (req, res) => {
  try {
    const { groupId } = req.params;

    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return httpError(res, 404, 'GROUP_NOT_FOUND', `Group ${groupId} not found`);
    }

    const { jobId } = await enqueueGroupJob(groupId, 'pause');

    res.status(202).json({
      accepted: true,
      job_id: jobId,
    });
  } catch (error) {
    console.error('Group pause error:', error);
    return httpError(res, 500, 'COMMAND_ERROR', `Failed to execute pause command: ${error.message}`);
  }
});

// POST /api/groups/:groupId/stop
groupsRouter.post('/groups/:groupId/stop', async (req, res) => {
  try {
    const { groupId } = req.params;

    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return httpError(res, 404, 'GROUP_NOT_FOUND', `Group ${groupId} not found`);
    }

    const { jobId } = await enqueueGroupJob(groupId, 'stop');

    res.status(202).json({
      accepted: true,
      job_id: jobId,
    });
  } catch (error) {
    console.error('Group stop error:', error);
    return httpError(res, 500, 'COMMAND_ERROR', `Failed to execute stop command: ${error.message}`);
  }
});

// POST /api/groups/:groupId/volume
groupsRouter.post('/groups/:groupId/volume', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { value } = req.body;

    if (typeof value !== 'number') {
      return httpError(res, 400, 'INVALID_VOLUME', 'Volume value must be a number');
    }

    if (value < 0 || value > 2) {
      return httpError(res, 400, 'INVALID_VOLUME_RANGE', 'Volume must be between 0 and 2');
    }

    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return httpError(res, 404, 'GROUP_NOT_FOUND', `Group ${groupId} not found`);
    }

    const { jobId } = await enqueueGroupJob(groupId, 'volume', { value });

    res.status(202).json({
      accepted: true,
      job_id: jobId,
    });
  } catch (error) {
    console.error('Group volume error:', error);
    return httpError(res, 500, 'COMMAND_ERROR', `Failed to execute volume command: ${error.message}`);
  }
});

// POST /api/groups/:groupId/next
groupsRouter.post('/groups/:groupId/next', async (req, res) => {
  try {
    const { groupId } = req.params;

    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return httpError(res, 404, 'GROUP_NOT_FOUND', `Group ${groupId} not found`);
    }

    // For now, return 501 Not Implemented until playlist functionality is added
    return httpError(res, 501, 'NOT_IMPLEMENTED', 'Next track functionality not yet implemented');
  } catch (error) {
    console.error('Group next error:', error);
    return httpError(res, 500, 'COMMAND_ERROR', `Failed to execute next command: ${error.message}`);
  }
});

// POST /api/groups/:groupId/previous
groupsRouter.post('/groups/:groupId/previous', async (req, res) => {
  try {
    const { groupId } = req.params;

    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return httpError(res, 404, 'GROUP_NOT_FOUND', `Group ${groupId} not found`);
    }

    // For now, return 501 Not Implemented until playlist functionality is added
    return httpError(res, 501, 'NOT_IMPLEMENTED', 'Previous track functionality not yet implemented');
  } catch (error) {
    console.error('Group previous error:', error);
    return httpError(res, 500, 'COMMAND_ERROR', `Failed to execute previous command: ${error.message}`);
  }
});