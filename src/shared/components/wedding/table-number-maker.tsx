'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpRight } from 'lucide-react';

import {
  readTableMonogram,
  svgImage,
  tableCardSvg,
  tableCountLimit,
  tableCropMarks,
  tableInk,
  tableLayout,
  tableNumberHandoff,
  tableNumberMonogramEditPath,
  tableSizes,
  tableTemplates,
  type TableDesign,
  type TableMonogram,
  type TablePaper,
  type TablePrint,
  type TableSize,
  type TableTemplate,
} from '@/shared/wedding/table-number-maker';

import styles from './table-number-maker.module.css';

const tableDraftKey = 'wedding-table-number-draft-v1';

function measure(action: string, fields: Record<string, string | number>) {
  try {
    (window as Window & { gtag?: (...values: unknown[]) => void }).gtag?.(
      'event',
      action,
      fields
    );
  } catch {}
}

function Card({
  design,
  size,
  number,
  label,
}: {
  design: TableDesign;
  size: TableSize;
  number: number;
  label: string;
}) {
  const [width, height] = tableSizes[size];
  // This is client-generated SVG artwork, not an image-optimizer URL.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={styles.card}
      src={svgImage(tableCardSvg(design, size, number))}
      alt={label}
      width={width}
      height={height}
    />
  );
}

