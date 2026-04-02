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
}
