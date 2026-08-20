/**
 * Wedding Crest Studio persistence layer.
 *
 * Reuses the template's Drizzle multi-dialect core (`@/core/db`) and the
 * Better Auth `user` / `order` tables. Wedding domain rows stay isolated in
 * the `wedding_*` table family.
 */

import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  order,
  weddingAsset,
  weddingGeneration,
  weddingGenerationReview,
  weddingProject,
  weddingProjectElement,
  weddingPromptTemplate,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { OrderStatus } from '@/shared/models/order';
import { WEDDING_PACK_PRODUCT_ID } from '@/shared/wedding/config';
import { weddingPalettes, WeddingProjectInput } from '@/shared/wedding/types';

export type WeddingProjectRow = typeof weddingProject.$inferSelect;
export type WeddingGeneration = typeof weddingGeneration.$inferSelect;
export type WeddingGenerationReviewRow =
  | typeof weddingGenerationReview.$inferSelect
  | undefined;

export type WeddingProject = WeddingProjectRow & {
  /** Normalized input derived from the row plus its elements. */
  input: WeddingProjectInput;
  generations: WeddingGeneration[];
  elements: (typeof weddingProjectElement.$inferSelect)[];
};

export type NewWeddingGeneration = typeof weddingGeneration.$inferInsert;
export type NewWeddingAsset = typeof weddingAsset.$inferInsert;

/* -------------------------------------------------------------------------- */
/* Input normalization                                                         */
/* -------------------------------------------------------------------------- */

function parseInitials(value: string): string[] {
  return value
    .split('')
    .map((letter) => letter.trim().charAt(0).toUpperCase())
    .filter(Boolean);
}

function parsePalette(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed))
      return parsed.filter((c) => typeof c === 'string');
  } catch {
    // fall through to default palette
  }
  return weddingPalettes[0].colors;
}

function buildInput(
  row: WeddingProjectRow,
  elements: (typeof weddingProjectElement.$inferSelect)[]
): WeddingProjectInput {
  const flowers = elements
    .filter((element) => element.type === 'flower')
    .map((element) => element.value);
  const personalElements = elements
    .filter((element) => element.type === 'personal')
    .map((element) => element.value);
  return {
    partner1: row.partner1,
    partner2: row.partner2,
    initials: parseInitials(row.initials),
    weddingDate: row.weddingDate,
    style: row.style,
    layout: row.layout,
    typography: row.typography,
    palette: parsePalette(row.palette),
    location: row.location,
    venue: row.venue,
    flowers,
    personalElements,
    complexity: row.complexity,
    nameDisplay: (row as WeddingProjectRow & { nameDisplay?: string })
      .nameDisplay
      ? ((row as WeddingProjectRow & { nameDisplay?: string })
          .nameDisplay as WeddingProjectInput['nameDisplay'])
      : 'initials_amp',
    showDate:
      (row as WeddingProjectRow & { showDate?: boolean }).showDate !== false,
  };
}

async function getProjectElements(projectId: string) {
  return db()
    .select()
    .from(weddingProjectElement)
    .where(eq(weddingProjectElement.projectId, projectId))
    .orderBy(asc(weddingProjectElement.createdAt));
}

/* -------------------------------------------------------------------------- */
/* Projects                                                                    */
/* -------------------------------------------------------------------------- */

export async function getWeddingProject(
  id: string
): Promise<WeddingProject | null> {
  const [row] = await db()
    .select()
    .from(weddingProject)
    .where(eq(weddingProject.id, id));
  if (!row) return null;

  const [elements, generations] = await Promise.all([
    getProjectElements(id),
    db()
      .select()
      .from(weddingGeneration)
      .where(eq(weddingGeneration.projectId, id))
      .orderBy(
        asc(weddingGeneration.candidateIndex),
        asc(weddingGeneration.createdAt)
      ),
  ]);

  return { ...row, elements, generations, input: buildInput(row, elements) };
}

