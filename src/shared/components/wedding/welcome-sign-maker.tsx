'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Download } from 'lucide-react';

import {
  drawSign, loadSignResources, sampleDetails, signGroups, signScenes, signSizes, signTemplates,
  type SignDetails, type SignScene, type SignSize, type SignTemplate,
} from '@/shared/wedding/welcome-sign';
import {
  defaultAppearance, nameFontOptions, signPalette, signPaletteOptions,
  type NameFont, type SignAppearance, type SignPaletteId,
} from '@/shared/wedding/welcome-sign-customization';
import { sceneImageAlt, signImageRoot, templateImageAlt } from '@/shared/wedding/welcome-sign-images';
import { readWelcomeSource, welcomeDraftKey, welcomeEditorHandoff, welcomeTableHandoff, type WelcomeTableSource } from '@/shared/wedding/table-number-welcome-match';
import styles from './welcome-sign-maker.module.css';

const scenesWithTemplates = signScenes.map((scene) => ({
  scene,
  templates: signTemplates.filter((item) => item.sceneId === scene.id),
}));

function Preview({template, details, size, appearance}: {
  template: SignTemplate; details: SignDetails; size: SignSize; appearance: SignAppearance;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, height] = signSizes[size];
  useEffect(() => {
    let active = true;
    const paint = () => {
      const ctx = canvas.current?.getContext('2d', {alpha: false});
      if (active && ctx) drawSign(ctx, template, details, size, 960, 0, appearance);
    };
    // Paint immediately for typing; repaint once the bundled fonts and art are ready.
    paint();
    void loadSignResources(template).then(paint, paint);
    return () => { active = false; };
  }, [template, details, size, appearance]);
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
  const [returningToTables, setReturningToTables] = useState(false);
  useEffect(() => {
    const returning = new URLSearchParams(window.location.search).get('edit') === 'table-number';
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
    setReturningToTables(returning);
    setReady(true);
  }, []);
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
    if (!valid || lock.current) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const format = submitter?.value === 'png' ? 'png' : 'pdf';
    lock.current = true;
    setBusy(format);
    setError(false);
    setStatus(`Preparing ${format.toUpperCase()}…`);
    try {
      const {exportWelcomeSign} = await import('@/shared/wedding/welcome-sign-export');
      const blob = await exportWelcomeSign(template, preview, size, format, appearance);
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
    <div className={styles.studio} ref={editor} tabIndex={-1} aria-label="Welcome sign editor">
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
            <Preview template={template} details={preview} size={size} appearance={appearance} />
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
        <div className={styles.downloads}>
          <button type="submit" value="pdf" disabled={!!busy}><Download size={16} aria-hidden="true" /> Download PDF</button>
          <button type="submit" value="png" disabled={!!busy}><Download size={16} aria-hidden="true" /> Download PNG</button>
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
          </section>
        ))}
      </div>
    </section>
  </main>;
}
