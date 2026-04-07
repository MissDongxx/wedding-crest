'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  Download,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle,
  ImageIcon,
  Sparkles,
  Lock,
  Shield,
} from 'lucide-react';
import { removeWatermark } from '@/shared/lib/watermark';
import type { ProcessingState, MetadataInfo } from '@/shared/lib/watermark';
import {
  checkPermission,
  reportUsage,
  getLocalUsageCount,
  DAILY_FREE_LIMIT,
} from '@/shared/lib/watermark/gating';
import type { GatingStatus } from '@/shared/lib/watermark/gating';
import { analyzeMetadata } from '@/shared/lib/watermark/metadata';
import { Button } from '@/shared/components/ui/button';
import { useTranslations } from 'next-intl';

// ============ Component ============

export function UploadZone({
  onStateChange,
}: {
  onStateChange?: (state: ProcessingState) => void;
} = {}) {
  const [state, setState] = useState<ProcessingState>('idle');
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [cleanUrl, setCleanUrl] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const [gatingStatus, setGatingStatus] = useState<GatingStatus | null>(null);
  const [metadataInfo, setMetadataInfo] = useState<MetadataInfo | null>(null);
  const t = useTranslations('common');

  useEffect(() => {
    setUsageCount(getLocalUsageCount());
    // Check permission on mount
    checkPermission().then(setGatingStatus);
  }, []);

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const cleanBlobRef = useRef<Blob | null>(null);

  const processImage = useCallback(
    async (file: File) => {
      // Check permission
      const gating = await checkPermission();
      setGatingStatus(gating);

      if (!gating.allowed) {
        setError('limit_reached');
        setState('error');
        return;
      }

      setState('processing');
      setError(null);

      try {
        const startTime = performance.now();

        // Analyze metadata in parallel with processing
        const metadataPromise = analyzeMetadata(file);

        // Create object URL for original preview
        const origUrl = URL.createObjectURL(file);
        setOriginalUrl(origUrl);

        // Load image as ImageBitmap
        const bitmap = await createImageBitmap(file);
        const { width, height } = bitmap;

        // Create OffscreenCanvas and draw the image
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        // Run watermark removal
        await removeWatermark(canvas);

        // Convert result to blob for download
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        cleanBlobRef.current = blob;
        const resultUrl = URL.createObjectURL(blob);
        setCleanUrl(resultUrl);

        const elapsed = Math.round(performance.now() - startTime);
        setProcessingTime(elapsed);

        // Get metadata analysis
        const meta = await metadataPromise;
        setMetadataInfo(meta);

        // Report usage
        await reportUsage(1, elapsed);
        setUsageCount(getLocalUsageCount());

        // Refresh gating status
        const updatedGating = await checkPermission();
        setGatingStatus(updatedGating);

        setState('done');
      } catch (err) {
        console.error('Watermark removal failed:', err);
        setError(err instanceof Error ? err.message : 'Processing failed');
        setState('error');
      }
    },
    []
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        processImage(acceptedFiles[0]);
      }
    },
    [processImage]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    maxSize: 20 * 1024 * 1024, // 20MB
    multiple: false,
    disabled: state === 'processing',
  });

  const handleDownload = useCallback(() => {
    if (!cleanBlobRef.current) return;
    const url = URL.createObjectURL(cleanBlobRef.current);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clean-image.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleReset = useCallback(() => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (cleanUrl) URL.revokeObjectURL(cleanUrl);
    setOriginalUrl(null);
    setCleanUrl(null);
    cleanBlobRef.current = null;
    setProcessingTime(0);
    setError(null);
    setMetadataInfo(null);
    setState('idle');
  }, [originalUrl, cleanUrl]);

  const displayRemaining = gatingStatus?.remaining ?? DAILY_FREE_LIMIT - usageCount;
  const isPro = gatingStatus?.plan === 'pro';

  // ============ Render: Processing ============
  if (state === 'processing') {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-2xl border border-dashed p-12 backdrop-blur-sm">
          <div className="relative mb-6">
            <div className="from-primary/20 via-primary/5 to-primary/20 absolute -inset-4 animate-pulse rounded-full bg-gradient-to-r blur-xl" />
            <Loader2 className="text-primary relative h-12 w-12 animate-spin" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-semibold">
            Removing watermark...
          </h3>
          <p className="text-muted-foreground text-sm">
            Processing locally in your browser. No data leaves your device.
          </p>
        </div>
      </div>
    );
  }

  // ============ Render: Error ============
  if (state === 'error') {
    if (error === 'limit_reached') {
      return (
        <div className="mx-auto w-full max-w-2xl">
          <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-2xl border border-dashed p-12 backdrop-blur-sm">
            <div className="bg-amber-500/10 mb-4 rounded-full p-3">
              <Lock className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-foreground mb-2 text-lg font-semibold">
              Daily limit reached
            </h3>
            <p className="text-muted-foreground mb-6 text-center text-sm">
              {gatingStatus?.mode === 'anonymous'
                ? `You've used ${DAILY_FREE_LIMIT}/${DAILY_FREE_LIMIT} free images today. Try tomorrow or upgrade to Pro.`
                : `You've used all your credits. Upgrade to Pro for unlimited watermark removal.`}
            </p>
            <div className="flex gap-3">
              <Button asChild>
                <a href="/pricing">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Upgrade to Pro
                </a>
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Try Tomorrow
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center rounded-2xl border border-dashed p-12">
          <AlertCircle className="text-destructive mb-4 h-10 w-10" />
          <h3 className="text-foreground mb-2 text-lg font-semibold">
            Processing failed
          </h3>
          <p className="text-muted-foreground mb-6 text-center text-sm">
            {error || 'An unexpected error occurred'}
          </p>
          <Button variant="outline" onClick={handleReset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // ============ Render: Done ============
  if (state === 'done' && originalUrl && cleanUrl) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        {/* Result Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-500/10 p-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h3 className="text-foreground font-semibold">
                Watermark removed!
              </h3>
              <p className="text-muted-foreground text-sm">
                Processed in {processingTime}ms
                {isPro
                  ? ' · Pro plan'
                  : ` · ${usageCount}/${DAILY_FREE_LIMIT} free images used today`}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Process Another
            </Button>
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </div>

        {/* Metadata stripped badge */}
        {metadataInfo &&
          (metadataInfo.hasExif ||
            metadataInfo.hasC2PA ||
            metadataInfo.hasIPTC ||
            metadataInfo.hasXMP) && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <Shield className="h-3.5 w-3.5 text-green-500" />
                Metadata stripped:
              </span>
              {metadataInfo.hasExif && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600 dark:text-green-400">
                  Exif
                </span>
              )}
              {metadataInfo.hasC2PA && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600 dark:text-green-400">
                  C2PA
                </span>
              )}
              {metadataInfo.hasXMP && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600 dark:text-green-400">
                  XMP
                </span>
              )}
              {metadataInfo.hasIPTC && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600 dark:text-green-400">
                  IPTC
                </span>
              )}
            </div>
          )}

        {/* Before / After */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="group relative overflow-hidden rounded-xl border">
            <div className="bg-muted/50 px-4 py-2 text-center text-sm font-medium">
              Before
            </div>
            <div className="bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] dark:bg-[repeating-conic-gradient(#374151_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={originalUrl}
                alt="Original image with watermark"
                className="h-auto w-full"
              />
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-xl border border-green-500/30">
            <div className="bg-green-500/10 px-4 py-2 text-center text-sm font-medium text-green-600 dark:text-green-400">
              After — Watermark Removed
            </div>
            <div className="bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] dark:bg-[repeating-conic-gradient(#374151_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cleanUrl}
                alt="Clean image without watermark"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ Render: Idle (Upload Zone) ============
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        {...getRootProps()}
        className={`group relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
          isDragActive
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
      >
        <input {...getInputProps()} id="upload-input" />

        <div className="flex flex-col items-center gap-4">
          <div
            className={`rounded-2xl p-4 transition-colors duration-300 ${
              isDragActive
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
            }`}
          >
            {isDragActive ? (
              <ImageIcon className="h-10 w-10" />
            ) : (
              <Upload className="h-10 w-10" />
            )}
          </div>

          <div>
            <h3 className="text-foreground mb-1 text-lg font-semibold">
              {isDragActive
                ? 'Drop your image here'
                : 'Upload AI-generated image'}
            </h3>
            <p className="text-muted-foreground text-sm">
              Drag & drop or click to select · PNG, JPG, WebP · Max 20MB
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 text-xs font-medium tracking-tight">
        <div className="text-muted-foreground/80 hover:text-foreground flex items-center gap-1.5 transition-colors">
          <Lock className="h-3.5 w-3.5 text-primary/70" />
          <span>{t('watermark.trust_badges.local')}</span>
        </div>
        <div className="text-muted-foreground/80 hover:text-foreground flex items-center gap-1.5 transition-colors">
          <Shield className="h-3.5 w-3.5 text-primary/70" />
          <span>{t('watermark.trust_badges.metadata')}</span>
        </div>
        {!isPro && (
          <div className="text-muted-foreground/80 hover:text-foreground flex items-center gap-1.5 transition-colors">
            <Sparkles className="h-3.5 w-3.5 text-primary/70" />
            <span>
              {t('watermark.trust_badges.free_today', {
                remaining: displayRemaining,
                limit: DAILY_FREE_LIMIT,
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
