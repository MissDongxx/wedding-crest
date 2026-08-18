/**
 * Batch watermark processing engine.
 *
 * Processes multiple images in parallel with a concurrency pool.
 * Reuses the existing removeWatermark() algorithm for each image.
 * Reports usage via the gating API per completed job.
 */

import { reportUsage } from './gating';
import { removeWatermark } from './remover';
import type { BatchJob } from './types';

const DEFAULT_CONCURRENCY = 2;
const MAX_IMAGES = 100;
const MAX_BATCH_BYTES = 500 * 1024 * 1024; // 500MB total

/**
 * Process a batch of images with controlled concurrency.
 *
 * @param files - Array of image files to process
 * @param onProgress - Callback fired after each job state change
 * @returns Array of BatchJob with final states
 */
export async function processBatch(
  files: File[],
  onProgress: (jobs: BatchJob[]) => void
): Promise<BatchJob[]> {
  const imagesToProcess = files.slice(0, MAX_IMAGES);
  const totalSize = imagesToProcess.reduce((s, f) => s + f.size, 0);
  if (totalSize > MAX_BATCH_BYTES) {
    throw new Error(
      `Batch too large (${(totalSize / 1024 / 1024).toFixed(0)}MB). Please reduce the number of files.`
    );
  }

  const jobs: BatchJob[] = imagesToProcess.map((file, index) => ({
    id: `batch-${index}-${Date.now()}`,
    file,
    status: 'pending' as const,
    progress: 0,
  }));

  onProgress([...jobs]);

  // Process in chunks of CONCURRENCY
  for (let i = 0; i < jobs.length; i += DEFAULT_CONCURRENCY) {
    const chunk = jobs.slice(i, i + DEFAULT_CONCURRENCY);

    await Promise.allSettled(
      chunk.map(async (job) => {
        job.status = 'processing';
        job.progress = 10;
        onProgress([...jobs]);

        try {
          // Load image
          const bitmap = await createImageBitmap(job.file);
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();

          job.progress = 30;
          onProgress([...jobs]);

          // Remove watermark
          await removeWatermark(canvas);

          job.progress = 70;
          onProgress([...jobs]);

          // Convert to blob and release canvas memory
          const blob = await canvas.convertToBlob({ type: 'image/png' });
          canvas.width = 0;
          canvas.height = 0;
          job.cleanBlob = blob;
          job.cleanUrl = URL.createObjectURL(blob);

          job.status = 'done';
          job.progress = 100;
        } catch (err) {
          job.status = 'error';
          job.error =
            err instanceof Error ? err.message : 'Unknown processing error';
        }

        onProgress([...jobs]);
      })
    );
  }

  // Report total usage
  const completedCount = jobs.filter((j) => j.status === 'done').length;
  if (completedCount > 0) {
    await reportUsage(completedCount, 0);
  }

  return jobs;
}

/**
 * Download all completed batch results as a ZIP file.
 */
export async function downloadBatchAsZip(jobs: BatchJob[]): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  let index = 0;
  for (const job of jobs) {
    if (job.status === 'done' && job.cleanBlob) {
      index++;
      const ext = job.file.name.split('.').pop() || 'png';
      zip.file(`clean-${String(index).padStart(3, '0')}.${ext}`, job.cleanBlob);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clean-images.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Clean up blob URLs from batch jobs to free memory.
 */
export function cleanupBatchJobs(jobs: BatchJob[]): void {
  for (const job of jobs) {
    if (job.cleanUrl) {
      URL.revokeObjectURL(job.cleanUrl);
    }
    // Clear blob reference to help GC
    job.cleanBlob = undefined;
  }
}
