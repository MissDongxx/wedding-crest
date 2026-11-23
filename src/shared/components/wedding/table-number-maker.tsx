'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpRight } from 'lucide-react';

import {
  editAppliedMonogramPath,
  readAppliedMonogram,
  removeAppliedMonogram,
  type AppliedMonogram,
} from '@/shared/wedding/monogram-application';
import { loadTableAutumnArt } from '@/shared/wedding/table-number-artwork';
import {
  defaultTableTemplate,
  isTableTemplate,
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
import {
  defaultTableNumberPlacement,
  readTableNumberPlacement,
  tableNumberPlacementControls,
} from '@/shared/wedding/table-number-placement';
import { tableNameLimit } from '@/shared/wedding/table-number-text';
import {
  loadMatchingMaterials,
  matchingKey,
  matchingSpec,
  matchingTableTemplates,
  readWelcomeMatch,
  readWelcomeSource,
  welcomeEditorHandoff,
  welcomeEditorPath,
  welcomeTableHandoff,
  type MatchingMaterials,
  type MatchingTableId,
  type WelcomeMatch,
  type WelcomeTableSource,
} from '@/shared/wedding/table-number-welcome-match';
import { formatSignDate } from '@/shared/wedding/welcome-sign';

import styles from './table-number-maker.module.css';
import { TablePrintDiagram } from './table-print-diagram';

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
  const [template, setTemplate] = useState<TableTemplate>(defaultTableTemplate);
  const [size, setSize] = useState<TableSize>('4x6');
  const [mode, setMode] = useState<TablePrint>('home');
  const [paper, setPaper] = useState<TablePaper>('letter');
  const [names, setNames] = useState('');
  const [date, setDate] = useState('');
  const [numberPlacement, setNumberPlacement] = useState(
    defaultTableNumberPlacement
  );
  const [numberLayoutOpen, setNumberLayoutOpen] = useState(false);
  const [ink, setInk] = useState<string>();
  const [applied, setApplied] = useState<AppliedMonogram>();
  const [monogram, setMonogram] = useState<TableMonogram>();
  const [autumnArtwork, setAutumnArtwork] = useState<string>();
  const [preview, setPreview] = useState<'first' | 'last'>('first');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [editError, setEditError] = useState(false);
  const [welcomeMatch, setWelcomeMatch] = useState<WelcomeMatch>();
  const [matchingOpen, setMatchingOpen] = useState(false);
  const [welcomeSource, setWelcomeSource] = useState<WelcomeTableSource>();
  const [ready, setReady] = useState(false);
  const [matchArt, setMatchArt] = useState<Record<string, MatchingMaterials>>(
    {}
  );

  useEffect(() => {
    let mounted = true;
    void loadTableAutumnArt()
      .then((artwork) => {
        if (mounted) setAutumnArtwork(artwork);
      })
      .catch(() => {});
    let previousSource: WelcomeTableSource | undefined;
    try {
      const draft = sessionStorage.getItem(tableDraftKey);
      if (draft) {
        const saved = JSON.parse(draft);
        setNumberPlacement(readTableNumberPlacement(saved?.numberPlacement));
        previousSource = readWelcomeSource(saved?.welcomeSource);
        setWelcomeSource(previousSource);
        setWelcomeMatch(readWelcomeMatch(saved?.welcomeMatch));
        if (
          typeof saved?.countInput === 'string' &&
          /^\d{0,3}$/.test(saved.countInput)
        )
          setCountInput(saved.countInput);
        if (isTableTemplate(saved?.template)) {
          setTemplate(saved.template);
          setMatchingOpen(Boolean(matchingSpec(saved.template)));
        }
        if (saved?.size === '4x6' || saved?.size === '5x7') setSize(saved.size);
        if (saved?.mode === 'home' || saved?.mode === 'shop')
          setMode(saved.mode);
        if (saved?.paper === 'letter' || saved?.paper === 'a4')
          setPaper(saved.paper);
        if (typeof saved?.names === 'string') setNames(saved.names);
        if (typeof saved?.date === 'string') setDate(saved.date.slice(0, 40));
        if (typeof saved?.ink === 'string' && tableInk(saved.ink))
          setInk(saved.ink);
        if (saved?.preview === 'first' || saved?.preview === 'last')
          setPreview(saved.preview);
      }
    } catch {}

    try {
      const payload = sessionStorage.getItem(welcomeTableHandoff);
      if (payload) {
        sessionStorage.removeItem(welcomeTableHandoff);
        const {
          source: rawSource,
          returning,
          match: raw,
          names,
          date,
        } = JSON.parse(payload);
        const source = readWelcomeSource(rawSource);
        const match = source?.match ?? readWelcomeMatch(raw);
        const id =
          match &&
          (Object.keys(matchingTableTemplates) as MatchingTableId[]).find(
            (key) => matchingSpec(key, match)?.template.id === match.templateId
          );
        if (match && id) {
          setWelcomeMatch(match);
          setWelcomeSource(source);
          setMatchingOpen(true);
          setTemplate(id);
          if (
            !returning ||
            !previousSource ||
            previousSource.match.templateId !== match.templateId ||
            previousSource.match.appearance.palette !== match.appearance.palette
          )
            setInk(undefined);
          if (source) {
            const { first, second, date } = source.details;
            if (
              !returning ||
              first !== previousSource?.details.first ||
              second !== previousSource?.details.second
            )
              setNames(
                [first.trim(), second.trim()].filter(Boolean).join(' & ')
              );
            if (!returning || date !== previousSource?.details.date)
              setDate(date ? formatSignDate(date) : '');
          } else {
            setNames(typeof names === 'string' ? names : '');
            setDate(typeof date === 'string' ? formatSignDate(date) : '');
          }
        }
      }
    } catch {}

    try {
      const handoff = readTableMonogram(
        sessionStorage.getItem(tableNumberHandoff)
      );
      const libraryDesign = readAppliedMonogram('table-number');
      setApplied(libraryDesign);
      if (handoff || libraryDesign) {
        setMonogram(libraryDesign ? undefined : handoff);
        measure('table_number_monogram_applied', { source: 'monogram_maker' });
      }
    } catch {}
    const linked = new URLSearchParams(window.location.search).get('style');
    if (isTableTemplate(linked)) {
      setTemplate(linked);
      setMatchingOpen(Boolean(matchingSpec(linked)));
      setInk(undefined);
    }
    setReady(true);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    for (const id of matchingOpen
      ? Object.keys(matchingTableTemplates)
      : [template]) {
      const spec = matchingSpec(id, welcomeMatch);
      if (!spec) continue;
      const key = matchingKey(spec);
      void loadMatchingMaterials(spec)
        .then((art) => {
          if (active) setMatchArt((current) => ({ ...current, [key]: art }));
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [matchingOpen, template, welcomeMatch]);

  const matching = matchingSpec(template, welcomeMatch);
  const count = Number(countInput);
  const valid =
    Number.isInteger(count) && count >= 1 && count <= tableCountLimit;
  const previewCount = valid ? count : 20;
  const design = {
    template,
    ink:
      ink ??
      matching?.palette.ink ??
      monogram?.ink ??
      tableTemplates[template].ink,
    names,
    date,
    monogram,
    monogramPng: applied?.png,
    numberPlacement,
    autumnArtwork,
    welcomeMatch,
    matchingMaterials: matching && matchArt[matchingKey(matching)],
  };
  const layout = tableLayout(size, mode, paper);
  const sheetCount = Math.ceil(previewCount / layout.slots.length);
  const firstOnSheet =
    preview === 'first' ? 1 : 1 + (sheetCount - 1) * layout.slots.length;
  const shown = layout.slots.filter(
    (_, index) => firstOnSheet + index <= previewCount
  );

  const draftJson = JSON.stringify({
    countInput,
    template,
    welcomeMatch,
    welcomeSource,
    size,
    mode,
    paper,
    names,
    date,
    ink,
    numberPlacement,
    preview,
  });

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(tableDraftKey, draftJson);
    } catch {}
  }, [ready, draftJson]);

  function saveDraft() {
    try {
      sessionStorage.setItem(tableDraftKey, draftJson);
    } catch {}
  }

  function editWelcome(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!welcomeSource) return;
    setEditError(false);
    try {
      sessionStorage.setItem(tableDraftKey, draftJson);
      sessionStorage.setItem(
        welcomeEditorHandoff,
        JSON.stringify(welcomeSource)
      );
    } catch {
      event.preventDefault();
      setEditError(true);
    }
  }

  function removeMonogram() {
    setMonogram(undefined);
    setApplied(undefined);
    try {
      removeAppliedMonogram('table-number');
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
      has_monogram: monogram || applied ? 'yes' : 'no',
    };
    try {
      const { exportTableNumbers } = await import(
        '@/shared/wedding/table-number-export'
      );
      const printArtwork =
        template === 'autumn' && !autumnArtwork
          ? await loadTableAutumnArt().catch(() => undefined)
          : autumnArtwork;
      const url = URL.createObjectURL(
        await exportTableNumbers({
          count,
          design: {
            ...design,
            autumnArtwork: printArtwork,
            matchingMaterials: matching
              ? await loadMatchingMaterials(matching)
              : undefined,
          },
          mode,
          size,
          paper,
        })
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
        disabled={!ready || busy || !valid}
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

  const renderTemplate = (key: TableTemplate) => {
    const spec = matchingSpec(key, welcomeMatch);
    return (
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
            ink: spec?.palette.ink ?? tableTemplates[key].ink,
            welcomeMatch,
            matchingMaterials: spec && matchArt[matchingKey(spec)],
            names: '',
            date: '',
            autumnArtwork,
          }}
          size="4x6"
          number={1}
          label=""
        />
        <span>{tableTemplates[key].label}</span>
      </label>
    );
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <h1>Wedding Table Number Maker</h1>
        <div id="table-number-editor" className={`${styles.editor} scroll-mt-20`}>
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
                  {(Object.keys(tableTemplates) as TableTemplate[])
                    .filter((key) => !matchingSpec(key))
                    .map(renderTemplate)}
                </div>
                <button
                  type="button"
                  className={styles.matchingToggle}
                  aria-expanded={matchingOpen}
                  aria-controls="welcome-table-templates"
                  onClick={() => setMatchingOpen(!matchingOpen)}
                >
                  Matching welcome signs
                </button>
                <div id="welcome-table-templates" hidden={!matchingOpen}>
                  {matchingOpen && (
                    <div className={styles.templates}>
                      {(
                        Object.keys(matchingTableTemplates) as MatchingTableId[]
                      ).map(renderTemplate)}
                    </div>
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
                        aria-labelledby={`table-print-label-${value}`}
                        aria-describedby={`table-print-detail-${value}`}
                        checked={mode === value}
                        onChange={() => setMode(value)}
                      />
                      <TablePrintDiagram
                        mode={value}
                        size={size}
                        paper={paper}
                      />
                      <strong id={`table-print-label-${value}`}>
                        {value === 'home' ? 'Home printing' : 'Print shop'}
                      </strong>
                      <span
                        id={`table-print-detail-${value}`}
                        className={styles.printDetail}
                      >
                        {value === 'home'
                          ? '2 cards per sheet · Cut marks'
                          : '1 card per PDF page · No cut marks'}
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

              <details
                className={styles.personalize}
                onToggle={(event) => setNumberLayoutOpen(event.currentTarget.open)}
              >
                <summary>Table number layout</summary>
                <div className={styles.numberLayout}>
                  {numberLayoutOpen && (
                    <div className={styles.numberLayoutProof}>
                      <Card
                        design={design}
                        size={size}
                        number={firstOnSheet}
                        label={`Table ${firstOnSheet} layout preview`}
                      />
                    </div>
                  )}
                  {tableNumberPlacementControls.map(
                    ({ key, label, min, max }) => (
                      <label key={key}>
                        <span>
                          {label}
                          <span aria-hidden="true">
                            {numberPlacement[key]}%
                          </span>
                        </span>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          value={numberPlacement[key]}
                          aria-label={label}
                          aria-valuetext={`${numberPlacement[key]}%`}
                          onChange={(event) => {
                            const value = event.currentTarget.valueAsNumber;
                            setNumberPlacement((current) => ({
                              ...current,
                              [key]: value,
                            }));
                          }}
                        />
                      </label>
                    )
                  )}
                  <button
                    type="button"
                    disabled={tableNumberPlacementControls.every(
                      ({ key }) =>
                        numberPlacement[key] ===
                        defaultTableNumberPlacement[key]
                    )}
                    onClick={() =>
                      setNumberPlacement(defaultTableNumberPlacement)
                    }
                  >
                    Reset layout
                  </button>
                </div>
              </details>

              <details className={styles.personalize}>
                <summary>Personalize</summary>
                <div className={styles.personalFields}>
                  <label>
                    Names
                    <input
                      type="text"
                      value={names}
                      maxLength={tableNameLimit}
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
                  {!monogram && !applied && (
                    <Link
                      href="/wedding-monogram-maker#monogram-maker"
                      onClick={saveDraft}
                    >
                      Add monogram <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </details>
              {welcomeSource && (
                <div className={styles.applied}>
                  <span>Matched welcome sign</span>
                  <div className={styles.appliedActions}>
                    <Link href={welcomeEditorPath} onClick={editWelcome}>
                      Edit welcome sign
                    </Link>
                  </div>
                </div>
              )}
              {editError && (
                <p role="alert" className={styles.error}>
                  The welcome sign editor didn’t open. Try again.
                </p>
              )}
              {(monogram || applied) && (
                <div className={styles.applied}>
                  <span>Monogram applied</span>
                  <div className={styles.appliedActions}>
                    {(applied || monogram?.editable) && (
                      <Link
                        href={applied ? editAppliedMonogramPath('table-number', applied) : tableNumberMonogramEditPath}
                        onClick={saveDraft}
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
        <section className={styles.printGuide} aria-labelledby="table-number-print-guide">
          <h2 id="table-number-print-guide">How to print and place table numbers</h2>
          <h3>Arrange tables 1 to 20</h3>
          <p>
            Leave Tables set to 20 for a complete set. Home printing lays the
            numbers out two per landscape sheet (1 and 2, 3 and 4, through 19
            and 20); Print shop exports one card per page. On your floor plan,
            number tables from the entrance in a consistent order so guests can
            find them without doubling back.
          </p>
          <h3>Print double-sided cards</h3>
          <p>
            The PDF has single-sided artwork. For home printing, print two
            copies at Actual Size (100%), cut them and put each matching pair
            back-to-back in a holder. For true duplex printing, ask a print shop
            to put the same number on both sides of each card and check that
            both sides are upright on a proof.
          </p>
          <h3>Trim along the crop marks</h3>
          <p>
            Choose Letter or A4 to match the paper in your printer and turn off
            Fit to Page. Use the short lines outside each corner to line up a
            ruler or paper trimmer. The Print shop file is already sized to
            4 × 6 or 5 × 7 in and has no crop marks; ask the shop if it needs
            a bleed version.
          </p>
          <h3>Choose paper for your holders</h3>
          <p>
            Use matte cardstock to reduce glare under reception lights. Pick a
            weight your printer supports and test one sheet first, especially
            if the design has a dark background. A freestanding holder may need
            stiffer stock than a frame or clip.
          </p>
          <h3>Table numbers are not a seating chart</h3>
          <p>
            The seating chart at the entrance tells guests which table they’re
            assigned to. A number card identifies the table in the room. Use
            the same numbers on both and face the cards toward the aisle.
          </p>
        </section>
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
