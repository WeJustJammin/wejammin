import {
  CONTENT_SCHEMA_REGISTRY_LOADING_DELAY_MS,
  executeContentSchemaRegistryMutation,
} from './content-schema-registry-runtime';
import { completeContentSchemaRegistryMutation } from './content-schema-registry-runtime-dom-mutation-complete';
import {
  announce,
  focusWithoutScroll,
  setFormBusy,
} from './content-schema-registry-runtime-dom-feedback';
import { renderConflict } from './content-schema-registry-runtime-dom-renderers';
import { restoreStepUpDraft } from './content-schema-registry-step-up-draft';

const RESTORED_NOTICE =
  'Verification complete. Review and confirm to continue.';

/**
 * After a step-up detour the interrupted form returns with its draft: the human
 * re-confirms, nothing is submitted for them, and a version that moved while
 * they verified opens the sync conflict instead of silently overwriting.
 */
const restoreAfterStepUp = (
  form: HTMLFormElement,
  windowObject: Window,
  navigate?: (target: string) => void,
): void => {
  const restored = restoreStepUpDraft(form, windowObject);
  if (restored === null) return;
  if (
    restored.draftVersion !== null &&
    restored.currentVersion !== null &&
    restored.draftVersion !== restored.currentVersion
  ) {
    const conflict = renderConflict(
      form,
      { serverVersion: restored.currentVersion },
      windowObject,
      navigate,
      restored.draftVersion,
    );
    focusWithoutScroll(conflict.querySelector('h3') ?? conflict);
    return;
  }
  announce(form, RESTORED_NOTICE);
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit !== null) focusWithoutScroll(submit);
};

/** Progressive enhancement for native forms; no-JS remains fully usable. */
export const installContentSchemaRegistryCommandEnhancement = (
  document: Document,
  options: {
    readonly navigate?: (target: string) => void;
  } = {},
): (() => void) => {
  const windowObject = document.defaultView;
  if (windowObject === null) return () => undefined;
  const forms = [
    ...document.querySelectorAll<HTMLFormElement>('[data-cms-command-form]'),
  ];
  const timers = new Set<number>();
  for (const form of forms)
    restoreAfterStepUp(form, windowObject, options.navigate);
  const listeners = forms.map((form) => {
    const listener = (event: SubmitEvent): void => {
      event.preventDefault();
      if (form.getAttribute('aria-busy') === 'true') return;
      const operationId = form.dataset.operationId ?? 'unknown';
      const formData = new FormData(form);
      setFormBusy(form, true, true);
      const loadingTimer = windowObject.setTimeout(
        () => announce(form, 'Checking the current schema…'),
        CONTENT_SCHEMA_REGISTRY_LOADING_DELAY_MS,
      );
      timers.add(loadingTimer);
      void executeContentSchemaRegistryMutation({
        action: form.action,
        operationId,
        formData,
      }).then((result) => {
        windowObject.clearTimeout(loadingTimer);
        timers.delete(loadingTimer);
        completeContentSchemaRegistryMutation(
          form,
          result,
          windowObject,
          timers,
          options.navigate,
        );
      });
    };
    form.addEventListener('submit', listener);
    return { form, listener };
  });
  return () => {
    for (const timer of timers) {
      windowObject.clearTimeout(timer);
      windowObject.clearInterval(timer);
    }
    for (const { form, listener } of listeners)
      form.removeEventListener('submit', listener);
  };
};
