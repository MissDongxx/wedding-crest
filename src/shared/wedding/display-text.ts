import type { WeddingNameDisplay, WeddingProjectInput } from './types';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatWeddingDate(value?: string | null): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const [, year, month, day] = match;
  const monthName = MONTHS[parseInt(month, 10) - 1] ?? '';
  if (!monthName) return value;
  return `${monthName} ${parseInt(day, 10)}, ${year}`;
}

function initialsOf(input: WeddingProjectInput): string[] {
  const letters = (input.initials ?? [])
    .map((letter) => letter.trim().charAt(0).toUpperCase())
    .filter(Boolean);
  if (letters.length > 0) return letters.slice(0, 2);
  return [
    input.partner1?.trim().charAt(0).toUpperCase() || 'A',
    input.partner2?.trim().charAt(0).toUpperCase() || 'B',
  ];
}

function surnameOf(input: WeddingProjectInput): string {
  const parts = (partner: string) =>
    partner.trim().split(/\s+/).filter(Boolean);
  const partner2 = parts(input.partner2 ?? '');
  const partner1 = parts(input.partner1 ?? '');
  return partner2.length > 1
    ? partner2[partner2.length - 1]
    : partner1.length > 1
      ? partner1[partner1.length - 1]
      : '';
}

export interface WeddingDisplayTexts {
  headline: string;
  names: string;
  date: string;
}

export function resolveWeddingDisplayTexts(
  input: WeddingProjectInput
): WeddingDisplayTexts {
  const [firstInitial, secondInitial] = initialsOf(input);
  const partner1 = (input.partner1 ?? '').trim();
  const partner2 = (input.partner2 ?? '').trim();
  const bothNamesTyped = Boolean(partner1 && partner2);
  const fullNames = `${partner1} & ${partner2}`;
  const display: WeddingNameDisplay = input.nameDisplay || 'initials_amp';
  let headline = '';
  // Default: a single-line monogram. The names line only renders when the
  // user explicitly chose "initials + full names below" AND typed both
  // partner names. The no-example lettering section also relies on this:
  // empty `names` -> the names line simply does not appear in the prompt.
  let names = '';

  switch (display) {
    case 'initials_joined':
      headline = `${firstInitial}${secondInitial}`;
      break;
    case 'initials_spaced':
      headline = `${firstInitial} ${secondInitial}`;
      break;
    case 'initials_with_names':
      headline = `${firstInitial} & ${secondInitial}`;
      names = bothNamesTyped ? fullNames : '';
      break;
    case 'initials_only':
      headline = `${firstInitial} ${secondInitial}`;
      break;
    case 'full_names':
      headline = fullNames;
      break;
    case 'surname': {
      const surname = surnameOf(input);
      headline = surname
        ? `The ${surname}s`
        : `${firstInitial} & ${secondInitial}`;
      break;
    }
    case 'initials_amp':
    default:
      headline = `${firstInitial} & ${secondInitial}`;
      break;
  }

  return {
    headline,
    names,
    date: input.showDate === false ? '' : formatWeddingDate(input.weddingDate),
  };
}
