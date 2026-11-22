import {
  tableCropMarks,
  tableLayout,
  type TablePaper,
  type TablePrint,
  type TableSize,
} from '@/shared/wedding/table-number-maker';

export function TablePrintDiagram({
  mode,
  size,
  paper,
}: {
  mode: TablePrint;
  size: TableSize;
  paper: TablePaper;
}) {
  const { width, height, slots } = tableLayout(size, mode, paper);
  const fit = Math.min(84 / width, 38 / height);
  const x = (96 - width * fit) / 2;
  const y = (46 - height * fit) / 2;

  return (
    <svg
      width="96"
      height="46"
      viewBox="0 0 96 46"
      aria-hidden="true"
      focusable="false"
    >
      <g transform={`translate(${x} ${y}) scale(${fit})`}>
        {mode === 'home' && (
          <rect
            width={width}
            height={height}
            fill="#fffdf8"
            stroke="currentColor"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {slots.map((slot, i) => (
          <g key={slot.x}>
            <rect
              x={slot.x}
              y={slot.y}
              width={slot.w}
              height={slot.h}
              fill="#e3d4c2"
              stroke="currentColor"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={slot.x + slot.w / 2}
              y={slot.y + slot.h * 0.55}
              textAnchor="middle"
              fontSize={9 / fit}
              fill="currentColor"
            >
              {i + 1}
            </text>
            {mode === 'home' &&
              tableCropMarks(slot).map(([x1, y1, x2, y2], index) => (
                <line
                  key={index}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="currentColor"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </g>
        ))}
      </g>
    </svg>
  );
}