export async function listWeddingProjectsForUser(userId: string) {
  return db()
    .select()
    .from(weddingProject)
    .where(eq(weddingProject.userId, userId))
    .orderBy(desc(weddingProject.updatedAt));
}

export async function listWeddingProjectsForGuest(guestId: string) {
  return db()
    .select()
    .from(weddingProject)
    .where(and(eq(weddingProject.guestId, guestId)))
    .orderBy(desc(weddingProject.updatedAt));
}

export interface CreateWeddingProjectParams {
  userId?: string;
  guestId?: string;
  partner1: string;
  partner2: string;
  initials?: string[];
  weddingDate?: string | null;
  location?: string | null;
  venue?: string | null;
  style: string;
  layout: string;
  typography?: string;
  palette: string[];
  complexity?: string;
  nameDisplay?: string;
  showDate?: boolean;
  flowers?: string[];
  personalElements?: string[];
  status?: string;
}

export async function createWeddingProject(params: CreateWeddingProjectParams) {
  const id = getUuid();
  const initials =
    params.initials && params.initials.length > 0
      ? params.initials
          .map((letter) => letter.trim().charAt(0).toUpperCase())
          .filter(Boolean)
      : [
          params.partner1.trim().charAt(0).toUpperCase(),
          params.partner2.trim().charAt(0).toUpperCase(),
        ];

  const [row] = await db()
    .insert(weddingProject)
    .values({
      id,
      userId: params.userId ?? null,
      guestId: params.guestId ?? null,
      partner1: params.partner1.trim(),
      partner2: params.partner2.trim(),
      initials: initials.join(''),
      weddingDate: params.weddingDate ?? null,
      location: params.location ?? null,
      venue: params.venue ?? null,
      style: params.style,
      layout: params.layout,
      typography: params.typography ?? 'editorial_rose',
      palette: JSON.stringify(params.palette ?? weddingPalettes[0].colors),
      complexity: params.complexity ?? 'medium',
      nameDisplay: params.nameDisplay ?? 'initials_amp',
      showDate: params.showDate !== false,
      status: params.status ?? 'draft',
    })
    .returning();

  const elements = [
    ...(params.flowers ?? []).map((value) => ({
      id: getUuid(),
      projectId: id,
      type: 'flower',
      value,
    })),
    ...(params.personalElements ?? []).map((value) => ({
      id: getUuid(),
      projectId: id,
      type: 'personal',
      value,
    })),
  ];
  if (elements.length > 0) {
    await db().insert(weddingProjectElement).values(elements);
  }

  return getWeddingProject(id);
}

/** Update project status (string shorthand) or config fields. */
export async function updateWeddingProject(
  id: string,
  update: string | Partial<typeof weddingProject.$inferInsert>
) {
  const values =
    typeof update === 'string' ? { status: update } : (update as any);
  await db()
    .update(weddingProject)
    .set(values)
    .where(eq(weddingProject.id, id));
  return getWeddingProject(id);
}

export async function claimWeddingProject(id: string, userId: string) {
  const [row] = await db()
    .update(weddingProject)
    .set({ userId })
    .where(and(eq(weddingProject.id, id)))
    .returning();
  return row;
}

export async function canAccessWeddingProject({
  id,
  userId,
  guestId,
}: {
  id: string;
  userId?: string;
  guestId?: string;
}): Promise<boolean> {
  const [row] = await db()
    .select()
    .from(weddingProject)
    .where(eq(weddingProject.id, id));
  if (!row) return false;
  if (userId && row.userId === userId) return true;
  // Guests keep access only while the project has not been claimed yet.
  if (!row.userId && guestId && row.guestId === guestId) return true;
  return false;
}

/* -------------------------------------------------------------------------- */
/* Generations                                                                 */
/* -------------------------------------------------------------------------- */

export async function getWeddingGeneration(id: string) {
  const [row] = await db()
    .select()
    .from(weddingGeneration)
    .where(eq(weddingGeneration.id, id));
  return row ?? null;
}

