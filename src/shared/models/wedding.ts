/**
 * Wedding Crest Studio persistence layer.
 *
 * Reuses the template's Drizzle multi-dialect core (`@/core/db`) and the
 * Better Auth `user` / `order` tables. Wedding domain rows stay isolated in
 * the `wedding_*` table family.
 */

import { and, asc, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  runInDbTransaction,
  withDb,
  withDbRetry,
  type DbExecutor,
} from '@/core/db/transaction';
import {
  order,
  weddingAsset,
  weddingExample,
  weddingFrame,
  weddingGeneration,
  weddingGenerationReview,
  weddingProject,
  weddingProjectElement,
  weddingPromptTemplate,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { OrderStatus } from '@/shared/models/order';
import { WEDDING_PACK_PRODUCT_ID } from '@/shared/wedding/config';
import {
  weddingPalettes,
  WeddingProjectInput,
  type WeddingMatchExampleFlags,
} from '@/shared/wedding/types';

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
  const personalImages = elements
    .filter((element) => element.type === 'personal_image')
    .map((element) => element.value)
    .filter((url) => /^https?:\/\//.test(url) || url.startsWith('/'));
  const frameElements = elements.filter((element) => element.type === 'frame');
  const frameId = frameElements.length > 0 ? frameElements[0].value : null;

  // "Same as example" plumbing. The example image URL and the per-property
  // match flags are stored as two element rows (type='example_image' and
  // type='example_match') so we don't have to migrate the wedding_project
  // schema. The flags JSON is parsed defensively — an invalid/legacy row
  // silently falls back to "no match flags" rather than breaking the
  // prompt compiler.
  const exampleImageElement = elements.find(
    (element) => element.type === 'example_image'
  );
  const exampleStyleElement = elements.find(
    (element) => element.type === 'example_style'
  );
  const exampleMatchElement = elements.find(
    (element) => element.type === 'example_match'
  );
  const exampleImage = exampleImageElement?.value ?? null;
  const exampleStyle = exampleStyleElement?.value ?? null;
  let matchExample: WeddingProjectInput['matchExample'] = null;
  if (exampleMatchElement?.value) {
    try {
      const parsed = JSON.parse(exampleMatchElement.value);
      if (parsed && typeof parsed === 'object') {
        matchExample = {
          border: Boolean(parsed.border),
          palette: Boolean(parsed.palette),
          flowers: Boolean(parsed.flowers),
          elements: Boolean(parsed.elements),
        };
      }
    } catch {
      matchExample = null;
    }
  }

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
    personalImages: personalImages.length > 0 ? personalImages : undefined,
    complexity: row.complexity,
    nameDisplay: (row as WeddingProjectRow & { nameDisplay?: string })
      .nameDisplay
      ? ((row as WeddingProjectRow & { nameDisplay?: string })
          .nameDisplay as WeddingProjectInput['nameDisplay'])
      : 'initials_amp',
    showDate:
      (row as WeddingProjectRow & { showDate?: boolean }).showDate !== false,
    frameId,
    exampleImage,
    exampleStyle,
    matchExample,
  };
}

function getProjectElements(exec: DbExecutor, projectId: string) {
  return exec
    .select()
    .from(weddingProjectElement)
    .where(eq(weddingProjectElement.projectId, projectId))
    .orderBy(asc(weddingProjectElement.createdAt));
}

/* -------------------------------------------------------------------------- */
/* Projects                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Read a project plus its elements and generations through `exec`.
 *
 * Kept separate from `getWeddingProject` so a create can read its own result
 * back on the transaction's connection instead of opening new ones (which is
 * exactly where the old create flow used to fail *after* committing).
 */
async function loadWeddingProject(
  exec: DbExecutor,
  id: string
): Promise<WeddingProject | null> {
  const [row] = await exec
    .select()
    .from(weddingProject)
    .where(eq(weddingProject.id, id));
  if (!row) return null;

  const [elements, generations] = await Promise.all([
    getProjectElements(exec, id),
    exec
      .select()
      .from(weddingGeneration)
      .where(eq(weddingGeneration.projectId, id))
      .orderBy(
        asc(weddingGeneration.candidateIndex),
        asc(weddingGeneration.createdAt)
      ),
  ]);

  const input = buildInput(row, elements);
  // Read the frame on the same connection: opening a second one here used to
  // double the failure surface of every project read.
  const frame = input.frameId
    ? await getWeddingFrame(input.frameId, exec)
    : null;
  return {
    ...row,
    elements,
    generations,
    input: {
      ...input,
      frameUrl: frame?.url ?? null,
    },
  };
}

