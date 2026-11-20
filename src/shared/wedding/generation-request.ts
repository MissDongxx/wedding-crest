/** Stable initial-generation reservation ids; ordinary regenerate requests omit the key. */
export async function getWeddingInitialGenerationIds(
  projectId: string,
  requestKey: string,
  candidates: number
): Promise<string[]> {
  if (!/^[0-9a-f-]{36}$/i.test(requestKey))
    throw new Error('invalid generation request id');
  return Promise.all(
    Array.from({ length: candidates }, async (_, index) => {
      const hash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(
          `wedding:initial:${projectId}:${requestKey}:${index}`
        )
      );
      return Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, '0')
      ).join('');
    })
  );
}
