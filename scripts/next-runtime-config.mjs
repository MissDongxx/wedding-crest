import { isAbsolute } from 'node:path';

/** Next.js emits route type references relative to the project, not absolute dist paths. */
export function nextRuntimeDistDir(value = '.next') {
  const directory = value || '.next';
  const parts = directory.replace(/^\.\//, '').split('/');
  const protectedRoots = [
    'src',
    'public',
    'content',
    'scripts',
    'node_modules',
    '.git',
  ];
  if (
    isAbsolute(directory) ||
    directory.includes('\\') ||
    parts.some((part) => !part || part === '.' || part === '..') ||
    protectedRoots.includes(parts[0]) ||
    (parts[0] === 'artifacts' && parts.length < 3)
  ) {
    throw new Error(
      'NEXT_DIST_DIR must be a project-relative cache directory, for example .next-qa. Do not use absolute paths, parent paths or source directories.'
    );
  }
  return parts.join('/');
}
