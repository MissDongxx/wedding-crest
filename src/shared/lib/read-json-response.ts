/** Read API envelopes without exposing HTML error pages as JSON parser errors. */
export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('expected an API object');
    }
    return body as T;
  } catch {
    throw new Error(
      `Request failed (HTTP ${response.status}): the server returned an invalid API response. Please retry. If this persists, restart the development server.`
    );
  }
}