export async function createWeddingGeneration(
  data: typeof weddingGeneration.$inferInsert
) {
  const [row] = await db().insert(weddingGeneration).values(data).returning();
  return row;
}

export async function updateWeddingGeneration(
  id: string,
  update: Partial<typeof weddingGeneration.$inferInsert>
) {
  const [row] = await db()
    .update(weddingGeneration)
    .set(update)
    .where(eq(weddingGeneration.id, id))
    .returning();
  return row;
}

export async function createWeddingReview(
  data: typeof weddingGenerationReview.$inferInsert
) {
  const [row] = await db()
    .insert(weddingGenerationReview)
    .values(data)
    .returning();
  return row;
}

/**
 * Number of generate batches already stored for the project. Failed
 * candidates do not count so a misconfigured provider never burns quota.
 */
export async function countWeddingGenerationBatches(
  projectId: string,
  candidatesPerBatch: number
) {
  const rows = await db()
    .select({ id: weddingGeneration.id })
    .from(weddingGeneration)
    .where(
      and(
        eq(weddingGeneration.projectId, projectId),
        ne(weddingGeneration.status, 'failed')
      )
    );
  return Math.ceil(rows.length / candidatesPerBatch);
}

/** Projects of a user/guest that already contain generations. */
export async function countProjectsWithGenerations(params: {
  userId?: string;
  guestId?: string;
}) {
  const owners = await db()
    .select({
      id: weddingProject.id,
      userId: weddingProject.userId,
      guestId: weddingProject.guestId,
    })
    .from(weddingProject)
    .where(
      params.userId
        ? eq(weddingProject.userId, params.userId)
        : eq(weddingProject.guestId, params.guestId ?? '__none__')
    );
  if (owners.length === 0) return 0;
  const ids = owners.map((owner: { id: string }) => owner.id);
  const rows = await db()
    .selectDistinct({ projectId: weddingGeneration.projectId })
    .from(weddingGeneration)
    .where(inArray(weddingGeneration.projectId, ids));
  return rows.length;
}

/* -------------------------------------------------------------------------- */
/* Paid entitlement                                                            */
/* -------------------------------------------------------------------------- */

export async function hasPaidWeddingOrder(
  userId: string,
  projectId?: string
): Promise<boolean> {
  const orders = await db()
    .select({
      projectId: order.projectId,
      productId: order.productId,
    })
    .from(order)
    .where(and(eq(order.userId, userId), eq(order.status, OrderStatus.PAID)));
  return orders.some(
    (row: { projectId: string | null; productId: string | null }) =>
      (projectId ? row.projectId === projectId : false) ||
      row.productId === WEDDING_PACK_PRODUCT_ID
  );
}

/* -------------------------------------------------------------------------- */
/* Assets & prompt templates                                                   */
/* -------------------------------------------------------------------------- */

export async function saveWeddingAssets(
  projectId: string,
  assets: (typeof weddingAsset.$inferInsert)[]
) {
  if (assets.length === 0) return;
  await db()
    .delete(weddingAsset)
    .where(and(eq(weddingAsset.projectId, projectId)));
  await db().insert(weddingAsset).values(assets);
}

export async function getWeddingAssets(projectId: string) {
  return db()
    .select()
    .from(weddingAsset)
    .where(eq(weddingAsset.projectId, projectId));
}

export async function upsertWeddingPromptTemplate(
  data: typeof weddingPromptTemplate.$inferInsert
) {
  const [row] = await db()
    .insert(weddingPromptTemplate)
    .values(data)
    .returning();
  return row;
}

export async function getActiveWeddingPromptTemplate(style: string) {
  const [row] = await db()
    .select()
    .from(weddingPromptTemplate)
    .where(
      and(
        eq(weddingPromptTemplate.style, style),
        eq(weddingPromptTemplate.active, true)
      )
    )
    .orderBy(desc(weddingPromptTemplate.createdAt));
  return row ?? null;
}
