/** Remove only near-white background connected to an image edge.
 * Interior whites (flowers, lettering and highlights) are preserved. Existing
 * alpha is retained. This is deterministic background removal, not new AI art.
 */
export function removeEdgeBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
) {
  const count = width * height;
  if (pixels.length !== count * 4 || width < 1 || height < 1)
    throw new Error('Invalid artwork dimensions');
  const visited = new Uint8Array(count);
  const queue = new Uint32Array(count);
  let tail = 0;
  const enqueue = (index: number) => {
    if (visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    const r = pixels[offset],
      g = pixels[offset + 1],
      b = pixels[offset + 2];
    if (
      pixels[offset + 3] === 0 ||
      (Math.min(r, g, b) >= 235 && Math.max(r, g, b) - Math.min(r, g, b) <= 18)
    )
      queue[tail++] = index;
  };
  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  for (let head = 0; head < tail; head++) {
    const index = queue[head];
    pixels[index * 4 + 3] = 0;
    if (index % width) enqueue(index - 1);
    if (index % width < width - 1) enqueue(index + 1);
    if (index >= width) enqueue(index - width);
    if (index < count - width) enqueue(index + width);
  }
  return tail;
}
