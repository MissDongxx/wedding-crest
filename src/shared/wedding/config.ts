import { weddingLayouts, weddingStyles, weddingTypography } from './types';

export const WEDDING_PROMPT_VERSION = 'wedding-illustration-v1';
export const WEDDING_STYLE_VERSION = 'style-system-v1';
export const WEDDING_LAYOUT_VERSION = 'layout-engine-v1';
export const WEDDING_MAX_CANDIDATES = 3;
export const WEDDING_FREE_REGENERATIONS = 1;
export const WEDDING_PACK_PRODUCT_ID = 'wedding_identity_pack';

export function getWeddingStyle(styleId: string) {
  return (
    weddingStyles.find((style) => style.id === styleId) ?? weddingStyles[0]
  );
}

export function getWeddingLayout(layoutId: string) {
  return (
    weddingLayouts.find((layout) => layout.id === layoutId) ?? weddingLayouts[0]
  );
}

export function getWeddingTypography(typographyId: string) {
  return (
    weddingTypography.find((font) => font.id === typographyId) ??
    weddingTypography[0]
  );
}

export function selectLayout(styleId: string, requestedLayout?: string) {
  const layout = getWeddingLayout(requestedLayout ?? 'oval');
  if (layout.styleIds.includes(styleId as never)) return layout;
  return (
    weddingLayouts.find((candidate) =>
      candidate.styleIds.includes(styleId as never)
    ) ?? weddingLayouts[0]
  );
}

export function decideReview(score: number): 'accept' | 'repair' | 'reject' {
  if (score >= 8.5) return 'accept';
  if (score >= 7.5) return 'repair';
  return 'reject';
}

export function canDownloadHighResolution(orderStatus: string | undefined) {
  return orderStatus === 'paid';
}
