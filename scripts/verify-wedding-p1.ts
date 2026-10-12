import assert from 'node:assert/strict';

import {
  chooseDownloadGeneration,
  normalizeWeddingProject,
} from '../src/shared/wedding/result-data';

const raw = {
  id: 'project',
  palette: '[]' as unknown as string[],
  flowers: undefined as unknown as string[],
  personalElements: undefined as unknown as string[],
  input: { palette: ['#ffffff'], flowers: ['Rose'], personalElements: ['Dog'] },
};
const normalized = normalizeWeddingProject(raw);
assert.deepEqual(normalized.palette, ['#ffffff']);
assert.equal(normalized.flowers.length, 1);
assert.equal(normalized.personalElements.length, 1);
assert.equal(raw.flowers, undefined);
assert.deepEqual(normalizeWeddingProject({ id: 'flat', flowers: [] }), {
  id: 'flat',
  flowers: [],
});
const generations = [
  { id: 'A', status: 'selected', sourceImageUrl: 'a.png' },
  { id: 'B', status: 'complete', sourceImageUrl: 'b.png' },
  { id: 'pending', status: 'generating', sourceImageUrl: null },
];
assert.equal(chooseDownloadGeneration(generations, 'B')?.id, 'B');
assert.equal(chooseDownloadGeneration(generations, null)?.id, 'A');
assert.equal(chooseDownloadGeneration(generations, 'foreign'), undefined);
assert.equal(chooseDownloadGeneration(generations, 'pending'), undefined);
assert.equal(chooseDownloadGeneration(generations, ''), undefined);
console.log(
  'PASS: PATCH normalization and explicit download selection (8 assertions)'
);
