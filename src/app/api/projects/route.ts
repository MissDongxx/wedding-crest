import { z } from 'zod';

import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import { getWeddingExample } from '@/shared/models/wedding';
import {
  createWeddingProject,
  listWeddingProjectsForGuest,
  listWeddingProjectsForUser,
} from '@/shared/models/wedding';
import { getUserInfo } from '@/shared/models/user';
import { selectLayout } from '@/shared/wedding/config';
import {
  WEDDING_MAX_FLOWERS,
  WEDDING_MAX_PALETTE_COLORS,
  WEDDING_MAX_PERSONAL_ELEMENTS,
  isWeddingExampleStyle,
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
  palette: z.array(hexColor).min(1).max(WEDDING_MAX_PALETTE_COLORS),
  complexity: z.enum(['minimal', 'medium', 'rich']).optional(),
  nameDisplay: z
    .enum([
      'initials_amp',
      'initials_joined',
      'initials_spaced',
      'full_names',
      'surname',
      'initials_only',
    ])
    .optional(),
  showDate: z.boolean().optional(),
  flowers: z.array(cleanText(60)).max(WEDDING_MAX_FLOWERS).optional(),
  personalElements: z
    .array(cleanText(60))
    .max(WEDDING_MAX_PERSONAL_ELEMENTS)
    .optional(),
  // Reference photo URLs the user already uploaded. Limited to 2 to keep
  // multimodal generation cost bounded and the prompt focused. Each URL
  // must point to an http(s) resource or a local path the storage service
  // can resolve at generation time.
  personalImages: z
    .array(z.string().trim().min(1).max(2000))
    .max(2)
    .optional(),
  frameId: z.string().trim().min(1).max(80).nullable().optional(),
  // "Same as example" wiring. The client only sends the example id — the
  // server resolves it to the active example's imageUrl and validates the
  // style so the wizard can never get a user-uploaded attacker URL into
  // the prompt. The four flags map to the four wizard steps that surface
  // a "Same as example" option.
  exampleId: z.string().trim().min(1).max(80).optional(),
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
    const body = createSchema.parse(await request.json());
    const user = await getUserInfo();
    const guestId = request.headers.get('x-wedding-guest-id') || getUuid();

    const styleConfig = weddingStyles.find((s) => s.id === body.style);
    if (!styleConfig) return respErr('unknown wedding style');
    const layout = selectLayout(body.style, body.layout);

    // Resolve the example reference image server-side. We deliberately do
    // NOT trust a client-supplied imageUrl: the wizard sends only the id,
    // we look it up and verify the row is active and tagged with one of
    // the known example styles. If anything fails, we silently drop the
    // example wiring and let the project fall back to the regular flow.
    let exampleImage: string | null = null;
    let matchExample:
      | {
          border: boolean;
          palette: boolean;
          flowers: boolean;
          elements: boolean;
        }
      | null = null;
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
      userId: user?.id,
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
      flowers: body.flowers ?? [],
      personalElements: body.personalElements ?? [],
      personalImages: body.personalImages ?? [],
      frameId: body.frameId ?? null,
      exampleImage,
      matchExample,
      status: 'draft',
    });

    return respData({ project, guestId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return respErr('invalid project details: ' + error.issues[0]?.message);
    }
    return respErr(
      error instanceof Error ? error.message : 'failed to create project'
    );
  }
}

/** Project list for /my-designs (session user) or guest drafts. */
export async function GET(request: Request) {
  try {
    const user = await getUserInfo();
    const guestId = request.headers.get('x-wedding-guest-id') || undefined;
    if (!user && !guestId) return respData({ projects: [] });

    const projects = user
      ? await listWeddingProjectsForUser(user.id)
      : await listWeddingProjectsForGuest(guestId!);
    return respData({ projects });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to list projects'
    );
  }
}
