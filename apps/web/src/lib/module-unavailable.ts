/**
 * A failed fetch of a lazily loaded chunk (a stale tab after a deploy, a dropped connection) must
 * reach the person as the failure it is, with the form still usable and the next action free to
 * try again; it must never leave a command pending or be remembered as the answer. Every dynamic
 * import of the CMS surfaces that happens on an action (a send, a save, a refetch) goes through
 * `importModule`; the caller catches `ModuleUnavailableError` and reports it in the state its
 * surface already has for "nothing was sent" (FE03: a failed pre-send step keeps the person's
 * input and offers the action again; the repo's own pattern is `validators_unavailable` in
 * `cms-workflow-command-transport.ts`).
 */
export class ModuleUnavailableError extends Error {
  constructor(readonly reason: unknown) {
    super('module_unavailable');
    this.name = 'ModuleUnavailableError';
  }
}

export const isModuleUnavailable = (
  error: unknown,
): error is ModuleUnavailableError => error instanceof ModuleUnavailableError;

/** The fixed sentence for a step that could not load before anything was sent. */
export const MODULE_UNAVAILABLE_COPY =
  'Part of this page could not be loaded, so nothing was sent. Check your connection and try again.';

/**
 * Runs an import. A rejection becomes `ModuleUnavailableError`; nothing is cached here, so the
 * next call imports again (an importer that is called again is a retry).
 */
export const importModule = async <T>(
  importer: () => Promise<T>,
): Promise<T> => {
  try {
    return await importer();
  } catch (reason) {
    throw new ModuleUnavailableError(reason);
  }
};
