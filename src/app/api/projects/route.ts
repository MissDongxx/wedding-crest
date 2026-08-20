import { z } from 'zod';

import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  createWeddingProject,
  listWeddingProjectsForGuest,
  listWeddingProjectsForUser,
} from '@/shared/models/wedding';
import { selectLayout } from '@/shared/wedding/config';
import {
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
  palette: z.array(hexColor).min(1).max(WEDDING_MAX_PALETTE_COLORS),
  complexity: z.enum(['minimal', 'medium', 'rich']).optional(),
  nameDisplay: z
    .enum([
      'initials_amp',
      'initials_joined',
      'initials_spaced',
      'full_names',
      'surname',
    ])
    .optional(),
  showDate: z.boolean().optional(),
  flowers: z.array(cleanText(60)).max(WEDDING_MAX_FLOWERS).optional(),
  personalElements: z
    .array(cleanText(60))
    .max(WEDDING_MAX_PERSONAL_ELEMENTS)
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
