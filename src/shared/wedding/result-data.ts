/** Both job reads and PATCH responses may contain the nested database input. */
export function normalizeWeddingProject<T>(
  project: T & { input?: Partial<T> }
): T {
  return project.input ? { ...project, ...project.input } : project;
}

/** An explicit preview must never silently fall back to a different download. */
export function chooseDownloadGeneration<
  T extends {
    id: string;
    status: string;
    sourceImageUrl: string | null;
  },
>(generations: T[], generationId: string | null): T | undefined {
  const completed = generations.filter(
    (generation) =>
      ['selected', 'complete'].includes(generation.status) &&
      Boolean(generation.sourceImageUrl)
  );
  return generationId !== null
    ? completed.find((generation) => generation.id === generationId)
    : (completed.find((generation) => generation.status === 'selected') ??
        completed[0]);
}
