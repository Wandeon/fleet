import express from 'express';
import { prisma } from '../lib/db.js';
import { httpError } from './errors.js';

export const playlistsRouter = express.Router();
playlistsRouter.use(express.json());

// GET /api/playlists - List all playlists
playlistsRouter.get('/', async (req, res) => {
  try {
    const playlists = await prisma.playlist.findMany({
      include: {
        items: {
          include: {
            file: true
          },
          orderBy: {
            order: 'asc'
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      playlists: playlists.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        itemCount: playlist.items.length,
        items: playlist.items.map(item => ({
          id: item.id,
          order: item.order,
          file: {
            id: item.file.id,
            name: item.file.name,
            size: item.file.size
          }
        })),
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt
      }))
    });
  } catch (error) {
    console.error('Playlists list error:', error);
    return httpError(res, 500, 'DATABASE_ERROR', 'Failed to retrieve playlists');
  }
});

// POST /api/playlists - Create new playlist
playlistsRouter.post('/', async (req, res) => {
  try {
    const { name, description, fileIds = [] } = req.body;

    if (!name || typeof name !== 'string') {
      return httpError(res, 400, 'INVALID_NAME', 'Playlist name is required');
    }

    // Create playlist
    const playlist = await prisma.playlist.create({
      data: {
        id: crypto.randomUUID(),
        name,
        description: description || null
      }
    });

    // Add files to playlist if provided
    if (fileIds.length > 0) {
      // Verify all files exist
      const files = await prisma.file.findMany({
        where: { id: { in: fileIds } }
      });

      if (files.length !== fileIds.length) {
        await prisma.playlist.delete({ where: { id: playlist.id } });
        return httpError(res, 400, 'INVALID_FILES', 'Some files do not exist');
      }

      // Create playlist items
      const items = fileIds.map((fileId: string, index: number) => ({
        id: crypto.randomUUID(),
        playlistId: playlist.id,
        fileId,
        order: index + 1
      }));

      await prisma.playlistItem.createMany({
        data: items
      });
    }

    // Return created playlist with items
    const createdPlaylist = await prisma.playlist.findUnique({
      where: { id: playlist.id },
      include: {
        items: {
          include: { file: true },
          orderBy: { order: 'asc' }
        }
      }
    });

    res.status(201).json({
      success: true,
      playlist: {
        id: createdPlaylist!.id,
        name: createdPlaylist!.name,
        description: createdPlaylist!.description,
        itemCount: createdPlaylist!.items.length,
        items: createdPlaylist!.items.map(item => ({
          id: item.id,
          order: item.order,
          file: {
            id: item.file.id,
            name: item.file.name,
            size: item.file.size
          }
        })),
        createdAt: createdPlaylist!.createdAt,
        updatedAt: createdPlaylist!.updatedAt
      }
    });
  } catch (error) {
    console.error('Create playlist error:', error);
    return httpError(res, 500, 'CREATE_ERROR', 'Failed to create playlist');
  }
});

// PUT /api/playlists/:id - Update playlist
playlistsRouter.put('/:id', async (req, res) => {
  try {
    const { name, description, fileIds } = req.body;

    const playlist = await prisma.playlist.findUnique({
      where: { id: req.params.id }
    });

    if (!playlist) {
      return httpError(res, 404, 'PLAYLIST_NOT_FOUND', 'Playlist not found');
    }

    // Update playlist metadata
    await prisma.playlist.update({
      where: { id: req.params.id },
      data: {
        name: name || playlist.name,
        description: description !== undefined ? description : playlist.description
      }
    });

    // Update playlist items if fileIds provided
    if (fileIds && Array.isArray(fileIds)) {
      // Verify all files exist
      const files = await prisma.file.findMany({
        where: { id: { in: fileIds } }
      });

      if (files.length !== fileIds.length) {
        return httpError(res, 400, 'INVALID_FILES', 'Some files do not exist');
      }

      // Remove existing items
      await prisma.playlistItem.deleteMany({
        where: { playlistId: req.params.id }
      });

      // Add new items
      if (fileIds.length > 0) {
        const items = fileIds.map((fileId: string, index: number) => ({
          id: crypto.randomUUID(),
          playlistId: req.params.id,
          fileId,
          order: index + 1
        }));

        await prisma.playlistItem.createMany({
          data: items
        });
      }
    }

    // Return updated playlist
    const updatedPlaylist = await prisma.playlist.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: { file: true },
          orderBy: { order: 'asc' }
        }
      }
    });

    res.json({
      success: true,
      playlist: {
        id: updatedPlaylist!.id,
        name: updatedPlaylist!.name,
        description: updatedPlaylist!.description,
        itemCount: updatedPlaylist!.items.length,
        items: updatedPlaylist!.items.map(item => ({
          id: item.id,
          order: item.order,
          file: {
            id: item.file.id,
            name: item.file.name,
            size: item.file.size
          }
        })),
        createdAt: updatedPlaylist!.createdAt,
        updatedAt: updatedPlaylist!.updatedAt
      }
    });
  } catch (error) {
    console.error('Update playlist error:', error);
    return httpError(res, 500, 'UPDATE_ERROR', 'Failed to update playlist');
  }
});

// DELETE /api/playlists/:id - Delete playlist
playlistsRouter.delete('/:id', async (req, res) => {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { id: req.params.id }
    });

    if (!playlist) {
      return httpError(res, 404, 'PLAYLIST_NOT_FOUND', 'Playlist not found');
    }

    // Delete playlist items first (foreign key constraint)
    await prisma.playlistItem.deleteMany({
      where: { playlistId: req.params.id }
    });

    // Delete playlist
    await prisma.playlist.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete playlist error:', error);
    return httpError(res, 500, 'DELETE_ERROR', 'Failed to delete playlist');
  }
});