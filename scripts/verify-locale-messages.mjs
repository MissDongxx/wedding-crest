import fs from 'node:fs';
import path from 'node:path';
const root = 'src/config/locale/messages';
const locales = ['zh', 'de', 'it', 'fr', 'ko', 'pt-BR', 'th'];
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.json') ? [path.join(dir, e.name)] : []);
}
function leaves(data, prefix = '') {
  return Object.fromEntries(Object.entries(data).flatMap(([key, value]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(leaves(value, name)) : [[name, value]];
  }));
}
const failures = [];
const refs = files(`${root}/en`);
for (const locale of locales) for (const reference of refs) {
  const relative = path.relative(`${root}/en`, reference);
  const target = path.join(root, locale, relative);
  if (!fs.existsSync(target)) { failures.push(`${locale}/${relative}: missing file`); continue; }
  const source = leaves(JSON.parse(fs.readFileSync(reference, 'utf8')));
  const translated = leaves(JSON.parse(fs.readFileSync(target, 'utf8')));
  for (const [key, value] of Object.entries(source)) {
    if (!(key in translated)) { failures.push(`${locale}/${relative}:${key}: missing`); continue; }
    if (typeof value !== typeof translated[key] || Array.isArray(value) !== Array.isArray(translated[key])) failures.push(`${locale}/${relative}:${key}: type mismatch`);
    if (typeof value === 'string' && typeof translated[key] === 'string') {
      const parameters = text => [...new Set([...text.matchAll(/\{(\w+)(?:[,}])/g)].map(m => m[1]))].sort().join(',');
      if (parameters(value) !== parameters(translated[key])) failures.push(`${locale}/${relative}:${key}: parameter mismatch`);
    }
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`PASS: ${locales.length + 1} locales, ${refs.length} namespaces; no missing keys, type mismatches, or named-parameter mismatches`);
