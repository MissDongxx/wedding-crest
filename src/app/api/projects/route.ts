import { z } from 'zod';

import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import {
  createWeddingProject,
  getWeddingAccountAccess,
  getWeddingExample,
  getWeddingProject,
  listWeddingProjectsForGuest,
  listWeddingProjectsForUser,
} from '@/shared/models/wedding';
import {
  getWeddingActor,
  getWeddingPurchaseOwner,
} from '@/shared/models/wedding-actor';
import { selectLayout } from '@/shared/wedding/config';
import {
  isWeddingExampleStyle,
  WEDDING_MAX_FLOWERS,
  WEDDING_MAX_PALETTE_COLORS,
  WEDDING_MAX_PERSONAL_ELEMENTS,
  weddingStyles,
} from '@/shared/wedding/types';

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/);

/** Structured, moderated text: strip control chars and cap length. */
const cleanText = (max: number) =>
  z.string().transform((value) =>
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, max)
  );

const createSchema = z.object({
  partner1: cleanText(40).pipe(z.string().min(1).max(40)),
  partner2: cleanText(40).pipe(z.string().min(1).max(40)),
  initials: z.array(cleanText(1)).max(2).optional(),
  weddingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  location: cleanText(80).nullish(),
  venue: cleanText(80).nullish(),
  style: z.enum([
    'botanical_watercolor',
    'minimal_line_art',
    'vintage_engraving',
    'italian_romance',
    'coastal',
    'classic_luxury',
  ]),
  layout: z.string().trim().min(1).optional(),
  typography: z.string().trim().min(1).optional(),
  palette: z.array(hexColor).max(WEDDING_MAX_PALETTE_COLORS),
  complexity: z.enum(['minimal', 'medium', 'rich']).optional(),
  nameDisplay: z
    .enum([
      'initials_amp',
      'initials_joined',
      'initials_spaced',
      'initials_with_names',
      'full_names',
      'surname',
      'initials_only',
    ])
    .optional(),
  showDate: z.boolean().optional(),
  showLocation: z.boolean().optional(),
  flowers: z.array(cleanText(60)).max(WEDDING_MAX_FLOWERS).optional(),
  personalElements: z
    .array(cleanText(60))
    .max(WEDDING_MAX_PERSONAL_ELEMENTS)
    .optional(),
  // Reference photo URLs the user already uploaded. Limited to 2 to keep
  // multimodal generation cost bounded and the prompt focused. Each URL
  // must point to an http(s) resource or a local path the storage service
  // can resolve at generation time.
  personalImages: z.array(z.string().trim().min(1).max(2000)).max(2).optional(),
  frameId: z.string().trim().min(1).max(80).nullable().optional(),
  // "Same as example" wiring. The client only sends the example id — the
  // server resolves it to the active example's imageUrl and validates the
  // style so the wizard can never get a user-uploaded attacker URL into
  // the prompt. The four flags map to the four wizard steps that surface
  // a "Same as example" option.
  exampleId: z.string().trim().min(1).max(80).optional(),
  // The example reference's own style id, captured so the prompt compiler
  // can tell whether the user kept the example's style or switched to a
  // different one. Optional and only meaningful when exampleId is set.
  exampleStyle: z
    .enum([
      'botanical_watercolor',
      'minimal_line_art',
      'vintage_engraving',
      'italian_romance',
      'coastal',
      'classic_luxury',
    ])
    .nullable()
    .optional(),
  matchExample: z
    .object({
      border: z.boolean().optional(),
      palette: z.boolean().optional(),
      flowers: z.boolean().optional(),
      elements: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const actor = await getWeddingActor({ createGuest: true });
    const ownerId = await getWeddingPurchaseOwner(actor);
    if (!ownerId)
      return respErr('Purchase your image pack to start a new design.', 402);
    const requestKey = request.headers.get('x-wedding-request-id');
    if (requestKey && !/^[0-9a-f-]{36}$/i.test(requestKey))
      return respErr('invalid request id', 400);
    const requestHash = requestKey
      ? await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(`${ownerId}:${requestKey}`)
        )
      : null;
    const id = requestHash
      ? Array.from(new Uint8Array(requestHash), (b) =>
          b.toString(16).padStart(2, '0')
        ).join('')
      : undefined;
    // An acknowledged purchase may already have spent its fifth slot on this exact request.
    // Replaying a saved browser draft returns that owned project even when quota is now full.
    const existing = id ? await getWeddingProject(id) : null;
    if (existing && existing.userId === ownerId)
      return respData({ project: existing });
    const access = await getWeddingAccountAccess(ownerId);
    if (!access.canCreateProject)
      return respErr(
        'Purchase your image pack to start a new design. Your choices are saved.',
        402,
        { reasonCode: 'payment_required' }
      );
    const body = createSchema.parse(await request.json());
    // Legacy header capabilities never choose an owner for new paid projects.
    const guestId = getUuid();

    const styleConfig = weddingStyles.find((s) => s.id === body.style);
    if (!styleConfig) return respErr('unknown wedding style');
    const layout = selectLayout(body.style, body.layout);

    // Resolve the example reference image server-side. We deliberately do
    // NOT trust a client-supplied imageUrl: the wizard sends only the id,
    // we look it up and verify the row is active and tagged with one of
    // the known example styles. If anything fails, we silently drop the
    // example wiring and let the project fall back to the regular flow.
    let exampleImage: string | null = null;
    let matchExample: {
      border: boolean;
      palette: boolean;
      flowers: boolean;
      elements: boolean;
    } | null = null;
    if (body.exampleId) {
      const example = await getWeddingExample(body.exampleId);
      if (
        example?.isActive &&
        isWeddingExampleStyle(example.style) &&
        /^https?:\/\//.test(example.imageUrl)
      ) {
        exampleImage = example.imageUrl;
        const flags = body.matchExample ?? {};
        matchExample = {
          border: Boolean(flags.border),
          palette: Boolean(flags.palette),
          flowers: Boolean(flags.flowers),
          elements: Boolean(flags.elements),
        };
      }
    }

    const project = await createWeddingProject({
      id,
      userId: ownerId,
      guestId,
      partner1: body.partner1,
      partner2: body.partner2,
      initials: body.initials,
      weddingDate: body.weddingDate ?? null,
      location: body.location ?? null,
      venue: body.venue ?? null,
      style: body.style,
      layout: layout.id,
      typography: body.typography ?? styleConfig.typography[0],
      palette: body.palette,
      complexity: body.complexity ?? 'medium',
      nameDisplay: body.nameDisplay ?? 'initials_amp',
      showDate: body.showDate !== false,
      showLocation: body.showLocation === true,
      flowers: body.flowers ?? [],
      personalElements: body.personalElements ?? [],
      personalImages: body.personalImages ?? [],
      frameId: body.frameId ?? null,
      exampleImage,
      // Persist only when the example was resolved - stale exampleStyle
      // without an exampleImage is a no-op in the prompt compiler, so we
      // avoid creating a dangling element row.
      exampleStyle:
        exampleImage && body.exampleStyle ? body.exampleStyle : null,
      matchExample,
      status: 'draft',
    });

    return respData({ project, guestId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return respErr('invalid project details: ' + error.issues[0]?.message);
    }
    if (
      error instanceof Error &&
      error.message.startsWith('Purchase your image pack')
    )
      return respErr(error.message, 402, { reasonCode: 'payment_required' });
    return respErr(
      error instanceof Error ? error.message : 'failed to create project'
    );
  }
}

/** Project list for /my-designs (session user) or guest drafts. */
export async function GET(request: Request) {
  try {
    const actor = await getWeddingActor();
    const guestId = request.headers.get('x-wedding-guest-id') || undefined;
    const ownerIds = [
      ...new Set(
        [actor.user?.id, actor.guestOwnerId].filter((id): id is string =>
          Boolean(id)
        )
      ),
    ];
    const groups = await Promise.all([
      ...ownerIds.map((id) => listWeddingProjectsForUser(id)),
      ...(guestId ? [listWeddingProjectsForGuest(guestId)] : []),
    ]);
    const projects = [
      ...new Map(
        groups.flat().map((project) => [project.id, project])
      ).values(),
    ];
    return respData({ projects });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to list projects'
    );
  }
}
