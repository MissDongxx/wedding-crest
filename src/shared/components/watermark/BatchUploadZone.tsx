'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Archive,
  Sparkles,
  Lock,
  Shield,
} from 'lucide-react';
import { processBatch, downloadBatchAsZip, cleanupBatchJobs } from '@/shared/lib/watermark/batch';
import { checkPermission } from '@/shared/lib/watermark/gating';
import type { GatingStatus } from '@/shared/lib/watermark/gating';
import type { BatchJob } from '@/shared/lib/watermark/types';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';

const MAX_BATCH_FILES = 100;

export function BatchUploadZone() {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [running, setRunning] = useState(false);
  const [gatingStatus, setGatingStatus] = useState<GatingStatus | null>(null);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  // Cleanup blob URLs on unmount (page navigation)
  useEffect(() => {
    return () => {
      cleanupBatchJobs(jobsRef.current);
    };
  }, []);

  const onDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // Check permission first
    const gating = await checkPermission();
    setGatingStatus(gating);

    if (!gating.allowed) {
      setGatingStatus({ ...gating, allowed: false });
      return;
    }

    setRunning(true);

    try {
      await processBatch(
        files.slice(0, MAX_BATCH_FILES),
        (updatedJobs) => setJobs([...updatedJobs])
      );
    } finally {
      setRunning(false);
    }
  }, []);

  // Hook must be called unconditionally at the top level
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    maxSize: 20 * 1024 * 1024,
    multiple: true,
    disabled: running,
  });

  const handleDownloadAll = useCallback(async () => {
    await downloadBatchAsZip(jobs);
  }, [jobs]);

  const handleReset = useCallback(() => {
    cleanupBatchJobs(jobs);
    setJobs([]);
    setRunning(false);
    setGatingStatus(null);
  }, [jobs]);

  const doneCount = jobs.filter((j) => j.status === 'done').length;
  const errorCount = jobs.filter((j) => j.status === 'error').length;
  const totalCount = jobs.length;
  const overallProgress =
    totalCount > 0
      ? Math.round(
          jobs.reduce((sum, j) => sum + j.progress, 0) / totalCount
        )
      : 0;

  // ============ Permission denied ============
  if (gatingStatus && !gatingStatus.allowed) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-2xl border border-dashed p-12 backdrop-blur-sm">
          <div className="bg-amber-500/10 mb-4 rounded-full p-3">
            <Lock className="h-8 w-8 text-amber-500" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-semibold">
            Upgrade for batch processing
          </h3>
          <p className="text-muted-foreground mb-6 text-center text-sm">
            Batch processing requires a Pro plan. Upgrade to process up to{' '}
            {MAX_BATCH_FILES} images at once.
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <a href="/pricing">
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade to Pro
              </a>
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============ Upload Zone (idle) ============
  if (jobs.length === 0 && !running) {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      accept: {
        'image/png': ['.png'],
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/webp': ['.webp'],
      },
      maxSize: 20 * 1024 * 1024,
      multiple: true,
    });

    return (
      <div className="mx-auto w-full max-w-3xl">
        <div
          {...getRootProps()}
          className={`group relative cursor-pointer rounded-2xl border-2 border-dashed p-16 text-center transition-all duration-300 ${
            isDragActive
              ? 'border-primary bg-primary/5 scale-[1.02]'
              : 'border-border hover:border-primary/50 hover:bg-muted/30'
          }`}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center gap-4">
            <div
              className={`rounded-2xl p-4 transition-colors duration-300 ${
                isDragActive
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
              }`}
            >
              <Archive className="h-10 w-10" />
            </div>

            <div>
              <h3 className="text-foreground mb-1 text-lg font-semibold">
                {isDragActive
                  ? 'Drop your images here'
                  : 'Upload multiple images'}
              </h3>
              <p className="text-muted-foreground text-sm">
                Drag & drop or click · Up to {MAX_BATCH_FILES} images · PNG,
                JPG, WebP
              </p>
            </div>

            <div className="flex items-center gap-6 text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                100% Local Processing
              </span>
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Metadata auto-stripped
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ Progress / Results ============
  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-foreground text-lg font-semibold">
            {running
              ? `Processing ${doneCount}/${totalCount}...`
              : `Done — ${doneCount} images cleaned${
                  errorCount > 0 ? `, ${errorCount} failed` : ''
                }`}
          </h3>
          {running && (
            <div className="mt-2">
              <Progress value={overallProgress} className="h-2 w-64" />
            </div>
          )}
        </div>
        <div className="flex gap-3">
          {!running && doneCount > 0 && (
            <Button onClick={handleDownloadAll}>
              <Download className="mr-2 h-4 w-4" />
              Download All (.zip)
            </Button>
          )}
          <Button variant="outline" onClick={handleReset}>
            {running ? 'Cancel' : 'New Batch'}
          </Button>
        </div>
      </div>

      {/* Job List */}
      <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="bg-card/50 border-border flex items-center gap-3 rounded-lg border px-4 py-2.5"
          >
            {/* Status icon */}
            <div className="flex-shrink-0">
              {job.status === 'done' && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              {job.status === 'processing' && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              )}
              {job.status === 'error' && (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              {job.status === 'pending' && (
                <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
              )}
            </div>

            {/* Filename */}
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
              {job.file.name}
            </span>

            {/* Progress bar */}
            <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  job.status === 'error'
                    ? 'bg-red-500'
                    : job.status === 'done'
                      ? 'bg-green-500'
                      : 'bg-blue-500'
                }`}
                style={{ width: `${job.progress}%` }}
              />
            </div>

            {/* Status text */}
            <span className="w-12 text-right text-xs text-muted-foreground">
              {job.status === 'done'
                ? '✓'
                : job.status === 'error'
                  ? '✗'
                  : `${job.progress}%`}
            </span>

            {/* Individual download */}
            {job.cleanUrl && (
              <a
                href={job.cleanUrl}
                download={`clean-${job.file.name.replace(/\.[^.]+$/, '')}.png`}
                className="text-blue-500 hover:text-blue-400 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
