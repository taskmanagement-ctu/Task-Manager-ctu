import multer from 'multer';
import path from 'path';

/**
 * Multer configuration for file uploads.
 * Files are stored in memory (buffer) for processing.
 */
const storage = multer.memoryStorage();

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.xlsx', '.csv'];

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .xlsx and .csv files are allowed'));
  }
};

export const uploadFile = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export const uploadAny = multer({
  storage,
  limits: {
    fileSize: 250 * 1024 * 1024, // 250MB limit to support video and document uploads
  },
});
