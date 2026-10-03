import { hasStepUpDraftWithPrefix } from '../identity-authority/step-up-mfa/step-up-draft';
import { stepUpDraftScopePrefix } from './content-schema-registry-step-up-scope';

/**
 * Lazy loader of the registry command enhancement (FE03 Performance, AC261:
 * detail/editor modules are split). The enhancement owns the mutation
 * transport, the outcome renderers and the step-up draft restore, none of
 * which a person needs before they touch a form, so the protected island
 * loads it on first intent instead of in the route's initial JavaScript.
 *
 * Nothing about the forms changes while it loads: they are native forms. The
 * chunk starts loading when a person focuses or presses a registry form, or
 * at once when a step-up draft is waiting to be restored. A submit that
 * arrives before the chunk is ready is held, the chunk loads, and the same
 * submit (same submitter) is then re-issued so the real handler processes it
 * exactly as it would have.
 */
const FORM_SELECTOR = '[data-cms-command-form]';

export interface LazyCommandEnhancement {
  readonly dispose: () => void;
  readonly loaded: () => boolean;
}

export const installLazyCommandEnhancement = (
  document: Document,
): LazyCommandEnhancement => {
  const windowObject = document.defaultView;
  type Enhancement = typeof import('./content-schema-registry-runtime-dom');
  let cleanup: (() => void) | null = null;
  let loading: Promise<Enhancement> | null = null;
  let disposed = false;

  const load = (): Promise<Enhancement> => {
    loading ??= import('./content-schema-registry-runtime-dom').then(
      (module) => {
        if (!disposed)
          cleanup =
            module.installContentSchemaRegistryCommandEnhancement(document);
        return module;
      },
    );
    return loading;
  };

  const registryForm = (target: EventTarget | null): HTMLFormElement | null =>
    target instanceof Element
      ? target.closest<HTMLFormElement>(FORM_SELECTOR)
      : null;

  const onIntent = (event: Event): void => {
    if (registryForm(event.target) !== null) void load();
  };
  const onSubmit = (event: SubmitEvent): void => {
    const form = registryForm(event.target);
    if (form === null || cleanup !== null) return;
    // Hold this submit until the enhancement owns the form, then replay it.
    event.preventDefault();
    event.stopImmediatePropagation();
    void load().then(() => {
      if (disposed) return;
      if (event.submitter === null) form.requestSubmit();
      else form.requestSubmit(event.submitter);
    });
  };

  // A field left before the chunk is ready still gets its blur feedback: once
  // the enhancement owns the form it evaluates that field. After it is loaded
  // it listens for blur itself.
  const onBlur = (event: Event): void => {
    const field = event.target;
    if (registryForm(field) === null || cleanup !== null) return;
    void load().then((module) => {
      if (!disposed) module.checkRegistryField(field);
    });
  };

  document.addEventListener('focusin', onIntent);
  document.addEventListener('focusout', onBlur);
  document.addEventListener('pointerdown', onIntent);
  document.addEventListener('submit', onSubmit, true);

  // A draft saved before the step-up detour is restored on arrival, so the
  // enhancement must be ready without waiting for intent.
  const pathname = windowObject?.location.pathname ?? '';
  let storage: Storage | null = null;
  try {
    storage = windowObject?.sessionStorage ?? null;
  } catch {
    storage = null;
  }
  if (
    document.querySelector(FORM_SELECTOR) !== null &&
    hasStepUpDraftWithPrefix(storage, stepUpDraftScopePrefix(pathname))
  )
    void load();

  return {
    loaded: () => cleanup !== null,
    dispose: () => {
      disposed = true;
      document.removeEventListener('focusin', onIntent);
      document.removeEventListener('focusout', onBlur);
      document.removeEventListener('pointerdown', onIntent);
      document.removeEventListener('submit', onSubmit, true);
      cleanup?.();
      cleanup = null;
    },
  };
};