export function TableNumberMaker() {
  const [countInput, setCountInput] = useState('20');
  const [template, setTemplate] = useState<TableTemplate>('classic');
  const [size, setSize] = useState<TableSize>('4x6');
  const [mode, setMode] = useState<TablePrint>('home');
  const [paper, setPaper] = useState<TablePaper>('letter');
  const [names, setNames] = useState('');
  const [date, setDate] = useState('');
  const [ink, setInk] = useState<string>();
  const [monogram, setMonogram] = useState<TableMonogram>();
  const [preview, setPreview] = useState<'first' | 'last'>('first');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(tableDraftKey);
      if (draft) {
        sessionStorage.removeItem(tableDraftKey);
        const saved = JSON.parse(draft);
        if (
          typeof saved?.countInput === 'string' &&
          /^\d{0,3}$/.test(saved.countInput)
        )
          setCountInput(saved.countInput);
        if (
          saved?.template === 'classic' ||
          saved?.template === 'botanical' ||
          saved?.template === 'crest'
        )
          setTemplate(saved.template);
        if (saved?.size === '4x6' || saved?.size === '5x7') setSize(saved.size);
        if (saved?.mode === 'home' || saved?.mode === 'shop')
          setMode(saved.mode);
        if (saved?.paper === 'letter' || saved?.paper === 'a4')
          setPaper(saved.paper);
        if (typeof saved?.names === 'string')
          setNames(saved.names.slice(0, 52));
        if (typeof saved?.date === 'string') setDate(saved.date.slice(0, 40));
        if (typeof saved?.ink === 'string' && tableInk(saved.ink))
          setInk(saved.ink);
        if (saved?.preview === 'first' || saved?.preview === 'last')
          setPreview(saved.preview);
      }
    } catch {}

    try {
      const handoff = readTableMonogram(
        sessionStorage.getItem(tableNumberHandoff)
      );
      if (handoff) {
        setMonogram(handoff);
        measure('table_number_monogram_applied', { source: 'monogram_maker' });
      }
    } catch {}
  }, []);

  const count = Number(countInput);
  const valid =
    Number.isInteger(count) && count >= 1 && count <= tableCountLimit;
  const previewCount = valid ? count : 20;
  const design = {
    template,
    ink: ink ?? monogram?.ink ?? tableTemplates[template].ink,
    names,
    date,
    monogram,
  };
  const layout = tableLayout(size, mode, paper);
  const sheetCount = Math.ceil(previewCount / layout.slots.length);
  const firstOnSheet =
    preview === 'first' ? 1 : 1 + (sheetCount - 1) * layout.slots.length;
  const shown = layout.slots.filter(
    (_, index) => firstOnSheet + index <= previewCount
  );

  function saveDraft(preserveInk = false) {
    try {
      sessionStorage.setItem(
        tableDraftKey,
        JSON.stringify({
          countInput,
          template,
          size,
          mode,
          paper,
          names,
          date,
          ink: preserveInk ? ink : undefined,
          preview,
        })
      );
    } catch {}
  }

  function removeMonogram() {
    setMonogram(undefined);
    try {
      sessionStorage.removeItem(tableNumberHandoff);
    } catch {}
  }

  async function download(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !valid) return;
    setBusy(true);
    setError(false);
    const metrics = {
      print_mode: mode,
      card_size: size,
      table_count: count,
      has_monogram: monogram ? 'yes' : 'no',
    };
    try {
      const { exportTableNumbers } = await import(
        '@/shared/wedding/table-number-export'
      );
      const url = URL.createObjectURL(
        await exportTableNumbers({ count, design, mode, size, paper })
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `wedding-table-numbers-1-${count}-${size}-${mode === 'home' ? paper : 'print-shop'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      measure('table_number_pdf_ready', metrics);
    } catch {
      setError(true);
      measure('table_number_pdf_error', metrics);
    } finally {
      setBusy(false);
    }
  }

  const downloadAction = (
    <>
      <button
        className={styles.download}
        type="submit"
        form="table-number-controls"
        disabled={busy || !valid}
      >
        <ArrowDownToLine size={17} aria-hidden="true" />
        {busy ? 'Preparing PDF…' : 'Download PDF'}
      </button>
      {mode === 'home' && (
        <p className={styles.printNote}>Print at 100% (Actual size).</p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          PDF generation failed. Try downloading again.
        </p>
      )}
    </>
  );

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <h1>Wedding Table Number Maker</h1>
        <div className={styles.editor}>
          <div className={styles.proof}>
            <div className={styles.proofBar}>
              <span aria-live="polite">
                {sheetCount} {sheetCount === 1 ? 'page' : 'pages'}
              </span>
              {sheetCount > 1 && (
                <div
                  className={styles.switch}
                  role="group"
                  aria-label="Preview page"
                >
                  <button
                    type="button"
                    aria-pressed={preview === 'first'}
                    onClick={() => setPreview('first')}
                  >
                    First
                  </button>
                  <button
                    type="button"
                    aria-pressed={preview === 'last'}
                    onClick={() => setPreview('last')}
                  >
                    Last
                  </button>
                </div>
              )}
            </div>
            <div className={styles.stage} data-print-mode={mode}>
              {mode === 'home' ? (
                <svg
                  className={styles.sheet}
                  viewBox={`0 0 ${layout.width} ${layout.height}`}
                  role="img"
                  aria-label={`Print preview: Tables ${shown.map((_, i) => firstOnSheet + i).join(' and ')}`}
                >
                  <rect
                    width={layout.width}
                    height={layout.height}
                    fill="#fff"
                  />
                  {shown.map((slot, i) => (
                    <g key={i}>
                      <image
                        href={svgImage(
                          tableCardSvg(design, size, firstOnSheet + i)
                        )}
                        width={slot.w}
                        height={slot.h}
                        x={slot.x}
                        y={slot.y}
                      />
                      {tableCropMarks(slot).map(([x1, y1, x2, y2], j) => (
                        <line
                          key={j}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="#454141"
                          strokeWidth=".6"
                        />
                      ))}
                    </g>
                  ))}
                </svg>
              ) : (
                <Card
                  design={design}
                  size={size}
                  number={firstOnSheet}
                  label={`Table ${firstOnSheet} print preview`}
                />
              )}
            </div>
          </div>
          <div className={styles.mobileAction}>{downloadAction}</div>
          <form
            id="table-number-controls"
            className={styles.controls}
            onSubmit={download}
            aria-label="Customize table numbers"
          >
            <fieldset className={styles.fields} disabled={busy}>
              <label className={styles.count}>
                <span>Tables</span>
                <input
                  type="number"
                  min="1"
                  max={tableCountLimit}
                  step="1"
                  required
                  aria-invalid={!valid}
                  aria-describedby={!valid ? 'table-count-error' : undefined}
                  value={countInput}
                  onChange={(event) => setCountInput(event.currentTarget.value)}
                />
              </label>
              {!valid && (
                <p id="table-count-error" className={styles.error}>
                  Enter 1–{tableCountLimit} tables.
                </p>
              )}

              <fieldset className={styles.choiceSet}>
                <legend>Template</legend>
                <div className={styles.templates}>
                  {(Object.keys(tableTemplates) as TableTemplate[]).map(
                    (key) => (
                      <label key={key}>
                        <input
                          type="radio"
                          name="table-template"
                          value={key}
                          checked={template === key}
                          onChange={() => setTemplate(key)}
                        />
                        <Card
                          design={{
                            template: key,
                            ink: tableTemplates[key].ink,
                            names: '',
                            date: '',
                          }}
                          size="4x6"
                          number={1}
                          label=""
                        />
                        <span>{tableTemplates[key].label}</span>
                      </label>
                    )
                  )}
                </div>
              </fieldset>

              <fieldset className={styles.choiceSet}>
                <legend>Print format</legend>
                <div className={styles.printMode}>
                  {(['home', 'shop'] as const).map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="table-print-mode"
                        checked={mode === value}
                        onChange={() => setMode(value)}
                      />
                      <span>
                        {value === 'home' ? 'Home printing' : 'Print shop'}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className={styles.sizes}>
                <div>
                  <label htmlFor="table-card-size">Card size</label>
                  <select
                    id="table-card-size"
                    value={size}
                    onChange={(event) =>
                      setSize(event.currentTarget.value as TableSize)
                    }
                  >
                    <option value="4x6">4 × 6 in</option>
                    <option value="5x7">5 × 7 in</option>
                  </select>
                </div>
                {mode === 'home' && (
                  <div>
                    <label htmlFor="table-print-paper">Paper</label>
                    <select
                      id="table-print-paper"
                      value={paper}
                      onChange={(event) =>
                        setPaper(event.currentTarget.value as TablePaper)
                      }
                    >
                      <option value="letter">US Letter</option>
                      <option value="a4">A4</option>
                    </select>
                  </div>
                )}
              </div>

              <details className={styles.personalize}>
                <summary>Personalize</summary>
                <div className={styles.personalFields}>
                  <label>
                    Names
                    <input
                      type="text"
                      value={names}
                      maxLength={52}
                      onChange={(e) => setNames(e.currentTarget.value)}
                    />
                  </label>
                  <label>
                    Date
                    <input
                      type="text"
                      value={date}
                      maxLength={40}
                      onChange={(e) => setDate(e.currentTarget.value)}
                    />
                  </label>
                  <label className={styles.ink}>
                    Ink color
                    <input
                      type="color"
                      value={design.ink}
                      onChange={(e) => setInk(e.currentTarget.value)}
                    />
                  </label>
                  {!monogram && (
                    <Link
                      href="/wedding-monogram-maker#monogram-maker"
                      onClick={() => saveDraft()}
                    >
                      Add monogram <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </details>
              {monogram && (
                <div className={styles.applied}>
                  <span>Monogram applied</span>
                  <div className={styles.appliedActions}>
                    {monogram.editable && (
                      <Link
                        href={tableNumberMonogramEditPath}
                        onClick={() => saveDraft(true)}
                      >
                        Edit monogram
                      </Link>
                    )}
                    <button type="button" onClick={removeMonogram}>
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </fieldset>
            <div className={styles.desktopAction}>{downloadAction}</div>
          </form>
        </div>
        <nav
          className={styles.related}
          aria-label="More wedding stationery tools"
        >
          <Link href="/wedding-monogram-maker">
            Wedding Monogram Maker <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/wedding-welcome-sign-maker">
            Wedding Welcome Sign Maker{' '}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </main>
  );
}
