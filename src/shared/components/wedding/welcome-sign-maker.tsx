'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Check, Download } from 'lucide-react';

import {
  drawSign, loadSignResources, sampleDetails, signGroups, signScenes, signSizes, signTemplates,
  type SignDetails, type SignScene, type SignSize, type SignTemplate,
} from '@/shared/wedding/welcome-sign';
import {
  defaultAppearance, nameFontOptions, signPalette, signPaletteOptions,
  type NameFont, type SignAppearance, type SignPaletteId,
} from '@/shared/wedding/welcome-sign-customization';
import {
  editAppliedMonogramPath,
  readAppliedMonogram,
  removeAppliedMonogram,
  type AppliedMonogram,
} from '@/shared/wedding/monogram-application';
import { sceneImageAlt, signImageRoot, templateImageAlt } from '@/shared/wedding/welcome-sign-images';
import { readWelcomeSource, welcomeDraftKey, welcomeEditorHandoff, welcomeTableHandoff, type WelcomeTableSource } from '@/shared/wedding/table-number-welcome-match';
import styles from './welcome-sign-maker.module.css';

const scenesWithTemplates = signScenes.map((scene) => ({
  scene,
  templates: signTemplates.filter((item) => item.sceneId === scene.id),
}));


const scenePrintNotes = {
  chateau:
    'A hand-drawn blue border and chandelier suit a château courtyard or historic estate; pair the ivory ground with dusty-blue linens. Print at 24 × 36 in on matte poster paper at a print shop and mount it on a rigid board for the entrance easel.',
  meadow:
    'An oval watercolor wildflower wreath feels at home in a garden or meadow; pick up its soft greens and flower colors in bud vases or napkins. Print at 18 × 24 in on matte poster paper for a sheltered easel beside the ceremony path.',
  editorial:
    'A newspaper masthead and bold serif headlines suit a city loft or stone gallery; pair the warm paper tone and charcoal type with black frames. Ask a print shop for a 24 × 36 in matte poster so the headline reads across a lobby.',
  oriental:
    'A gold floral crown and Double Happiness seal suit a Chinese wedding banquet entrance; pair the red and gold with ivory flowers or warm lighting. Print at 24 × 36 in on matte board through a print shop to keep the dark red readable under spotlights.',
  chapel:
    'An initial crest and fine double border suit a chapel entry; echo the sage and cream with greenery and ivory ribbons. A framed 18 × 24 in matte poster fits a small vestibule without crowding the doorway.',
  noir:
    'Gold-toned Art Deco corner rays on black suit a candlelit ballroom; pair them with champagne linens or brass accents. Order a 24 × 36 in matte board for the foyer so overhead lights don’t reflect off the sign.',
  rose:
    'Diagonal rose clusters and flowing script suit a rose garden or conservatory; carry the dusty pink and ivory into the flowers or table linens. Print at 18 × 24 in on matte poster paper for a framed sign at the cocktail-hour entrance.',
  olive:
    'A tall watercolor olive branch suits a vineyard, olive grove or villa terrace; pair olive green with cream and natural linen. Print at 24 × 36 in on rigid matte board for a courtyard easel, and secure it if the spot is breezy.',
  gallery:
    'A sweeping lowercase welcome and black type on white suit a modern gallery or civil ceremony; pair them with white florals and black frames. Print at 18 × 24 in on smooth matte poster paper for a slim frame at the check-in table.',
  ribbon:
    'Pink stripes, a red bow and a floral border suit a restaurant reception or a room with velvet drapes; pair them with wine-red candles and cream linens. A 24 × 36 in matte poster from a print shop works well on an easel against the drapery.',
  coast:
    'A blue-and-ivory floral toile border suits a seaside terrace or coastal inn; repeat the blue with white linens and natural textures. Ask a print shop for a 24 × 36 in print mounted on rigid board for a covered terrace entrance.',
  desert:
    'A cream arch and handwritten names suit a desert ranch or adobe courtyard; pair terracotta and sand with rust-colored florals. Print at 24 × 36 in on matte board and secure it to a weighted easel near the outdoor entrance.',
} satisfies Record<SignScene['id'], string>;

