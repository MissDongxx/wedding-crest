export const tableNameLimit = 203;

// A Unicode character is never split in the middle of a surrogate pair.
export function tableNameLines(value: string) {
  const text = value.trim().replace(/\s+/gu, ' ');
  if (!text) return [];
  if (Array.from(text).length <= 32) return [text];
  const couple = text.split(/\s+(?=&\s)/u);
  if (
    couple.length === 2 &&
    couple.every((part) => Array.from(part).length <= 48)
  )
    return couple;
  const characters = Array.from(text);
  const rows = Math.min(4, Math.ceil(characters.length / 37));
  const result: string[] = [];
  const remaining = [...characters];
  for (let i = rows; i > 1; i--) {
    const target = Math.ceil(remaining.length / i);
    const first = Math.max(1, target - 9);
    const last = Math.min(remaining.length - 1, target + 9);
    let cut = target;
    for (let step = 0; step <= 9; step++) {
      const left = target - step;
      const right = target + step;
      if (left >= first && remaining[left] === ' ') {
        cut = left;
        break;
      }
      if (right <= last && remaining[right] === ' ') {
        cut = right;
        break;
      }
    }
    result.push(remaining.splice(0, cut).join('').trim());
  }
  return [...result, remaining.join('').trim()].filter(Boolean);
}
