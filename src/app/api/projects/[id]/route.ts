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
} from '@/shared/models/wedding';
import {
  decideGenerationAllowance,
  layoutsForStyle,
  selectLayout,
  WEDDING_MAX_CANDIDATES,
} from '@/shared/wedding/config';

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

const patchSchema = z.object({
  typography: z.string().trim().min(1).optional(),
  nameDisplay: z
    .enum([
      'initials_amp',
      'initials_joined',
      'initials_spaced',
      'full_names',
      'surname',
    ])
    .optional(),
  showDate: z.boolean().optional(),
  layout: z.string().trim().min(1).optional(),
});

/** Persist typography/customize choices made on the result page. */
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
    if (body.typography) values.typography = body.typography;
    if (body.nameDisplay) values.nameDisplay = body.nameDisplay;
    if (body.showDate !== undefined) values.showDate = body.showDate;
    if (body.layout) {
      // Layout must stay within the style's supported templates.
      const allowed = layoutsForStyle(project.style);
      const requested = allowed.find((layout) => layout.id === body.layout);
      values.layout = (requested ?? selectLayout(project.style)).id;
    }
    if (Object.keys(values).length === 0) {
      return respErr('nothing to update');
    }

    const updated = await updateWeddingProject(id, values as any);
    return respData({ project: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return respErr('invalid project update');
    }
    return respErr(
      error instanceof Error ? error.message : 'failed to update project'
    );
  }
}
