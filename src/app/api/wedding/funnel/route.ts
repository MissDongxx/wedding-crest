import { and, count, eq, gte } from 'drizzle-orm';
import { ZodError } from 'zod';

import { db } from '@/core/db';
import { weddingFunnelEvent, weddingGeneration } from '@/config/db/schema';
import { getUserInfo } from '@/shared/models/user';
import { canAccessWeddingProject } from '@/shared/models/wedding';
import { funnelInput } from '@/shared/wedding/funnel';

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      return new Response(null, { status: 403 });
    if (Number(request.headers.get('content-length') || 0) > 2048)
      return new Response(null, { status: 413 });
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400 });
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 2048) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(value);
    }
    const joined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.length;
    }
    const raw = new TextDecoder().decode(joined);
    if (raw.length > 2048) return new Response(null, { status: 413 });
    const input = funnelInput.parse(JSON.parse(raw));
    const [existing] = await db()
      .select({ id: weddingFunnelEvent.id })
      .from(weddingFunnelEvent)
      .where(eq(weddingFunnelEvent.id, input.id));
    if (existing) return new Response(null, { status: 204 });
    const [usage] = await db()
      .select({ total: count() })
      .from(weddingFunnelEvent)
      .where(
        and(
          eq(weddingFunnelEvent.anonymousId, input.anonymousId),
          gte(weddingFunnelEvent.createdAt, new Date(Date.now() - 86400000))
        )
      );
    if (usage.total >= 300) return new Response(null, { status: 429 });
    const user = await getUserInfo();
    const guestId = request.headers.get('x-wedding-guest-id') || undefined;
    if (input.eventName !== 'create_clicked' && !input.projectId)
      return new Response(null, { status: 400 });
    if (
      input.projectId &&
      !(await canAccessWeddingProject({
        id: input.projectId,
        userId: user?.id,
        guestId,
      }))
    )
      return new Response(null, { status: 404 });
    if (input.generationId) {
      const [g] = await db()
        .select({ projectId: weddingGeneration.projectId })
        .from(weddingGeneration)
        .where(eq(weddingGeneration.id, input.generationId));
      if (!g || g.projectId !== input.projectId)
        return new Response(null, { status: 400 });
    }
    const testUsers = (process.env.WEDDING_FUNNEL_TEST_USER_IDS || '')
      .split(',')
      .filter(Boolean);
    const testGuests = (process.env.WEDDING_FUNNEL_TEST_GUEST_IDS || '')
      .split(',')
      .filter(Boolean);
    const isTest = !!(
      (user &&
        (testUsers.includes(user.id) ||
          user.name.toLowerCase() === 'lalune')) ||
      (guestId && testGuests.includes(guestId))
    );
    await db()
      .insert(weddingFunnelEvent)
      .values({ ...input, userId: user?.id, isTest, createdAt: new Date() })
      .onConflictDoNothing();
    return new Response(null, { status: 204 });
  } catch (error) {
    return new Response(null, {
      status:
        error instanceof ZodError || error instanceof SyntaxError ? 400 : 503,
    });
  }
}
