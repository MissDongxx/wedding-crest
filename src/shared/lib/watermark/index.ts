export { removeWatermark } from './remover';
export { getAlphaMap } from './alpha-map';
export { analyzeMetadata } from './metadata';
export { checkPermission, reportUsage } from './gating';
export type {
  ProcessingState,
  ProcessingResult,
  WatermarkParams,
  MetadataInfo,
  DetectionResult,
  BatchJob,
  BatchJobStatus,
} from './types';
