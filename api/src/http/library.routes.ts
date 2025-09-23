import express from 'express';
import { prisma } from '../lib/db.js';
import { httpError } from './errors.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

export const libraryRouter = express.Router();
// Note: express.json() removed for library routes as multer handles file uploads
// and express.json() has a much smaller default limit that conflicts with file uploads

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = '/home/admin/fleet/volumes/audio-library';
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error, '');
    }
  },
  filename: (req, file, cb) => {
    // Preserve original filename with timestamp prefix to avoid conflicts
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${timestamp}-${name}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Accept audio files
    const allowedMimes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/flac', 'audio/ogg'];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_BYTES) || (100 * 1024 * 1024) // Use env var or 100MB default
  }
});

// GET /api/library/files - List all audio files
libraryRouter.get('/files', async (req, res) => {
  try {
    const files = await prisma.file.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      files: files.map(file => ({
        id: file.id,
        name: file.name,
        size: file.size,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt
      }))
    });
  } catch (error) {
    console.error('Library files error:', error);
    return httpError(res, 500, 'DATABASE_ERROR', 'Failed to retrieve library files');
  }
});

// POST /api/library/upload - Upload audio file
libraryRouter.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return httpError(res, 400, 'NO_FILE', 'No file uploaded');
    }

    // Get file stats
    const stats = await fs.stat(req.file.path);

    // Create database record
    const file = await prisma.file.create({
      data: {
        id: crypto.randomUUID(),
        name: req.file.originalname,
        path: req.file.path,
        size: stats.size,
        mimeType: req.file.mimetype
      }
    });

    res.status(201).json({
      success: true,
      file: {
        id: file.id,
        name: file.name,
        size: file.size,
        createdAt: file.createdAt
      }
    });
  } catch (error) {
    console.error('Upload error:', error);

    // Clean up uploaded file if database operation failed
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to clean up uploaded file:', unlinkError);
      }
    }

    return httpError(res, 500, 'UPLOAD_ERROR', 'Failed to upload file');
  }
});

// DELETE /api/library/files/:id - Delete audio file
libraryRouter.delete('/files/:id', async (req, res) => {
  try {
    const file = await prisma.file.findUnique({
      where: { id: req.params.id }
    });

    if (!file) {
      return httpError(res, 404, 'FILE_NOT_FOUND', 'File not found');
    }

    // Delete file from filesystem
    try {
      await fs.unlink(file.path);
    } catch (error) {
      console.warn('Failed to delete file from filesystem:', error);
      // Continue with database deletion even if file cleanup fails
    }

    // Delete from database
    await prisma.file.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete file error:', error);
    return httpError(res, 500, 'DELETE_ERROR', 'Failed to delete file');
  }
});