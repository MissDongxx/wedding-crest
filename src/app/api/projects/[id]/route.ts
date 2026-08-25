import { z } from 'zod';

import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  canAccessWeddingProject,
  claimWeddingProject,
  countWeddingGenerationBatches,
  getWeddingProject,
  hasPaidWeddingOrder,
  updateWeddingProject,
  updateWeddingProjectElements,
  type WeddingElementPatch,
} from '@/shared/models/wedding';
import {
  decideGenerationAllowance,
  getWeddingStyle,
  layoutsForStyle,
  selectLayout,
  WEDDING_MAX_CANDIDATES,
} from '@/shared/wedding/config';
import {
  WEDDING_MAX_FLOWERS,
  WEDDING_MAX_PALETTE_COLORS,
  WEDDING_MAX_PERSONAL_ELEMENTS,
  weddingFlowerOptions,
  weddingPersonalElementOptions,
} from '@/shared/wedding/types';

function guestIdFrom(request: Request) {
  return request.headers.get('x-wedding-guest-id') || undefined;
}

/** Fetch one project with generations, paid state and regeneration quota. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserInfo();
    const guestId = guestIdFrom(request);
    if (!(await canAccessWeddingProject({ id, userId: user?.id, guestId }))) {
      return respErr('project not found');
    }

    const project = await getWeddingProject(id);
    if (!project) return respErr('project not found');

    // Claim guest projects as soon as a session user sees them.
    if (user && !project.userId && project.guestId === guestId) {
      await claimWeddingProject(id, user.id);
    }

    const paid = user ? await hasPaidWeddingOrder(user.id, id) : false;
    const batches = await countWeddingGenerationBatches(
      id,
      WEDDING_MAX_CANDIDATES
    );
    const allowance = decideGenerationAllowance({
      batches,
      paid,
      isGuest: !user,
      projectsWithGenerations: 0,
    });

    return respData({ project, paid, allowance, signedIn: Boolean(user) });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to load project'
    );
  }
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const patchSchema = z.object({
  // Names + date (column-level updates; initials get recomputed server-side).
  partner1: z.string().trim().min(1).max(40).optional(),
  partner2: z.string().trim().min(1).max(40).optional(),
  weddingDate: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
    .optional(),
  // Style & layout swap together: if style changes, layout may need to
  // fall back to one the new style supports. If layout is sent but
  // not compatible with the (possibly new) style, we snap to a valid
  // one instead of erroring.
  style: z.string().trim().min(1).optional(),
  layout: z.string().trim().min(1).optional(),
  typography: z.string().trim().min(1).optional(),
  // 1-3 colors in hex form.
  palette: z
    .array(
      z
        .string()
        .trim()
        .regex(HEX_COLOR, 'colors must be hex (#rrggbb or #rgb)')
    )
    .min(1)
    .max(WEDDING_MAX_PALETTE_COLORS)
    .optional(),
  complexity: z.enum(['minimal', 'medium', 'rich']).optional(),
  // From the existing result-page controls.
  nameDisplay: z
    .enum([
      'initials_amp',
      'initials_joined',
      'initials_spaced',
      'initials_only',
      'full_names',
      'surname',
    ])
    .optional(),
  showDate: z.boolean().optional(),
  // Free-text location/venue, plus element-table fields.
  location: z.string().trim().max(120).nullable().optional(),
  venue: z.string().trim().max(120).nullable().optional(),
  flowers: z
    .array(z.string().trim().min(1).max(60))
    .max(WEDDING_MAX_FLOWERS)
    .optional(),
  personalElements: z
    .array(z.string().trim().min(1).max(60))
    .max(WEDDING_MAX_PERSONAL_ELEMENTS)
    .optional(),
  personalImages: z
    .array(z.string().url().or(z.string().regex(/^\//)))
    .max(2)
    .optional(),
  frameId: z.string().trim().min(1).nullable().optional(),
});

/** Persist wizard / result-page changes. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const user = await getUserInfo();
    const guestId = guestIdFrom(request);
    if (!(await canAccessWeddingProject({ id, userId: user?.id, guestId }))) {
      return respErr('project not found');
    }
    const project = await getWeddingProject(id);
    if (!project) return respErr('project not found');

    const values: Record<string, unknown> = {};
    const elementPatch: WeddingElementPatch = {};
    let nextStyleId: string | null = null;

    // Names + initials recompute.
    const nameChanged =
      body.partner1 !== undefined || body.partner2 !== undefined;
    if (body.partner1 !== undefined) values.partner1 = body.partner1;
    if (body.partner2 !== undefined) values.partner2 = body.partner2;
    if (nameChanged) {
      const p1 = body.partner1 ?? project.partner1;
      const p2 = body.partner2 ?? project.partner2;
      const initials = [
        p1.trim().charAt(0).toUpperCase(),
        p2.trim().charAt(0).toUpperCase(),
      ]
        .filter(Boolean)
        .join('');
      if (initials) values.initials = initials;
    }
    if (body.weddingDate !== undefined) values.weddingDate = body.weddingDate;
    if (body.location !== undefined) values.location = body.location;
    if (body.venue !== undefined) values.venue = body.venue;
    if (body.complexity !== undefined) values.complexity = body.complexity;
    if (body.nameDisplay !== undefined) values.nameDisplay = body.nameDisplay;
    if (body.showDate !== undefined) values.showDate = body.showDate;
    if (body.typography !== undefined) values.typography = body.typography;
    if (body.palette !== undefined) values.palette = JSON.stringify(body.palette);

    if (body.style !== undefined) {
      // Validate style is in the catalog; unknown ids are rejected so
      // the wizard never accidentally persists a typo.
      getWeddingStyle(body.style);
      values.style = body.style;
      nextStyleId = body.style;
    }
    if (body.layout !== undefined || nextStyleId) {
      const styleId = nextStyleId ?? project.style;
      const allowed = layoutsForStyle(styleId);
      const requestedId = body.layout ?? project.layout;
      const requested = allowed.find((layout) => layout.id === requestedId);
      values.layout = (requested ?? selectLayout(styleId)).id;
    }

    // Element-table fields. Reject unknown catalog values so a client
    // can't sneak in arbitrary strings (they'd later be embedded in
    // prompts and SVG fallback text).
    if (body.flowers !== undefined) {
      elementPatch.flowers = body.flowers.filter((value) =>
        weddingFlowerOptions.includes(value)
      );
    }
    if (body.personalElements !== undefined) {
      elementPatch.personalElements = body.personalElements.filter((value) =>
        weddingPersonalElementOptions.includes(value)
      );
    }
    if (body.personalImages !== undefined) {
      elementPatch.personalImages = body.personalImages;
    }
    if (body.frameId !== undefined) {
      elementPatch.frameId = body.frameId;
    }

    if (
      Object.keys(values).length === 0 &&
      Object.keys(elementPatch).length === 0
    ) {
      return respErr('nothing to update');
    }

    if (Object.keys(elementPatch).length > 0) {
      await updateWeddingProjectElements(id, elementPatch);
    }
    let updated = project;
    if (Object.keys(values).length > 0) {
      const reloaded = await updateWeddingProject(id, values as any);
      if (reloaded) updated = reloaded;
    } else {
      const reloaded = await getWeddingProject(id);
      if (reloaded) updated = reloaded;
    }
    return respData({ project: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return respErr(error.issues[0]?.message ?? 'invalid project update');
    }
    return respErr(
      error instanceof Error ? error.message : 'failed to update project'
    );
  }
}
