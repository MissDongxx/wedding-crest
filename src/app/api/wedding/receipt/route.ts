import { z } from 'zod';

import { respData, respErr } from '@/shared/lib/resp';
import {
  getWeddingAccountAccess,
  getWeddingProject,
} from '@/shared/models/wedding';
import {
  getWeddingActor,
  getWeddingProjectOwner,
  getWeddingPurchaseOwner,
} from '@/shared/models/wedding-actor';
import { saveWeddingReceiptContact } from '@/shared/models/wedding-checkout';

/** Optional contact fallback; this never verifies an email or creates a login. */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (
      (origin && origin !== new URL(request.url).origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      return respErr('invalid origin', 403);
    const body = z
      .object({
        email: z.string().trim().email().max(254),
        projectId: z.string().trim().min(1).max(100).optional(),
      })
      .strict()
      .parse(await request.json());
    const actor = await getWeddingActor();
    let ownerId = await getWeddingPurchaseOwner(actor);
    if (body.projectId) {
      const project = await getWeddingProject(body.projectId);
      ownerId = project ? getWeddingProjectOwner(actor, project) : undefined;
      if (!ownerId) return respErr('project not found', 404);
    }
    if (!ownerId) return respErr('purchase access required', 401);
    if (!(await getWeddingAccountAccess(ownerId)).purchased)
      return respErr('paid purchase required', 403);
    if (!(await saveWeddingReceiptContact(ownerId, body.email)))
      return respErr('paid purchase required', 403);
    return respData({
      saved: true,
      source: 'buyer_contact',
      hasReceiptEmail: true,
      receiptEmailMissing: false,
    });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return respErr('enter a valid email address', 400);
    return respErr(
      'Contact email could not be saved. Your payment access is unchanged.',
      503
    );
  }
}