export async function getWeddingProject(
  id: string
): Promise<WeddingProject | null> {
  // Wrapped so a dropped Hyperdrive connection is retried instead of failing
  // the request — this read sits in front of generation, so a transient blip
  // used to cost the user an entire generation attempt.
  return withDb((exec) => loadWeddingProject(exec, id), {
    label: 'getWeddingProject',
  });
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
  personalImages?: string[];
  frameId?: string | null;
  /** Reference image URL from the `wedding_example` the user came in with.
   *  Stored as an `example_image` element and forwarded to the multimodal
   *  model as the first reference image so flagged properties can match. */
  exampleImage?: string | null;
  /** The example reference's own style id, captured so the prompt compiler
   *  can tell whether the user kept the example's style or switched. Stored
   *  as an `example_style` element row alongside `example_image`. */
  exampleStyle?: string | null;
  /** Per-property "match the example image" flags. Stored as a single
   *  `example_match` element (JSON-encoded) so we don't need a schema
   *  migration. */
  matchExample?: WeddingMatchExampleFlags | null;
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

  const projectValues = {
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
  };

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
    ...(params.personalImages ?? [])
      .filter((url) => /^https?:\/\//.test(url) || url.startsWith('/'))
      .map((value) => ({
        id: getUuid(),
        projectId: id,
        type: 'personal_image',
        value,
      })),
    ...(params.frameId
      ? [
          {
            id: getUuid(),
            projectId: id,
            type: 'frame',
            value: params.frameId,
          },
        ]
      : []),
    // The example reference image + per-property "match the example"
    // flags are stored as two element rows. We only persist them when
    // exampleImage is a usable URL — matchExample without a reference
    // image is a no-op in the prompt compiler.
    ...(params.exampleImage && /^https?:\/\//.test(params.exampleImage)
      ? [
          {
            id: getUuid(),
            projectId: id,
            type: 'example_image',
            value: params.exampleImage,
          },
        ]
      : []),
    ...(params.exampleImage &&
    /^https?:\/\//.test(params.exampleImage) &&
    params.matchExample
      ? [
          {
            id: getUuid(),
            projectId: id,
            type: 'example_match',
            value: JSON.stringify(params.matchExample),
          },
        ]
      : []),
    // The example's own style id. Persisted only when both an example
    // image and a style are present - the prompt compiler treats a stray
    // exampleStyle as "no reference" and ignores it.
    ...(params.exampleImage &&
    /^https?:\/\//.test(params.exampleImage) &&
    params.exampleStyle
      ? [
          {
            id: getUuid(),
            projectId: id,
            type: 'example_style',
            value: params.exampleStyle,
          },
        ]
      : []),
  ];

  // Project + its element rows are written in ONE transaction on ONE
  // connection. Previously each statement called `db()` separately, which on
  // Cloudflare/Hyperdrive means a separate TCP connection — if the second
  // one failed the project stayed committed with zero element rows (flowers,
  // frame and the example wiring silently lost). A transaction makes the
  // write all-or-nothing, and the read-back below reuses the same
  // connection so a commit is never reported as a failure.
  //
  // Both writes are idempotent for a fixed `id`, so the transient-error
  // retry can never create duplicate rows: the project insert skips an
  // already-written row and the elements are replaced, not appended.
  return runInDbTransaction(
    async (tx) => {
      await tx
        .insert(weddingProject)
        .values(projectValues)
        .onConflictDoNothing();

      if (elements.length > 0) {
        await tx
          .delete(weddingProjectElement)
          .where(eq(weddingProjectElement.projectId, id));
        await tx.insert(weddingProjectElement).values(elements);
      }

      const created = await loadWeddingProject(tx, id);
      if (!created) {
        throw new Error(`wedding project ${id} disappeared after insert`);
      }
      return created;
    },
    { retry: true, label: 'createWeddingProject' }
  );
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

/** Element types whose rows can be replaced wholesale by the edit flow. */
export type WeddingElementPatch = {
  flowers?: string[];
  personalElements?: string[];
  personalImages?: string[];
  frameId?: string | null;
};

/**
 * Replace the element rows for any field present in the patch. Each
 * provided field deletes its existing rows of that type and inserts the
 * new values, so the project's flowers / personal elements / reference
 * photos / frame always mirror exactly what the edit flow sent. Fields
 * absent from the patch keep their current rows untouched, so the
 * caller can update a single field without touching the others.
 */
export async function updateWeddingProjectElements(
  id: string,
  patch: WeddingElementPatch
) {
  const byType: { type: string; values: string[] }[] = [];
  if (patch.flowers) byType.push({ type: 'flower', values: patch.flowers });
  if (patch.personalElements)
    byType.push({ type: 'personal', values: patch.personalElements });
  if (patch.personalImages)
    byType.push({
      type: 'personal_image',
      values: patch.personalImages.filter(
        (url) => /^https?:\/\//.test(url) || url.startsWith('/')
      ),
    });
  if (patch.frameId !== undefined)
    byType.push({
      type: 'frame',
      values: patch.frameId ? [patch.frameId] : [],
    });

  if (byType.length === 0) return;

  // Same reasoning as the create path: the delete/insert pairs used to run
  // on separate connections, so a failure after a delete left the project
  // missing that field entirely. One transaction keeps each field's swap
  // atomic, and the whole patch is retried once on a transient error.
  await runInDbTransaction(
    async (tx) => {
      for (const { type, values } of byType) {
        await tx
          .delete(weddingProjectElement)
          .where(
            and(
              eq(weddingProjectElement.projectId, id),
              eq(weddingProjectElement.type, type)
            )
          );
        if (values.length > 0) {
          await tx.insert(weddingProjectElement).values(
            values.map((value) => ({
              id: getUuid(),
              projectId: id,
              type,
              value,
            }))
          );
        }
      }
    },
    { retry: true, label: 'updateWeddingProjectElements' }
  );
}

export async function claimWeddingProject(id: string, userId: string) {
  // Idempotent, so a retry after a dropped connection is harmless.
  return withDbRetry(
    async () => {
      const [row] = await db()
        .update(weddingProject)
        .set({ userId })
        .where(and(eq(weddingProject.id, id)))
        .returning();
      return row;
    },
    { label: 'claimWeddingProject' }
  );
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
  return withDb(
    async (exec) => {
      const [row] = await exec
        .select()
        .from(weddingProject)
        .where(eq(weddingProject.id, id));
      if (!row) return false;
      if (userId && row.userId === userId) return true;
      // Guests keep access only while the project has not been claimed yet.
      if (!row.userId && guestId && row.guestId === guestId) return true;
      return false;
    },
    { label: 'canAccessWeddingProject' }
  );
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
  const rows = await withDb(
    async (exec) =>
      await exec
        .select({ id: weddingGeneration.id })
        .from(weddingGeneration)
        .where(
          and(
            eq(weddingGeneration.projectId, projectId),
            ne(weddingGeneration.status, 'failed')
          )
        ),
    { label: 'countWeddingGenerationBatches' }
  );
  return Math.ceil(rows.length / candidatesPerBatch);
}

/** Projects of a user/guest that already contain generations. */
export async function countProjectsWithGenerations(params: {
  userId?: string;
  guestId?: string;
}) {
  return withDb(
    async (exec) => {
      const owners = await exec
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
      const rows = await exec
        .selectDistinct({ projectId: weddingGeneration.projectId })
        .from(weddingGeneration)
        .where(inArray(weddingGeneration.projectId, ids));
      return rows.length;
    },
    { label: 'countProjectsWithGenerations' }
  );
}

/** Return one existing project that already contains a generation. */
export async function findWeddingProjectWithGeneration(params: {
  userId?: string;
  guestId?: string;
}) {
  return withDb(
    async (exec) => {
      const owners = await exec
        .select({ id: weddingProject.id })
        .from(weddingProject)
        .where(
          params.userId
            ? eq(weddingProject.userId, params.userId)
            : eq(weddingProject.guestId, params.guestId ?? '__none__')
        );
      if (owners.length === 0) return null;

      const [row] = await exec
        .select({ projectId: weddingGeneration.projectId })
        .from(weddingGeneration)
        .where(
          inArray(
            weddingGeneration.projectId,
            owners.map((owner: { id: string }) => owner.id)
          )
        )
        .orderBy(asc(weddingGeneration.createdAt))
        .limit(1);

      return row?.projectId ?? null;
    },
    { label: 'findWeddingProjectWithGeneration' }
  );
}

/* -------------------------------------------------------------------------- */
/* Paid entitlement                                                            */
/* -------------------------------------------------------------------------- */

export async function hasPaidWeddingOrder(
  userId: string,
  projectId?: string
): Promise<boolean> {
  const orders = await withDb(
    async (exec) =>
      await exec
        .select({
          projectId: order.projectId,
          productId: order.productId,
        })
        .from(order)
        .where(
          and(eq(order.userId, userId), eq(order.status, OrderStatus.PAID))
        ),
    { label: 'hasPaidWeddingOrder' }
  );
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
  // Delete + insert must not be split across connections: a failure after
  // the delete would leave the project with no assets at all.
  await runInDbTransaction(
    async (tx) => {
      await tx
        .delete(weddingAsset)
        .where(and(eq(weddingAsset.projectId, projectId)));
      await tx.insert(weddingAsset).values(assets);
    },
    { retry: true }
  );
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

/* -------------------------------------------------------------------------- */
/* Wedding Frame (admin-managed border library)                                 */
/* -------------------------------------------------------------------------- */

export type WeddingFrameRow = typeof weddingFrame.$inferSelect;
export type NewWeddingFrame = typeof weddingFrame.$inferInsert;
export type WeddingExampleRow = typeof weddingExample.$inferSelect;
export type NewWeddingExample = typeof weddingExample.$inferInsert;

export async function listWeddingFrames(opts?: {
  style?: string;
  activeOnly?: boolean;
}) {
  const filters = [];
  if (opts?.style) {
    filters.push(
      or(isNull(weddingFrame.style), eq(weddingFrame.style, opts.style))
    );
  }
  if (opts?.activeOnly) filters.push(eq(weddingFrame.isActive, true));
  return db()
    .select()
    .from(weddingFrame)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(weddingFrame.sortOrder), asc(weddingFrame.createdAt));
}

export async function getWeddingFrame(id: string, exec?: DbExecutor) {
  const [row] = await (exec ?? db())
    .select()
    .from(weddingFrame)
    .where(eq(weddingFrame.id, id));
  return row ?? null;
}

export async function createWeddingFrame(data: NewWeddingFrame) {
  const [row] = await db().insert(weddingFrame).values(data).returning();
  return row;
}

export async function updateWeddingFrame(
  id: string,
  patch: Partial<Omit<NewWeddingFrame, 'id' | 'createdAt'>>
) {
  const [row] = await db()
    .update(weddingFrame)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(weddingFrame.id, id))
    .returning();
  return row ?? null;
}

