/**
 * Utility for client-side image and file compression.
 * Compresses images (JPEG, PNG, WebP, BMP) using HTML5 Canvas before uploading
 * to drastically reduce bandwidth and storage while preserving visual quality.
 */

export interface CompressedFileResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  isCompressed: boolean;
  percentSaved: number;
  previewUrl?: string;
  type: string;
}

export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  if (bytes < k) return `${bytes} B`;
  if (bytes < k * k) return `${(bytes / k).toFixed(1)} KB`;
  return `${(bytes / (k * k)).toFixed(1)} MB`;
};

/**
 * Checks if a file is an image that can be compressed via Canvas.
 */
export const isCompressibleImage = (file: File): boolean => {
  return /image\/(jpeg|jpg|png|webp|bmp)/i.test(file.type);
};

/**
 * Compresses a single image file using Canvas.
 * - Resizes if dimensions exceed maxWidth / maxHeight (default 1920px)
 * - Encodes to JPEG at specified quality (default 0.8)
 * - If compressed output is not smaller, retains the original file.
 */
export const compressImage = async (
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.8
): Promise<CompressedFileResult> => {
  const originalSize = file.size;

  // If already under 120KB, don't bother compressing
  if (originalSize < 120 * 1024) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      isCompressed: false,
      percentSaved: 0,
      previewUrl: URL.createObjectURL(file),
      type: file.type
    };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Calculate scale to fit within maxWidth/maxHeight
      if (width > maxWidth || height > maxHeight) {
        if (width / maxWidth > height / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          maxHeight = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({
          file,
          originalSize,
          compressedSize: originalSize,
          isCompressed: false,
          percentSaved: 0,
          previewUrl: URL.createObjectURL(file),
          type: file.type
        });
        return;
      }

      // Smooth scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG blob
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= originalSize) {
            // Compressed was larger or failed, keep original
            resolve({
              file,
              originalSize,
              compressedSize: originalSize,
              isCompressed: false,
              percentSaved: 0,
              previewUrl: URL.createObjectURL(file),
              type: file.type
            });
            return;
          }

          const safeFilename = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
          const compressedFile = new File([blob], safeFilename, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });

          const percentSaved = Math.round(((originalSize - blob.size) / originalSize) * 100);

          resolve({
            file: compressedFile,
            originalSize,
            compressedSize: blob.size,
            isCompressed: true,
            percentSaved,
            previewUrl: URL.createObjectURL(blob),
            type: 'image/jpeg'
          });
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        file,
        originalSize,
        compressedSize: originalSize,
        isCompressed: false,
        percentSaved: 0,
        previewUrl: URL.createObjectURL(file),
        type: file.type
      });
    };

    img.src = objectUrl;
  });
};

/**
 * Handles any file: compresses images, passes through non-images with validation.
 */
export const processFileForUpload = async (file: File): Promise<CompressedFileResult> => {
  if (isCompressibleImage(file)) {
    return await compressImage(file);
  }

  // Non-image file (PDF, Doc, Sheet, Zip, etc.)
  return {
    file,
    originalSize: file.size,
    compressedSize: file.size,
    isCompressed: false,
    percentSaved: 0,
    type: file.type || 'application/octet-stream'
  };
};

/**
 * Processes multiple files in parallel.
 */
export const processMultipleFiles = async (
  files: FileList | File[]
): Promise<CompressedFileResult[]> => {
  const fileArray = Array.from(files);
  return await Promise.all(fileArray.map((f) => processFileForUpload(f)));
};

