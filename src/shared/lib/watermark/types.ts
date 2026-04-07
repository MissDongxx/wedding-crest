export interface WatermarkParams {
  size: number;
  margin: number;
}

export type ProcessingState = 'idle' | 'processing' | 'done' | 'error';

export interface ProcessingResult {
  cleanUrl: string;
  originalUrl: string;
  processingTimeMs: number;
  watermarkDetected: boolean;
  metadataStripped?: boolean;
  metadataInfo?: MetadataInfo;
}

// ============ Metadata ============

export interface MetadataInfo {
  hasExif: boolean;
  hasC2PA: boolean;
  hasIPTC: boolean;
  hasXMP: boolean;
  details: string[];
}

// ============ Detection ============

export type WatermarkType = 'gemini' | 'none';
export type DetectionConfidence = 'detected' | 'possible' | 'not_detected';

export interface DetectionResult {
  detected: boolean;
  confidence: number; // 0-1
  confidenceLevel: DetectionConfidence;
  watermarkType: WatermarkType;
  location: {
    x: number;
    y: number;
    size: number;
  } | null;
  details: string;
}

// ============ Batch ============

export type BatchJobStatus = 'pending' | 'processing' | 'done' | 'error';

export interface BatchJob {
  id: string;
  file: File;
  status: BatchJobStatus;
  progress: number; // 0-100
  cleanUrl?: string;
  cleanBlob?: Blob;
  error?: string;
}
