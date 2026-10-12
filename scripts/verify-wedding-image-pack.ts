import assert from 'node:assert/strict';
import { removeEdgeBackground } from '../src/shared/wedding/image-pack-pixels';
const pixels = new Uint8ClampedArray(5 * 5 * 4).fill(255);
// Dark ring isolates an interior white highlight.
for (const index of [6,7,8,11,13,16,17,18]) { pixels[index * 4] = 40; pixels[index * 4 + 1] = 60; pixels[index * 4 + 2] = 40; }
assert.equal(removeEdgeBackground(pixels, 5, 5), 16);
assert.equal(pixels[3], 0);
assert.equal(pixels[12 * 4 + 3], 255);
assert.equal(pixels[6 * 4 + 3], 255);
const dark = new Uint8ClampedArray([20,20,20,255]);
assert.equal(removeEdgeBackground(dark, 1, 1), 0);
assert.equal(dark[3], 255);
const alpha = new Uint8ClampedArray([0,0,0,0]);
assert.equal(removeEdgeBackground(alpha, 1, 1), 1);
assert.throws(() => removeEdgeBackground(new Uint8ClampedArray(4), 2, 2));
console.log('PASS edge background removed; interior white and colored art preserved; alpha retained; invalid dimensions rejected');
