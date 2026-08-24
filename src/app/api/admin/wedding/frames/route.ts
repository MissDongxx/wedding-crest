import { z } from 'zod';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import {
  countWeddingFrames,
  createWeddingFrame,
  listWeddingFrames,
} from '@/shared/models/wedding';

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().trim().url(),
  thumbnailUrl: z.string().trim().url().optional().nullable(),
  altText: z.string().trim().max(240).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(10000).optional().default(0),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const style = url.searchParams.get('style') ?? undefined;
    const [items, total] = await Promise.all([
      listWeddingFrames({ style }),
      countWeddingFrames(),
    ]);
    return respData({ items, total });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to list frames'
    );
  }
}

export async function POST(request: Request) {
  try {
    const locale = request.headers.get('x-wedding-locale') ?? 'en';
    await requirePermission({
      code: PERMISSIONS.WEDDING_FRAMES_WRITE,
      redirectUrl: '/no-permission',
      locale,
    });
    const body = createSchema.parse(await request.json().catch(() => ({})));
    const row = await createWeddingFrame({
      id: getUuid(),
      style: null,
      ...body,
    });
    return respData({ item: row });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to create frame'
    );
  }
}
