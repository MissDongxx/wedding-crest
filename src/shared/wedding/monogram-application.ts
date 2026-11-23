const targets = {
  'table-number': ['/table-number-maker', '#table-number-editor'],
  'welcome-sign': ['/wedding-welcome-sign-maker', '#welcome-sign-editor'],
} as const;

export type MonogramTarget = keyof typeof targets;

export type AppliedMonogram = {
  png: string;
  editor: {
    style: string;
    letters: string[];
    font?: string;
    layout?: string;
    paint: { ink?: string; paper?: string; ornament?: string };
  };
};

const key = (target: MonogramTarget) => `wedding-library-monogram-${target}-v1`;
const validColor = (value: unknown) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : undefined;

export const isMonogramTarget = (
  value: string | null
): value is MonogramTarget =>
  value === 'table-number' || value === 'welcome-sign';

export function readAppliedMonogram(
  target: MonogramTarget
): AppliedMonogram | undefined {
  try {
    const data = JSON.parse(sessionStorage.getItem(key(target)) || 'null');
    if (
      typeof data?.png !== 'string' ||
      data.png.length > 2_500_000 ||
      !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(
        data.png
      ) ||
      typeof data.editor?.style !== 'string' ||
      !/^\d{2}-\d{2}$/.test(data.editor.style) ||
      !Array.isArray(data.editor.letters) ||
      data.editor.letters.length > 2 ||
      !data.editor.letters.every(
        (letter: unknown) => typeof letter === 'string' && letter.length <= 4
      )
    )
      return;
    const { style, letters, font, layout, paint } = data.editor;
    return {
      png: data.png,
      editor: {
        style,
        letters,
        font: typeof font === 'string' ? font : undefined,
        layout: typeof layout === 'string' ? layout : undefined,
        paint: {
          ink: validColor(paint?.ink),
          paper: validColor(paint?.paper),
          ornament: validColor(paint?.ornament),
        },
      },
    };
  } catch {}
}

export function openMonogramTarget(
  target: MonogramTarget,
  design: AppliedMonogram
) {
  const [path, anchor] = targets[target];
  if (design.png.length > 2_500_000)
    throw new Error('Monogram artwork exceeds draft limit');
  sessionStorage.setItem(key(target), JSON.stringify(design));
  window.location.assign(path + anchor);
}

export function removeAppliedMonogram(target: MonogramTarget) {
  sessionStorage.removeItem(key(target));
}

export function editAppliedMonogramPath(
  target: MonogramTarget,
  design: AppliedMonogram
) {
  return `/wedding-monogram-maker?style=${design.editor.style}&from=${target}#monogram-maker`;
}
