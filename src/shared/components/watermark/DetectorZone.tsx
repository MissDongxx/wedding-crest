'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  AlertCircle,
  Loader2,
  Search,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { detectWatermark } from '@/shared/lib/watermark/detector';
import { analyzeMetadata } from '@/shared/lib/watermark/metadata';
import type { DetectionResult, MetadataInfo } from '@/shared/lib/watermark/types';
import { Button } from '@/shared/components/ui/button';

type DetectorState = 'idle' | 'analyzing' | 'done' | 'error';

export function DetectorZone() {
  const [state, setState] = useState<DetectorState>('idle');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [detectionResult, setDetectionResult] =
    useState<DetectionResult | null>(null);
  const [metadataResult, setMetadataResult] = useState<MetadataInfo | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const processImage = useCallback(async (file: File) => {
    setState('analyzing');
    setError(null);

    try {
      const origUrl = URL.createObjectURL(file);
      setImageUrl(origUrl);

      // Load image into canvas
      const bitmap = await createImageBitmap(file);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      // Run detection and metadata analysis in parallel
      const [detection, metadata] = await Promise.all([
        detectWatermark(canvas),
        analyzeMetadata(file),
      ]);

      setDetectionResult(detection);
      setMetadataResult(metadata);
      setState('done');
    } catch (err) {
      console.error('Detection failed:', err);
      setError(err instanceof Error ? err.message : 'Detection failed');
      setState('error');
    }
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        processImage(acceptedFiles[0]);
      }
    },
    [processImage]
  );

  // Hook called unconditionally at top level
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    maxSize: 20 * 1024 * 1024,
    multiple: false,
    disabled: state === 'analyzing',
  });

  const handleReset = useCallback(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setDetectionResult(null);
    setMetadataResult(null);
    setError(null);
    setState('idle');
  }, [imageUrl]);

  // ============ Render: Analyzing ============
  if (state === 'analyzing') {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-2xl border border-dashed p-12 backdrop-blur-sm">
          <div className="relative mb-6">
            <div className="from-primary/20 via-primary/5 to-primary/20 absolute -inset-4 animate-pulse rounded-full bg-gradient-to-r blur-xl" />
            <Search className="text-primary relative h-12 w-12 animate-pulse" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-semibold">
            Analyzing image...
          </h3>
          <p className="text-muted-foreground text-sm">
            Checking for watermarks and AI metadata markers
          </p>
        </div>
      </div>
    );
  }

  // ============ Render: Error ============
  if (state === 'error') {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center rounded-2xl border border-dashed p-12">
          <AlertCircle className="text-destructive mb-4 h-10 w-10" />
          <h3 className="text-foreground mb-2 text-lg font-semibold">
            Detection failed
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
  if (state === 'done' && detectionResult) {
    const confidencePercent = Math.round(detectionResult.confidence * 100);
    const isDetected = detectionResult.confidenceLevel === 'detected';
    const isPossible = detectionResult.confidenceLevel === 'possible';

    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        {/* Image Preview */}
        {imageUrl && (
          <div className="overflow-hidden rounded-xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Analyzed image"
              className="mx-auto max-h-64 w-auto"
            />
          </div>
        )}

        {/* Detection Result Card */}
        <div
          className={`rounded-xl border p-6 ${
            isDetected
              ? 'border-amber-500/30 bg-amber-500/5'
              : isPossible
                ? 'border-yellow-500/30 bg-yellow-500/5'
                : 'border-green-500/30 bg-green-500/5'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`rounded-full p-3 ${
                isDetected
                  ? 'bg-amber-500/10'
                  : isPossible
                    ? 'bg-yellow-500/10'
                    : 'bg-green-500/10'
              }`}
            >
              {isDetected && (
                <ShieldAlert className="h-6 w-6 text-amber-500" />
              )}
              {isPossible && (
                <ShieldQuestion className="h-6 w-6 text-yellow-500" />
              )}
              {!isDetected && !isPossible && (
                <ShieldCheck className="h-6 w-6 text-green-500" />
              )}
            </div>

            <div className="flex-1">
              <h3 className="text-foreground text-lg font-semibold">
                {isDetected && 'Watermark Detected'}
                {isPossible && 'Possible Watermark'}
                {!isDetected && !isPossible && 'No Watermark Found'}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {detectionResult.details}
              </p>

              {/* Confidence bar */}
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Confidence level
                  </span>
                  <span className="text-foreground font-medium">
                    {confidencePercent}%
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isDetected
                        ? 'bg-amber-500'
                        : isPossible
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${confidencePercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Metadata Analysis */}
        {metadataResult && (
          <div className="rounded-xl border p-6">
            <h4 className="text-foreground mb-3 font-semibold">
              Metadata Analysis
            </h4>
            <div className="grid gap-2">
              <MetadataRow
                label="Exif Data"
                found={metadataResult.hasExif}
              />
              <MetadataRow
                label="C2PA Signature"
                found={metadataResult.hasC2PA}
              />
              <MetadataRow
                label="XMP Metadata"
                found={metadataResult.hasXMP}
              />
              <MetadataRow
                label="IPTC Data"
                found={metadataResult.hasIPTC}
              />
            </div>
            {metadataResult.details.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <p className="text-muted-foreground text-xs">
                  {metadataResult.details.join(' · ')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        {isDetected && (
          <div className="text-center">
            <Button asChild size="lg">
              <a href="/tools/gemini">
                Remove This Watermark
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        )}

        {/* Reset */}
        <div className="text-center">
          <Button variant="outline" onClick={handleReset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Check Another Image
          </Button>
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
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-4">
          <div
            className={`rounded-2xl p-4 transition-colors duration-300 ${
              isDragActive
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
            }`}
          >
            <Search className="h-10 w-10" />
          </div>

          <div>
            <h3 className="text-foreground mb-1 text-lg font-semibold">
              {isDragActive
                ? 'Drop your image here'
                : 'Upload image to check'}
            </h3>
            <p className="text-muted-foreground text-sm">
              We&apos;ll check for visible watermarks, C2PA signatures, and AI
              metadata markers
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs">
            <span className="text-muted-foreground">
              PNG, JPG, WebP · Max 20MB
            </span>
            <span className="text-muted-foreground">
              100% local processing
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetadataRow({
  label,
  found,
}: {
  label: string;
  found: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span
        className={`text-sm font-medium ${
          found ? 'text-amber-500' : 'text-muted-foreground'
        }`}
      >
        {found ? 'Found' : 'Not found'}
      </span>
    </div>
  );
}
