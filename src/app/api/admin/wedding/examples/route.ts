import { z } from 'zod';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import {
  countWeddingExamples,
  createWeddingExample,
  listWeddingExamples,
} from '@/shared/models/wedding';
import { isWeddingExampleStyle } from '@/shared/wedding/types';

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  style: z.string().trim().min(1).max(60),
  imageUrl: z.string().trim().url(),
  altText: z.string().trim().max(240).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(10000).optional().default(0),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const style = url.searchParams.get('style') ?? undefined;
    const [items, total] = await Promise.all([
      listWeddingExamples({ style }),
      countWeddingExamples(),
    ]);
    return respData({ items, total });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to list examples'
    );
  }
}

export async function POST(request: Request) {
  try {
    const locale = request.headers.get('x-wedding-locale') ?? 'en';
    await requirePermission({
      code: PERMISSIONS.WEDDING_EXAMPLES_WRITE,
      redirectUrl: '/no-permission',
      locale,
    });
    const body = createSchema.parse(await request.json().catch(() => ({})));
    if (!isWeddingExampleStyle(body.style)) {
      return respErr('unsupported example style');
    }
    const row = await createWeddingExample({
      id: getUuid(),
      ...body,
    });
    return respData({ item: row });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to create example'
    );
  }
}