export async function deleteWeddingFrame(id: string) {
  const [row] = await db()
    .delete(weddingFrame)
    .where(eq(weddingFrame.id, id))
    .returning();
  return row ?? null;
}

export async function countWeddingFrames() {
  const rows = await db().select({ id: weddingFrame.id }).from(weddingFrame);
  return rows.length;
}

/* -------------------------------------------------------------------------- */
/* Wedding Example (home-page real product photos)                              */
/* -------------------------------------------------------------------------- */

export type WeddingExampleListOptions = {
  style?: string;
  activeOnly?: boolean;
};

export async function listWeddingExamples(opts?: WeddingExampleListOptions) {
  const filters = [];
  if (opts?.style) filters.push(eq(weddingExample.style, opts.style));
  if (opts?.activeOnly) filters.push(eq(weddingExample.isActive, true));
  return db()
    .select()
    .from(weddingExample)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(weddingExample.sortOrder), asc(weddingExample.createdAt));
}

/**
 * Public pages should remain renderable when the optional examples database
 * is unavailable. The timeout prevents a stalled Hyperdrive query from
 * holding the whole page response open.
 */
export async function listWeddingExamplesSafe(
  opts?: WeddingExampleListOptions,
  timeoutMs = 3000
) {
  try {
    return await Promise.race([
      listWeddingExamples(opts),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('wedding examples query timed out')),
          timeoutMs
        )
      ),
    ]);
  } catch {
    return [];
  }
}

export async function getWeddingExample(id: string) {
  const [row] = await db()
    .select()
    .from(weddingExample)
    .where(eq(weddingExample.id, id));
  return row ?? null;
}

export async function createWeddingExample(data: NewWeddingExample) {
  const [row] = await db().insert(weddingExample).values(data).returning();
  return row;
}

export async function updateWeddingExample(
  id: string,
  patch: Partial<Omit<NewWeddingExample, 'id' | 'createdAt'>>
) {
  const [row] = await db()
    .update(weddingExample)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(weddingExample.id, id))
    .returning();
  return row ?? null;
}

export async function deleteWeddingExample(id: string) {
  const [row] = await db()
    .delete(weddingExample)
    .where(eq(weddingExample.id, id))
    .returning();
  return row ?? null;
}

export async function countWeddingExamples() {
  const rows = await db()
    .select({ id: weddingExample.id })
    .from(weddingExample);
  return rows.length;
}
