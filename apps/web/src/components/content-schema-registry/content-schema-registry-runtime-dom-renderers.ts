import type {
  ContentSchemaRegistryLocaleIssue,
  ContentSchemaRegistryMutationResult,
} from './content-schema-registry-runtime';
import {
  issueControlTarget,
  localeControlId,
  pathFromPointer,
} from './content-schema-registry-locale-config';
import {
  announce,
  clearDynamicFeedback,
  focusWithoutScroll,
  sameOriginLocation,
  setFormBusy,
} from './content-schema-registry-runtime-dom-feedback';

const fieldNameFromPointer = (pointer: string): string | null => {
  const name = pointer.split('/').filter(Boolean).at(-1);
  return name === undefined || !/^[A-Za-z][A-Za-z0-9_-]{0,127}$/u.test(name)
    ? null
    : name;
};

const appendLocaleIssues = (
  form: HTMLFormElement,
  list: HTMLElement,
  issues: readonly ContentSchemaRegistryLocaleIssue[],
  summaryId: string,
): void => {
  for (const issue of issues) {
    const path = pathFromPointer(issue.pointer);
    const id = localeControlId(form.id, issueControlTarget(path));
    const element = form.ownerDocument.getElementById(id);
    const item = form.ownerDocument.createElement('li');
    const text = `${path.join(' / ')}: ${issue.message}`;
    if (element !== null && !id.endsWith('-locale-summary')) {
      element.setAttribute('aria-invalid', 'true');
      const describedBy = new Set(
        (element.getAttribute('aria-describedby') ?? '')
          .split(' ')
          .filter(Boolean),
      );
      describedBy.add(summaryId);
      element.setAttribute('aria-describedby', [...describedBy].join(' '));
      const link = form.ownerDocument.createElement('a');
      link.href = `#${id}`;
      link.textContent = text;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        element.focus();
      });
      item.appendChild(link);
    } else item.textContent = text;
    list.appendChild(item);
  }
};

export const renderValidationSummary = (
  form: HTMLFormElement,
  pointers: readonly string[],
  localeIssues: readonly ContentSchemaRegistryLocaleIssue[] = [],
): HTMLElement => {
  const summary = form.ownerDocument.createElement('section');
  summary.id = `${form.id}-validation-summary`;
  summary.tabIndex = -1;
  summary.dataset.cmsValidationSummary = 'true';
  summary.className = 'content-schema-registry-command-error';
  summary.setAttribute('role', 'alert');
  summary.setAttribute('aria-live', 'assertive');
  summary.setAttribute('aria-labelledby', `${form.id}-validation-heading`);
  const heading = form.ownerDocument.createElement('h3');
  heading.id = `${form.id}-validation-heading`;
  heading.textContent = 'Review the highlighted schema fields';
  summary.appendChild(heading);
  const list = form.ownerDocument.createElement('ul');
  const localePointers = new Set(localeIssues.map((issue) => issue.pointer));
  const names = pointers
    .filter((pointer) => !localePointers.has(pointer))
    .map(fieldNameFromPointer)
    .filter((name): name is string => name !== null);
  for (const name of names) {
    const field = form.elements.namedItem(name);
    const element = field instanceof HTMLElement ? field : null;
    const id = element?.id ?? null;
    if (element !== null) {
      element.setAttribute('aria-invalid', 'true');
      if (id !== null) {
        const describedBy = new Set(
          (element.getAttribute('aria-describedby') ?? '')
            .split(' ')
            .filter(Boolean),
        );
        describedBy.add(summary.id);
        element.setAttribute('aria-describedby', [...describedBy].join(' '));
      }
    }
    const item = form.ownerDocument.createElement('li');
    if (id !== null) {
      const link = form.ownerDocument.createElement('a');
      link.href = `#${id}`;
      link.textContent = `Review ${name}`;
      item.appendChild(link);
    } else item.textContent = `Review ${name}`;
    list.appendChild(item);
  }
  appendLocaleIssues(form, list, localeIssues, summary.id);
  if (names.length === 0 && localeIssues.length === 0) {
    const item = form.ownerDocument.createElement('li');
    item.textContent = 'Review the submitted schema values.';
    list.appendChild(item);
  }
  summary.appendChild(list);
  form.insertBefore(summary, form.firstChild);
  return summary;
};

export const renderCapabilityGate = (form: HTMLFormElement): HTMLElement => {
  const gate = form.ownerDocument.createElement('section');
  gate.dataset.cmsCapabilityGate = 'true';
  gate.className = 'content-schema-registry-capability-gate';
  gate.setAttribute('role', 'status');
  gate.setAttribute('aria-live', 'polite');
  const heading = form.ownerDocument.createElement('h3');
  heading.tabIndex = -1;
  heading.textContent = 'Schema changes unavailable';
  const copy = form.ownerDocument.createElement('p');
  copy.textContent = 'A server capability prerequisite is not satisfied.';
  const reason = form.ownerDocument.createElement('p');
  reason.textContent = 'Reason: FORBIDDEN';
  gate.appendChild(heading);
  gate.appendChild(copy);
  gate.appendChild(reason);
  form.insertBefore(gate, form.firstChild);
  return gate;
};

