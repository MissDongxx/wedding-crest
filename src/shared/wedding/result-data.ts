/** Both job reads and PATCH responses may contain the nested database input. */
export function normalizeWeddingProject<T>(
  project: T & { input?: Partial<T> }
): T {
  const normalized = project.input ? { ...project, ...project.input } : project;
  return {
    ...normalized,
    showLocation:
      (normalized as T & { showLocation?: boolean }).showLocation === true,
  };
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

/** Printed wording can be edited without repainting; scene inspiration cannot. */
export function isWeddingLetteringPatch(
  changes: Record<string, unknown>,
  current: { showLocation?: boolean }
): boolean {
  const fields = Object.keys(changes);
  const nextShowLocation = changes.showLocation ?? current.showLocation;
  return fields.every((field) => {
    if (field === 'showLocation' && changes.showLocation === false) {
      return current.showLocation !== true;
    }
    if (field === 'location' || field === 'venue') {
      return current.showLocation === true && nextShowLocation === true;
    }
    return [
      'partner1',
      'partner2',
      'weddingDate',
      'typography',
      'nameDisplay',
      'showDate',
      'showLocation',
    ].includes(field);
  });
}