function Preview({template, details, size, appearance, monogram}: {
  template: SignTemplate; details: SignDetails; size: SignSize; appearance: SignAppearance; monogram?: HTMLImageElement;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, height] = signSizes[size];
  useEffect(() => {
    let active = true;
    const paint = () => {
      const ctx = canvas.current?.getContext('2d', {alpha: false});
      if (active && ctx) drawSign(ctx, template, details, size, 960, 0, appearance, monogram);
    };
    // Paint immediately for typing; repaint once the bundled fonts and art are ready.
    paint();
    void loadSignResources(template).then(paint, paint);
    return () => { active = false; };
  }, [template, details, size, appearance, monogram]);
  return <canvas
    ref={canvas}
    width={960}
    height={960 * height / width}
    style={{backgroundColor: signPalette(template, appearance.palette).paper}}
    role="img"
    aria-label={`${template.name} wedding welcome sign for ${details.first} and ${details.second}, ${details.date}`}
  />;
}

export function WelcomeSignMaker() {
  const [sceneId, setSceneId] = useState<SignScene['id']>(signScenes[0].id);
  const [selections, setSelections] = useState<Partial<Record<SignScene['id'], string>>>({});
  const options = scenesWithTemplates.find(({scene}) => scene.id === sceneId)!.templates;
  const template = options.find((item) => item.id === selections[sceneId]) ?? options[0];
  const [templateAppearance, setTemplateAppearance] = useState<Partial<Record<string, SignAppearance>>>({});
  const appearance = templateAppearance[template.id] ?? defaultAppearance;
  const palette = signPalette(template, appearance.palette);
  const editor = useRef<HTMLDivElement>(null);
  const [group, setGroup] = useState<(typeof signGroups)[number]>('All');
  const [size, setSize] = useState<SignSize>('18x24');
  const [details, setDetails] = useState<SignDetails>({first: '', second: '', date: ''});
  const [busy, setBusy] = useState<'pdf' | 'png'>();
  const [status, setStatus] = useState('');
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const [ready, setReady] = useState(false);
  const [applied, setApplied] = useState<AppliedMonogram>();
  const [monogram, setMonogram] = useState<HTMLImageElement>();
  const [returningToTables, setReturningToTables] = useState(false);
  useEffect(() => {
    const entry = new URLSearchParams(window.location.search);
    const returning = entry.get('edit') === 'table-number';
    try {
      const incoming = returning && sessionStorage.getItem(welcomeEditorHandoff);
      const saved = readWelcomeSource(JSON.parse(incoming || sessionStorage.getItem(welcomeDraftKey) || 'null'));
      if (returning) sessionStorage.removeItem(welcomeEditorHandoff);
      if (saved) {
        const design = signTemplates.find(({id}) => id === saved.match.templateId);
        if (design) {
          setSceneId(design.sceneId);
          setSelections({[design.sceneId]: design.id});
          setTemplateAppearance({[design.id]: saved.match.appearance});
          setDetails(saved.details);
          setSize(saved.size);
        }
      }
    } catch {}
    const linked = !returning && signTemplates.find(({id}) => id === entry.get('style'));
    if (linked) {
      setSceneId(linked.sceneId);
      setSelections((current) => ({...current, [linked.sceneId]: linked.id}));
    }
    setApplied(readAppliedMonogram('welcome-sign'));
    setReturningToTables(returning);
    setReady(true);
  }, []);
  useEffect(() => {
    if (!applied) return;
    let active = true;
    const mark = new Image();
    mark.src = applied.png;
    void mark.decode().then(() => {
      if (active) setMonogram(mark);
    }).catch(() => {
      if (!active) return;
      setError(true);
      setStatus('The monogram didn’t load. Reapply it or remove it to continue.');
    });
    return () => { active = false; };
  }, [applied]);

  function removeMonogram() {
    try { removeAppliedMonogram('welcome-sign'); } catch {}
    setApplied(undefined);
    setMonogram(undefined);
    setError(false);
    setStatus('');
  }

  useEffect(() => {
    if (!ready) return;
    const source: WelcomeTableSource = {match: {templateId: template.id, appearance}, details, size};
    try { sessionStorage.setItem(welcomeDraftKey, JSON.stringify(source)); } catch {}
  }, [ready, template.id, appearance, details, size]);
  const [width, height] = signSizes[size];
  const shown = signScenes.filter((item) => group === 'All' || item.group === group);
  const preview = {
    first: details.first.trim() || sampleDetails.first,
    second: details.second.trim() || sampleDetails.second,
    date: details.date || sampleDetails.date,
  };
  const valid = details.first.trim() && details.second.trim() && details.date;
  const change = (key: keyof SignDetails, value: string) => {
    setDetails((current) => ({...current, [key]: value}));
    setStatus('');
    setError(false);
  };

  function chooseTemplate(item: SignTemplate, jumpToEditor = false) {
    setSceneId(item.sceneId);
    setSelections((current) => ({...current, [item.sceneId]: item.id}));
    if (jumpToEditor) {
      setGroup('All');
      editor.current?.scrollIntoView({block: 'start'});
      editor.current?.focus({preventScroll: true});
    }
    setStatus('');
    setError(false);
  }

  function changeAppearance(change: Partial<SignAppearance>) {
    setTemplateAppearance((current) => ({
      ...current,
      [template.id]: {...(current[template.id] ?? defaultAppearance), ...change},
    }));
    setStatus('');
    setError(false);
  }

  function openMatchingTables() {
    try {
      const source: WelcomeTableSource = { match: { templateId: template.id, appearance }, details, size };
      sessionStorage.setItem(welcomeDraftKey, JSON.stringify(source));
      sessionStorage.setItem(welcomeTableHandoff, JSON.stringify({ source, returning: returningToTables }));
      window.location.assign('/table-number-maker');
    } catch {
      setError(true);
      setStatus('The table number editor didn’t open. Try again.');
    }
  }

  async function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || lock.current || (applied && !monogram)) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const format = submitter?.value === 'png' ? 'png' : 'pdf';
    lock.current = true;
    setBusy(format);
    setError(false);
    setStatus(`Preparing ${format.toUpperCase()}…`);
    try {
      const {exportWelcomeSign} = await import('@/shared/wedding/welcome-sign-export');
      const blob = await exportWelcomeSign(template, preview, size, format, appearance, monogram);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wedding-welcome-sign-${template.id}-${size}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus(`${format.toUpperCase()} ready.`);
    } catch {
      setError(true);
      setStatus('Download failed. Please try again.');
    } finally {
      lock.current = false;
      setBusy(undefined);
    }
  }

  return <main className={styles.root}>
    <div className={styles.heading}><h1>Wedding Welcome Sign Maker</h1></div>
    <div id="welcome-sign-editor" className={styles.studio} ref={editor} tabIndex={-1} aria-label="Welcome sign editor">
      <aside className={styles.library} aria-label="Scenes">
        <h2>Scenes</h2>
        <div className={styles.filters} role="group" aria-label="Scene style">
          {signGroups.map((item) => <button type="button" key={item} aria-pressed={group === item} onClick={() => setGroup(item)}>{item}</button>)}
        </div>
        <div className={styles.templates}>
          {shown.map((item) => {
            const designs = scenesWithTemplates.find(({scene}) => scene.id === item.id)!.templates;
            const mockup = designs.find((design) => design.id === selections[item.id]) ?? designs[0];
            return <button type="button" key={item.id} aria-label={item.name} aria-pressed={item.id === sceneId} onClick={() => setSceneId(item.id)} className={styles.template}>
              <span className={styles.photo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${signImageRoot}/${mockup.id}.webp`} width={440} height={590} alt={sceneImageAlt(mockup)} loading={item === signScenes[0] ? 'eager' : 'lazy'} />
                {item.id === sceneId && <span className={styles.selected}><Check size={13} aria-hidden="true" /></span>}
              </span>
              <span>{item.name}</span>
            </button>;
          })}
        </div>
      </aside>
      <section className={styles.workspace} aria-label="Sign preview">
        <div className={styles.workspaceToolbar}><h2>Templates</h2><span>{width} × {height} in</span></div>
        <div className={styles.variants} role="group" aria-label="Templates for this scene">
          {options.map((item) => (
            <button type="button" key={item.id} aria-label={item.name} aria-pressed={item.id === template.id} onClick={() => chooseTemplate(item)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${signImageRoot}/cards/${item.id}.webp`} width={180} height={270} alt={templateImageAlt(item)} />
              <span>{item.name}</span>
            </button>
          ))}
        </div>
        <div className={styles.stage}>
          <div className={styles.art} style={{'--sign-ratio': width / height} as React.CSSProperties}>
            <Preview template={template} details={preview} size={size} appearance={appearance} monogram={monogram} />
          </div>
        </div>
      </section>
      <form className={styles.control} onSubmit={download} aria-label="Personalize and download">
        <h2>Personalize</h2>
        <label>First name<input required value={details.first} placeholder={sampleDetails.first} maxLength={100} onChange={(event) => change('first', event.target.value)} /></label>
        <label>Second name<input required value={details.second} placeholder={sampleDetails.second} maxLength={100} onChange={(event) => change('second', event.target.value)} /></label>
        <label>Wedding date<input type="date" required min="1900-01-01" max="2199-12-31" value={details.date} onChange={(event) => change('date', event.target.value)} /></label>
        <label>Name font
          <select value={appearance.nameFont} onChange={(event) => changeAppearance({nameFont: event.target.value as NameFont})}>
            {nameFontOptions.map(({value, label}) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span className={styles.paletteLabel}>Color palette
            <span className={styles.swatches} aria-hidden="true">
              {[palette.paper, palette.ink, palette.accent].map((color, index) => <i key={index} style={{background: color}} />)}
            </span>
          </span>
          <select value={appearance.palette} onChange={(event) => changeAppearance({palette: event.target.value as SignPaletteId})}>
            {signPaletteOptions(template).map(({id, label}) => <option value={id} key={id}>{label}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>Print size</legend>
          <div className={styles.sizes}>
            {(Object.keys(signSizes) as SignSize[]).map((key) => <label key={key}>
              <input type="radio" name="size" value={key} checked={size === key} onChange={() => { setSize(key); setStatus(''); }} />
              <span>{signSizes[key].join(' × ')} in</span>
            </label>)}
          </div>
        </fieldset>
        {applied && (
          <div className={styles.applied}>
            <span>{monogram ? 'Monogram applied' : 'Monogram'}</span>
            <div>
              <Link href={editAppliedMonogramPath('welcome-sign', applied)}>Edit monogram</Link>
              <button type="button" onClick={removeMonogram} disabled={!!busy}>Remove</button>
            </div>
          </div>
        )}
        <div className={styles.downloads}>
          <button type="submit" value="pdf" disabled={!!busy || !!(applied && !monogram)}><Download size={16} aria-hidden="true" /> Download PDF</button>
          <button type="submit" value="png" disabled={!!busy || !!(applied && !monogram)}><Download size={16} aria-hidden="true" /> Download PNG</button>
        </div>
          <button type="button" className={styles.matchLink} onClick={openMatchingTables} disabled={!ready || !!busy}>
            {returningToTables ? 'Apply to table numbers' : 'Make matching table numbers'}
          </button>
        <p className={error ? styles.error : styles.status} role="status">{status}</p>
      </form>
    </div>
    <section className={styles.fullGallery} aria-labelledby="welcome-sign-templates">
      <h2 id="welcome-sign-templates">Wedding welcome sign templates</h2>
      <div className={styles.galleryGrid}>
        {scenesWithTemplates.map(({scene, templates}) => (
          <section key={scene.id}>
            <h3>{scene.name}</h3>
            <div className={styles.galleryCards}>
              {templates.map((item) => (
                <button type="button" key={item.id} aria-label={`Edit ${item.name}`} onClick={() => chooseTemplate(item, true)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${signImageRoot}/cards/${item.id}.webp`} width={180} height={270} alt={templateImageAlt(item)} loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
            <p className={styles.scenePrintNote}>{scenePrintNotes[scene.id]}</p>
          </section>
        ))}
      </div>
    </section>
    <section className={styles.stationeryGuide} aria-labelledby="matching-wedding-stationery">
      <h2 id="matching-wedding-stationery">Match your welcome sign, seating chart and table numbers</h2>
      <p>
        Carry one accent color, one typeface and a small motif from the welcome sign
        onto the seating chart and table numbers. In the editor, choose
        {' '}<strong>Make matching table numbers</strong> to carry your sign design over;
        use the same table numbers on your seating chart and keep guest names and
        numbers in a high-contrast, easy-to-read font.
      </p>
    </section>
  </main>;
}
