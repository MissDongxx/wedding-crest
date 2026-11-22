import { getTranslations } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
import {
  defaultMonogram,
  monogramFonts,
  monogramImageUrl,
  renderMonogramSvg,
  type MonogramFont,
} from '@/shared/wedding/monogram-maker';

import styles from './monogram-guide.module.css';
import { MonogramMaker } from './monogram-maker';

const layouts = [
  'paired',
  'ampersand',
  'stacked',
  'diagonal',
  'overlap',
  'surname',
  'circle',
  'diamond',
] as const;

type Layout = (typeof layouts)[number];

const papers: Record<Layout, string> = {
  paired: 'bg-[#f4ecdf] text-[#3d4639]',
  ampersand: 'bg-[#2e443c] text-[#f4e5c9]',
  stacked: 'bg-[#e8e9df] text-[#394b42]',
  diagonal: 'bg-[#f3e5de] text-[#6a4139]',
  overlap: 'bg-[#53383f] text-[#fae7cf]',
  surname: 'bg-[#efe5cf] text-[#695031]',
  circle: 'bg-[#dce6e8] text-[#294b57]',
  diamond: 'bg-[#694a37] text-[#f8ebd1]',
};

function MonogramDiagram({ layout }: { layout: Layout }) {
  const letters = (
    value: string,
    x: number,
    y: number,
    size: number,
    face: MonogramFont | 'serif' = 'pinyon'
  ) => (
    <text
      className={face === 'serif' ? undefined : styles[face]}
      x={x}
      y={y}
      fontSize={size}
      textAnchor="middle"
    >
      {value}
    </text>
  );

  const rule = (d: string, width = 0.75) => (
    <path d={d} fill="none" stroke="currentColor" strokeWidth={width} />
  );

  const artwork: Record<Layout, React.ReactNode> = {
    paired: (
      <>
        {rule('M30 43V24h20m112 0h20v19m0 53v19h-20m-112 0H30V96')}
        {letters('A', 71, 91, 70)}
        {letters('L', 138, 91, 70)}
        <path d="m106 65 2.5 3.5-2.5 3.5-2.5-3.5Z" />
      </>
    ),
    ampersand: (
      <>
        {rule(
          'M69 32c14 0 17-9 37-9s23 9 37 9M69 108c14 0 17 9 37 9s23-9 37-9'
        )}
        {letters('A', 63, 90, 67, 'greatVibes')}
        {letters('&', 104, 83, 31, 'greatVibes')}
        {letters('L', 148, 90, 68, 'greatVibes')}
      </>
    ),
    stacked: (
      <>
        {letters('A', 102, 61, 63)}
        {letters('L', 105, 110, 63)}
      </>
    ),
    diagonal: (
      <>
        {rule('M76 112 136 29', 0.85)}
        {letters('A', 67, 68, 67, 'greatVibes')}
        {letters('L', 138, 106, 70, 'greatVibes')}
      </>
    ),
    overlap: (
      <>
        {letters('A', 93, 86, 103)}
        <text
          className={styles.greatVibes}
          x="117"
          y="98"
          fontSize="98"
          textAnchor="middle"
          paintOrder="stroke fill"
          stroke="#53383f"
          strokeWidth="2.6"
          strokeLinejoin="round"
        >
          L
        </text>
      </>
    ),
    surname: (
      <>
        {rule('M78 27c9-4 19-6 28-6s19 2 28 6m-56 84c9 4 19 6 28 6s19-2 28-6')}
        {letters('A', 35, 82, 31, 'serif')}
        {letters('M', 103, 91, 76, 'greatVibes')}
        {letters('L', 177, 82, 31, 'serif')}
      </>
    ),
    circle: (
      <>
        <circle
          cx="106"
          cy="70"
          r="49"
          fill="none"
          stroke="currentColor"
          strokeWidth=".75"
        />
        <circle
          cx="106"
          cy="70"
          r="44"
          fill="none"
          stroke="currentColor"
          strokeWidth=".65"
        />
        {letters('A', 86, 83, 51)}
        {letters('L', 123, 85, 51)}
        <path d="m106 37 2 3-2 3-2-3Zm0 61 2 3-2 3-2-3Z" />
      </>
    ),
    diamond: (
      <>
        {rule('M106 17 177 70l-71 53-71-53Z', 0.9)}
        {rule('M106 24 167 70l-61 46-61-46Z', 0.6)}
        {letters('AL', 102, 81, 43, 'greatVibes')}
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 212 140"
      className={`block aspect-[212/140] w-full font-serif font-semibold ${papers[layout]}`}
      fill="currentColor"
    >
      {artwork[layout]}
    </svg>
  );
}

function FontSample({ face }: { face: MonogramFont }) {
  const svg = renderMonogramSvg({ ...defaultMonogram, font: face }).replace(
    'viewBox="0 0 360 360" width="360" height="360"',
    'viewBox="10 72 340 216" width="340" height="216"'
  );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={monogramImageUrl(svg)}
      alt=""
      width={340}
      height={216}
      loading="lazy"
      className={`block w-full ${papers.paired}`}
    />
  );
}

export async function MonogramGuide({ locale }: { locale: string }) {
  const t = await getTranslations({
    locale: locale === 'th' ? 'th' : 'en',
    namespace: 'pages.seo.monogram.guide',
  });

  return (
    <div className="mt-12 space-y-12">
      <MonogramMaker copy={t.raw('maker')} />

      <section aria-labelledby="monogram-layouts">
        <h2 id="monogram-layouts" className="scroll-mt-24 font-serif text-2xl">
          {t('layouts')}
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-6">
          {layouts.map((layout) => (
            <figure key={layout} className="min-w-0">
              <div className="overflow-hidden rounded-sm">
                <MonogramDiagram layout={layout} />
              </div>
              <figcaption className="mt-2 text-center text-sm leading-snug text-balance">
                {t(`examples.${layout}`)}
              </figcaption>
            </figure>
          ))}
        </div>
        <section className="mt-9" aria-labelledby="monogram-fonts">
          <h3 id="monogram-fonts" className="scroll-mt-24 font-serif text-xl">
            {t('compare_fonts')}
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4">
            {monogramFonts.map(([face, name]) => (
              <figure key={face} className="min-w-0">
                <div className="overflow-hidden rounded-sm">
                  <FontSample face={face} />
                </div>
                <figcaption className="mt-2 text-center text-sm leading-snug text-balance">
                  {name}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </section>

      <section>
        <h2 className="font-serif text-2xl">{t('comparison.title')}</h2>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          {t.rich('comparison.body', {
            examples: (label) => (
              <Link
                href="/wedding-crest-examples"
                className="underline underline-offset-4"
              >
                {label}
              </Link>
            ),
          })}
        </p>
      </section>

      <section>
        <h2 className="font-serif text-2xl">{t('uses.title')}</h2>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          {(['invitations', 'napkins', 'favors', 'wax'] as const).map((use) => (
            <section key={use}>
              <h3 className="font-medium">{t(`uses.${use}.title`)}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {t(`uses.${use}.body`)}
              </p>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