const localVersion = (form: HTMLFormElement): string =>
  (
    form.elements.namedItem('if-match') as HTMLInputElement | null
  )?.value.replace(/^"|"$/gu, '') || 'unknown';

export const renderConflict = (
  form: HTMLFormElement,
  result: Pick<ContentSchemaRegistryMutationResult, 'serverVersion'>,
  windowObject: Window,
  navigate: (target: string) => void = (target) =>
    windowObject.location.assign(target),
  /** The version the preserved draft was made at, when the form's own differs. */
  draftVersion?: string,
): HTMLElement => {
  const conflict = form.ownerDocument.createElement('section');
  conflict.id = `${form.id}-conflict`;
  conflict.dataset.cmsSyncConflict = 'true';
  conflict.className = 'content-schema-registry-sync-conflict';
  conflict.setAttribute('role', 'alert');
  conflict.setAttribute('aria-labelledby', `${form.id}-conflict-heading`);
  const heading = form.ownerDocument.createElement('h3');
  heading.id = `${form.id}-conflict-heading`;
  heading.tabIndex = -1;
  heading.textContent = 'Review the current registry version';
  const localeForm = form.querySelector('[data-locale-fields]') !== null;
  const copy = form.ownerDocument.createElement('p');
  copy.textContent = localeForm
    ? 'This version changed while you were editing. Review the current version, then reapply your languages.'
    : 'No registry draft was overwritten. Review before reapplying any retained input.';
  const versions = form.ownerDocument.createElement('p');
  versions.appendChild(form.ownerDocument.createTextNode('Server version: '));
  const server = form.ownerDocument.createElement('code');
  server.textContent = result.serverVersion ?? 'unknown';
  versions.appendChild(server);
  versions.appendChild(form.ownerDocument.createTextNode('. Local version: '));
  const local = form.ownerDocument.createElement('code');
  local.textContent = draftVersion ?? localVersion(form);
  versions.appendChild(local);
  versions.appendChild(form.ownerDocument.createTextNode('.'));
  conflict.appendChild(heading);
  conflict.appendChild(copy);
  conflict.appendChild(versions);
  const actions = form.ownerDocument.createElement('div');
  actions.className = 'content-schema-registry-actions';
  const review = form.ownerDocument.createElement('button');
  review.type = 'button';
  review.textContent = localeForm ? 'Review changes' : 'Review current version';
  review.addEventListener('click', () => {
    const target = sameOriginLocation(form, form.action);
    if (target !== null) navigate(target);
  });
  const reapply = form.ownerDocument.createElement('button');
  reapply.type = 'button';
  reapply.textContent = localeForm ? 'Reapply' : 'Reapply retained input';
  reapply.addEventListener('click', () => {
    clearDynamicFeedback(form);
    setFormBusy(form, false);
    form.requestSubmit();
  });
  const discard = form.ownerDocument.createElement('button');
  discard.type = 'button';
  discard.className = 'secondary-action';
  discard.textContent = localeForm ? 'Discard' : 'Discard retained input';
  discard.addEventListener('click', () => {
    form.reset();
    clearDynamicFeedback(form);
    focusWithoutScroll(
      announce(form, 'Retained schema input discarded.', true),
    );
  });
  actions.appendChild(review);
  actions.appendChild(reapply);
  actions.appendChild(discard);
  conflict.appendChild(actions);
  form.insertBefore(conflict, form.firstChild);
  return conflict;
};

export const renderRetryAction = (
  form: HTMLFormElement,
  windowObject: Window,
): HTMLButtonElement => {
  const retry = form.ownerDocument.createElement('button');
  retry.type = 'button';
  retry.dataset.cmsCommandRetry = 'true';
  retry.textContent = 'Retry schema change';
  retry.addEventListener('click', () => {
    setFormBusy(form, true, true);
    windowObject.setTimeout(() => form.requestSubmit(), 0);
  });
  form.appendChild(retry);
  return retry;
};

export const startRetryAfterCountdown = (
  form: HTMLFormElement,
  seconds: number,
  windowObject: Window,
  onComplete: () => void,
): number | undefined => {
  let remaining = seconds;
  const announceRemaining = (): void => {
    announce(
      form,
      remaining > 0
        ? `Too many requests. Retry in ${remaining} seconds.`
        : 'Too many requests. You can try again now.',
    );
  };
  announceRemaining();
  if (remaining <= 0) {
    onComplete();
    return undefined;
  }
  const timer = windowObject.setInterval(() => {
    remaining -= 1;
    announceRemaining();
    if (remaining <= 0) {
      windowObject.clearInterval(timer);
      onComplete();
    }
  }, 1_000);
  return timer;
};
