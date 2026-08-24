import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import {
  deleteWeddingExample,
  getWeddingExample,
  updateWeddingExample,
} from '@/shared/models/wedding';
import { isWeddingExampleStyle } from '@/shared/wedding/types';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  style: z.string().trim().min(1).max(60).optional(),
  imageUrl: z.string().trim().url().optional(),
  altText: z.string().trim().max(240).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await getWeddingExample(id);
    if (!row) return respErr('example not found');
    return respData({ item: row });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to get example'
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const locale = request.headers.get('x-wedding-locale') ?? 'en';
    await requirePermission({
      code: PERMISSIONS.WEDDING_EXAMPLES_WRITE,
      redirectUrl: '/no-permission',
      locale,
    });
    const { id } = await params;
    const body = patchSchema.parse(await request.json().catch(() => ({})));
    if (body.style && !isWeddingExampleStyle(body.style)) {
      return respErr('unsupported example style');
    }
    const row = await updateWeddingExample(id, body);
    if (!row) return respErr('example not found');
    // Find Your Style reads examples from the DB; purge the cached home.
    revalidatePath('/', 'layout');
    return respData({ item: row });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to update example'
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const locale = request.headers.get('x-wedding-locale') ?? 'en';
    await requirePermission({
      code: PERMISSIONS.WEDDING_EXAMPLES_DELETE,
      redirectUrl: '/no-permission',
      locale,
    });
    const { id } = await params;
    const row = await deleteWeddingExample(id);
    if (!row) return respErr('example not found');
    // Find Your Style reads examples from the DB; purge the cached home.
    revalidatePath('/', 'layout');
    return respData({ item: row });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to delete example'
    );
  }
}
