import { z } from 'zod';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import {
  deleteWeddingFrame,
  getWeddingFrame,
  updateWeddingFrame,
} from '@/shared/models/wedding';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  style: z.string().trim().min(1).max(60).nullable().optional(),
  url: z.string().trim().url().optional(),
  thumbnailUrl: z.string().trim().url().nullable().optional(),
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
    const row = await getWeddingFrame(id);
    if (!row) return respErr('frame not found');
    return respData({ item: row });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to get frame'
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
      code: PERMISSIONS.WEDDING_FRAMES_WRITE,
      redirectUrl: '/no-permission',
      locale,
    });
    const { id } = await params;
    const body = patchSchema.parse(await request.json().catch(() => ({})));
    const row = await updateWeddingFrame(id, body);
    if (!row) return respErr('frame not found');
    return respData({ item: row });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to update frame'
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
      code: PERMISSIONS.WEDDING_FRAMES_DELETE,
      redirectUrl: '/no-permission',
      locale,
    });
    const { id } = await params;
    const row = await deleteWeddingFrame(id);
    if (!row) return respErr('frame not found');
    return respData({ item: row });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to delete frame'
    );
  }
}
