export const tableNumberPlacementControls = [
  { key: 'scale', label: 'Size', min: 70, max: 115 },
  { key: 'x', label: 'Horizontal position', min: -8, max: 8 },
  { key: 'y', label: 'Vertical position', min: -9, max: 9 },
] as const;

export type TableNumberPlacement = Record<
  (typeof tableNumberPlacementControls)[number]['key'],
  number
>;

export const defaultTableNumberPlacement: TableNumberPlacement = {
  scale: 100,
  x: 0,
  y: 0,
};

export function readTableNumberPlacement(value: unknown): TableNumberPlacement {
  const result = { ...defaultTableNumberPlacement };
  if (!value || typeof value !== 'object') return result;
  const saved = value as Partial<TableNumberPlacement>;
  for (const { key, min, max } of tableNumberPlacementControls) {
    const n = saved[key];
    if (typeof n === 'number' && Number.isFinite(n)) {
      result[key] = Math.max(min, Math.min(max, Math.round(n)));
    }
  }
  return result;
}

// Anchor scaling to the template's original label/number block, then translate
// by a percentage of the whole card, independently of its print dimensions.
export function placeTableNumber(
  artwork: string,
  placement: TableNumberPlacement | undefined,
  width: number,
  height: number,
  anchorX: number,
  anchorY: number
) {
  const { scale, x, y } = placement ?? defaultTableNumberPlacement;
  const s = scale / 100;
  const round = (n: number) => Number(n.toFixed(3));
  const dx = round((width * x) / 100 + (1 - s) * anchorX);
  const dy = round((height * y) / 100 + (1 - s) * anchorY);
  return `<g data-table-number="" transform="matrix(${s} 0 0 ${s} ${dx} ${dy})">${artwork}</g>`;
}
