import { weddingLayouts, weddingStyles, weddingTypography } from './types';

export const WEDDING_PROMPT_VERSION = 'wedding-illustration-v5-reference-first';
export const WEDDING_STYLE_VERSION = 'style-system-v1';
export const WEDDING_LAYOUT_VERSION = 'layout-engine-v1';
export const WEDDING_MAX_CANDIDATES = 1;
// Free users get five total generation batches: the initial generation plus
// four regenerations.
export const WEDDING_FREE_REGENERATIONS = 4;
export const WEDDING_PAID_REGENERATIONS = 3;
export const WEDDING_PACK_PRODUCT_ID = 'wedding_identity_pack';

/** Generation batches: initial run + regenerations. */
export const WEDDING_GUEST_MAX_BATCHES = 1;
export const WEDDING_FREE_MAX_BATCHES = 1 + WEDDING_FREE_REGENERATIONS;
export const WEDDING_PAID_MAX_BATCHES = 1 + WEDDING_PAID_REGENERATIONS;
export const WEDDING_FREE_MAX_PROJECTS = 1;

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

/** Layouts a style supports, in wizard order. */
export function layoutsForStyle(styleId: string) {
  return weddingLayouts.filter((layout) =>
    layout.styleIds.includes(styleId as never)
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

export interface GenerationAllowanceParams {
  /** Generate batches already stored for this project. */
  batches: number;
  /** User owns a paid Wedding Identity Pack order for this project. */
  paid: boolean;
  /** Request comes from an anonymous guest token. */
  isGuest: boolean;
  /** Projects that already contain generations (for this user/guest). */
  projectsWithGenerations: number;
}

export interface GenerationAllowance {
  allowed: boolean;
  reason?: string;
  /** Total batches allowed in the current tier (for UI copy). */
  maxBatches: number;
}

/**
 * Hard generation quota (spec: cost protection). Guests get one generation
 * per device; signed-in free users get one project plus four regenerations;
 * paid users unlock three regenerations on the purchased project.
 */
export function decideGenerationAllowance(
  params: GenerationAllowanceParams
): GenerationAllowance {
  const { batches, paid, isGuest, projectsWithGenerations } = params;

  if (isGuest) {
    if (batches >= WEDDING_GUEST_MAX_BATCHES) {
      return {
        allowed: false,
        reason:
          'Free preview is limited to one generation per device. Create an account to save your crest and regenerate.',
        maxBatches: WEDDING_GUEST_MAX_BATCHES,
      };
    }
    return { allowed: true, maxBatches: WEDDING_GUEST_MAX_BATCHES };
  }

  if (paid) {
    if (batches >= WEDDING_PAID_MAX_BATCHES) {
      return {
        allowed: false,
        reason:
          'This project reached its 3 included regenerations. Start a new project for a fresh composition.',
        maxBatches: WEDDING_PAID_MAX_BATCHES,
      };
    }
    return { allowed: true, maxBatches: WEDDING_PAID_MAX_BATCHES };
  }

  if (batches === 0 && projectsWithGenerations >= WEDDING_FREE_MAX_PROJECTS) {
    return {
      allowed: false,
      reason:
        'The free plan includes one generated project. Unlock the Wedding Identity Pack to create more.',
      maxBatches: WEDDING_FREE_MAX_BATCHES,
    };
  }

  if (batches >= WEDDING_FREE_MAX_BATCHES) {
    return {
      allowed: false,
      reason:
        'The free plan includes four regenerations. Unlock the Wedding Identity Pack for three more.',
      maxBatches: WEDDING_FREE_MAX_BATCHES,
    };
  }

  return { allowed: true, maxBatches: WEDDING_FREE_MAX_BATCHES };
}
