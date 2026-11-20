import { findOrderByOrderNo } from '@/shared/models/order';
import {
  canRecordClientPaymentDiagnostic,
  recordPaymentDiagnostic,
} from '@/shared/models/payment-diagnostic';
import {
  canAccessWeddingProject,
  getWeddingProject,
} from '@/shared/models/wedding';
import {
  getWeddingActor,
  getWeddingProjectOwner,
} from '@/shared/models/wedding-actor';
import { checkoutClientDiagnosticSchema } from '@/shared/wedding/payment-diagnostics-contract';

const EMPTY = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return new Response(null, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 2048)
    return new Response(null, { status: 413 });
  let text: string;
  try {
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2048) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(value);
    }
    const combined = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    text = new TextDecoder().decode(combined);
  } catch {
    return new Response(null, { status: 400 });
  }
  let input;
  try {
    input = checkoutClientDiagnosticSchema.parse(JSON.parse(text));
  } catch {
    return new Response(null, { status: 400 });
  }
  try {
    const actor = await getWeddingActor();
    let ownerId = actor.user?.id || actor.guestOwnerId;
    if (!ownerId) return EMPTY();
    let ownedOrder;
    if (input.orderNo) {
      const order = await findOrderByOrderNo(input.orderNo);
      if (!order) {
        if (input.stage !== 'request_failed')
          return new Response(null, { status: 404 });
        // A checkout can allocate its number before the order insert fails.
        // Keep the failure against the verified actor, not the unknown number.
        input.orderNo = undefined;
      } else if (
        order.userId !== actor.user?.id && order.userId !== actor.guestOwnerId
      ) {
        return new Response(null, { status: 404 });
      } else {
        ownedOrder = order;
        ownerId = order.userId;
      }
    }
    if (
      input.projectId &&
      ownedOrder &&
      ownedOrder.projectId !== input.projectId
    )
      return new Response(null, { status: 404 });
    if (input.projectId && !ownedOrder) {
      const project = await getWeddingProject(input.projectId);
      const projectOwner = project
        ? getWeddingProjectOwner(actor, project)
        : undefined;
      if (
        !project ||
        !(await canAccessWeddingProject({
          id: input.projectId,
          userId: projectOwner,
          guestId: request.headers.get('x-wedding-guest-id') || undefined,
        }))
      )
        return new Response(null, { status: 404 });
    }
    if (!ownerId) return EMPTY();
    if (!(await canRecordClientPaymentDiagnostic(ownerId, input.attemptId)))
      return new Response(null, { status: 429 });
    await recordPaymentDiagnostic({ ...input, ownerId, source: 'client' });
    return EMPTY();
  } catch {
    // Analytics/storage failure must never break checkout or expose raw errors.
    return new Response(null, { status: 503 });
  }
}
