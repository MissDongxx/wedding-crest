import {
  makeSignOrnamentPlate,
  signScenes,
  signTemplates,
  type SignScene,
} from './welcome-sign';
import {
  defaultAppearance,
  nameFontOptions,
  signPalette,
  type SignAppearance,
} from './welcome-sign-customization';

export const welcomeTableHandoff = 'wedding-welcome-table-number-v1';

export type MatchingTableId = `welcome${Capitalize<SignScene['id']>}`;
type MatchingTable = {
  label: string;
  scene: SignScene['id'];
  ink: string;
  paper: string;
};

export const matchingTableTemplates = Object.fromEntries(
  signScenes.map(({ id, name, paper, ink }) => [
    `welcome${id[0].toUpperCase()}${id.slice(1)}`,
    { label: name, scene: id, paper, ink },
  ])
) as Record<MatchingTableId, MatchingTable>;

export type WelcomeMatch = { templateId: string; appearance: SignAppearance };

export function matchingId(scene: string) {
  return (Object.keys(matchingTableTemplates) as MatchingTableId[]).find(
    (id) => matchingTableTemplates[id].scene === scene
  );
}

export function readWelcomeMatch(value: unknown): WelcomeMatch | undefined {
  if (typeof value !== 'object' || !value) return;
  const { templateId, appearance } = value as WelcomeMatch;
  const template = signTemplates.find((item) => item.id === templateId);
  if (!template || !matchingId(template.sceneId) || !appearance) return;
  if (!nameFontOptions.some(({ value }) => value === appearance.nameFont))
    return;
  if (!['template', 'light', 'deep'].includes(appearance.palette)) return;
  return {
    templateId,
    appearance: { nameFont: appearance.nameFont, palette: appearance.palette },
  };
}

export const welcomeEditorHandoff = 'wedding-table-edit-welcome-v1';
export const welcomeEditorPath =
  '/wedding-welcome-sign-maker?edit=table-number';
export const welcomeDraftKey = 'wedding-welcome-sign-draft-v1';

export type WelcomeTableSource = {
  match: WelcomeMatch;
  details: { first: string; second: string; date: string };
  size: '18x24' | '24x36';
};

export function readWelcomeSource(
  value: unknown
): WelcomeTableSource | undefined {
  if (typeof value !== 'object' || !value) return;
  const { match: raw, details, size } = value as WelcomeTableSource;
  const match = readWelcomeMatch(raw);
  if (!match || !details || (size !== '18x24' && size !== '24x36')) return;
  const { first, second, date } = details;
  if (
    typeof first !== 'string' ||
    typeof second !== 'string' ||
    typeof date !== 'string' ||
    (date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(date))
  )
    return;
  return { match, details: { first, second, date }, size };
}

export function matchingSpec(id: string, active?: WelcomeMatch) {
  if (!Object.prototype.hasOwnProperty.call(matchingTableTemplates, id)) return;
  const { scene } = matchingTableTemplates[id as MatchingTableId];
  const template =
    signTemplates.find(
      (item) => item.id === active?.templateId && item.sceneId === scene
    ) ?? signTemplates.find((item) => item.id === scene)!;
  const appearance =
    template.id === active?.templateId ? active.appearance : defaultAppearance;
  return {
    template,
    appearance,
    palette: signPalette(template, appearance.palette),
  };
}

export function matchingKey(
  spec: NonNullable<ReturnType<typeof matchingSpec>>
) {
  return `${spec.template.id}/${spec.appearance.palette}/${spec.appearance.nameFont}`;
}

export type MatchingMaterials = { plate: string; font?: string };
const finished = new Map<string, Promise<MatchingMaterials>>();

const fontFiles: Record<SignScene['id'], readonly [string, string, string]> = {
  chateau: [
    'welcome-reference/alexbrush',
    'cormorant-garamond-common',
    'cormorant-garamond-common',
  ],
  meadow: [
    'welcome-reference/pinyonscript',
    'welcome-reference/mrssaintdelafield',
    'cormorant-garamond-common',
  ],
  editorial: [
    'bodoni-welcome-latin',
    'bodoni-welcome-latin',
    'bodoni-welcome-latin',
  ],
  oriental: [
    'cormorant-garamond-common',
    'welcome-reference/alexbrush',
    'welcome-reference/pinyonscript',
  ],
  chapel: [
    'cinzel-common',
    'welcome-reference/pinyonscript',
    'cormorant-garamond-common',
  ],
  noir: ['cinzel-common', 'cinzel-common', 'cinzel-common'],
  rose: [
    'welcome-reference/mrssaintdelafield',
    'welcome-reference/alexbrush',
    'welcome-reference/pinyonscript',
  ],
  olive: [
    'welcome-reference/ooohbaby',
    'welcome-reference/alexbrush',
    'welcome-reference/pinyonscript',
  ],
  gallery: ['dm-sans-common', 'dm-sans-common', 'libre-baskerville-common'],
  ribbon: [
    'welcome-reference/alexbrush',
    'welcome-reference/pinyonscript',
    'welcome-reference/mrssaintdelafield',
  ],
  coast: [
    'cormorant-garamond-common',
    'welcome-reference/pinyonscript',
    'cormorant-garamond-common',
  ],
  desert: [
    'welcome-reference/ooohbaby',
    'cormorant-garamond-common',
    'welcome-reference/pinyonscript',
  ],
};
const fontCache = new Map<string, Promise<string>>();
function loadMatchingFont(file: string) {
  const cached = fontCache.get(file);
  if (cached) return cached;
  const promise = fetch(`/fonts/wedding/${file}.woff2`)
    .then((result) => {
      if (!result.ok) throw new Error('Matching font unavailable');
      return result.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            typeof reader.result === 'string'
              ? resolve(reader.result)
              : reject(new Error('Bad font data'));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
    )
    .catch((error) => {
      fontCache.delete(file);
      throw error;
    });
  fontCache.set(file, promise);
  return promise;
}

export function loadMatchingMaterials(
  spec: NonNullable<ReturnType<typeof matchingSpec>>
) {
  const key = matchingKey(spec);
  let pending = finished.get(key);
  if (!pending) {
    const { template, appearance } = spec;
    const font =
      appearance.nameFont === 'template'
        ? fontFiles[template.sceneId][template.variation]
        : {
            serif: 'cormorant-garamond-common',
            sans: 'dm-sans-common',
            pinyon: 'welcome-reference/pinyonscript',
          }[appearance.nameFont];
    pending = Promise.all([
      makeSignOrnamentPlate(template, appearance),
      loadMatchingFont(font).catch(() => undefined),
    ])
      .then(([plate, font]) => ({ plate, font }))
      .catch((error) => {
        finished.delete(key);
        throw error;
      });
    finished.set(key, pending);
  }
  return pending;
}
