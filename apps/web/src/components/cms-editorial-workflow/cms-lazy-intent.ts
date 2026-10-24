/**
 * Load-on-intent for command forms (FE03 "Performance budgets and loading strategy": lazy modules
 * "load on explicit entry"; P2-S11-AC-106).
 *
 * A form that a route mounts at hydration is part of the cold load: Chrome fetches its chunk at
 * once, so the route is charged for it. A form whose chunk should wait for the person keeps its
 * server markup in place (a lazy boundary that has not resolved leaves the server HTML as it is)
 * and loads on the first sign of intent in its REGION: the pointer over it, a press, a touch,
 * focus, a key, or a change of one of its controls. Nothing else loads it: scrolling, time and the
 * size of the viewport never do, which is what lets the bundle gate (`bundle:check`) treat the
 * chunk as outside the cold load. A region is the element that carries
 * `data-cms-lazy-region="<name>"` in the server markup; a form that is not in the server markup
 * (a client mount after a refetch) has no region and loads at once.
 *
 * Until the form has hydrated its controls are native and enabled, so keyboard, pointer and
 * assistive technology work as in any server-rendered form. Two things would otherwise be lost:
 * - A value typed or chosen before hydration stays in the DOM but never reaches the form's state
 *   (React keeps the DOM value and reports no change). The module records the last value of every
 *   control of an unhydrated region, and the field primitives read it back when they mount
 *   (`takePreHydrationValue`), so the state starts from what the person already entered.
 * - A submit before hydration would navigate (a native GET of the fields). It is cancelled
 *   instead, the region is armed, and the submit is replayed once with `requestSubmit` when the
 *   form marks its region hydrated.
 */
export const REGION_ATTRIBUTE = 'data-cms-lazy-region';
export const HYDRATED_ATTRIBUTE = 'data-cms-lazy-hydrated';

/** Pointer, touch, focus, key and control changes: the only things that arm a region. */
export const INTENT_EVENTS = [
  'pointerover',
  'pointerdown',
  'touchstart',
  'focusin',
  'keydown',
  'input',
  'change',
] as const;

interface HeldSubmit {
  readonly form: HTMLFormElement;
  readonly submitter: HTMLElement | null;
}

interface Typed {
  readonly element: Element;
  readonly value: string;
}

const armed = new Set<string>();
const waiting = new Map<string, Array<() => void>>();
const typed = new Map<string, Typed>();
let held: HeldSubmit[] = [];
let installed = false;

const regionsOf = (element: Element): string[] =>
  (element.getAttribute(REGION_ATTRIBUTE) ?? '').split(/\s+/u).filter(Boolean);

const arm = (regions: readonly string[]): void => {
  for (const region of regions) {
    armed.add(region);
    for (const resolve of waiting.get(region) ?? []) resolve();
    waiting.delete(region);
  }
};

const unhydratedRegionOf = (target: EventTarget | null): Element | null =>
  target instanceof Element
    ? target.closest(`[${REGION_ATTRIBUTE}]:not([${HYDRATED_ATTRIBUTE}])`)
    : null;

/** The key a field primitive reads back: the control id, or `radio:<name>` for a radio group. */
type Entered = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const typedKeyOf = (control: Entered): string | null => {
  if (control instanceof HTMLInputElement && control.type === 'radio')
    return control.name === '' ? null : `radio:${control.name}`;
  return control.id === '' ? null : control.id;
};

const record = (event: Event, region: Element): void => {
  const control = event.target;
  if (!(
    control instanceof HTMLInputElement ||
    control instanceof HTMLTextAreaElement ||
    control instanceof HTMLSelectElement
  ))
    return;
  const key = typedKeyOf(control);
  if (key === null) return;
  if (control instanceof HTMLInputElement && control.type === 'radio') {
    if (control.checked)
      typed.set(key, { element: region, value: control.value });
    return;
  }
  typed.set(key, { element: region, value: control.value });
};

const onIntent = (event: Event): void => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const region = target.closest(`[${REGION_ATTRIBUTE}]`);
  if (region === null) return;
  if (
    (event.type === 'input' || event.type === 'change') &&
    !region.hasAttribute(HYDRATED_ATTRIBUTE)
  )
    record(event, region);
  arm(regionsOf(region));
};

const onSubmit = (event: Event): void => {
  const region = unhydratedRegionOf(event.target);
  if (region === null || !(event.target instanceof HTMLFormElement)) return;
  event.preventDefault();
  arm(regionsOf(region));
  const submitter = (event as SubmitEvent).submitter;
  held.push({
    form: event.target,
    submitter: submitter instanceof HTMLElement ? submitter : null,
  });
};

/** Idempotent; called at import and by `whenRegionIntent`, and by tests after a reset. */
export const installLazyIntent = (): void => {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  for (const type of INTENT_EVENTS)
    document.addEventListener(type, onIntent, { capture: true, passive: true });
  document.addEventListener('submit', onSubmit, { capture: true });
};

const regionInDocument = (region: string): boolean =>
  typeof document !== 'undefined' &&
  document.querySelector(
    `[${REGION_ATTRIBUTE}~="${region}"]:not([${HYDRATED_ATTRIBUTE}])`,
  ) !== null;

// Listening from the first import means an intent shown before the first form asks is not lost.
installLazyIntent();

/**
 * Resolves when the region may load: at once for a region that is not in the document (nothing to
 * wait on) or that was armed, else on the first intent inside it.
 */
export const whenRegionIntent = (region: string): Promise<void> => {
  installLazyIntent();
  if (armed.has(region) || !regionInDocument(region)) return Promise.resolve();
  return new Promise((resolve) => {
    waiting.set(region, [...(waiting.get(region) ?? []), resolve]);
  });
};

/**
 * Like `whenRegionIntent`, for work that follows a hydrated form (a read the form makes for
 * itself): resolves at once for a region that is not in the document or was armed, else on the
 * first intent inside it, whether or not the form has hydrated meanwhile.
 */
export const whenRegionTouched = (region: string): Promise<void> => {
  installLazyIntent();
  const present =
    typeof document !== 'undefined' &&
    document.querySelector(`[${REGION_ATTRIBUTE}~="${region}"]`) !== null;
  if (armed.has(region) || !present) return Promise.resolve();
  return new Promise((resolve) => {
    waiting.set(region, [...(waiting.get(region) ?? []), resolve]);
  });
};

/**
 * The value the person entered into this control before its form hydrated, once (undefined when
 * there is none). The field primitives call it when they mount and start their state from it.
 */
export const takePreHydrationValue = (key: string): string | undefined => {
  const entry = typed.get(key);
  typed.delete(key);
  return entry?.value;
};

/** The form of the region has hydrated: stop holding its submits and replay the held one. */
export const markRegionHydrated = (region: Element): void => {
  region.setAttribute(HYDRATED_ATTRIBUTE, '');
  for (const [key, entry] of Array.from(typed))
    if (entry.element === region) typed.delete(key);
  const mine = held.filter(({ form }) => region.contains(form));
  held = held.filter(({ form }) => !region.contains(form));
  // Not in this commit: the controls just seeded their state from what was entered, and that
  // update is rendered right after the layout effects, so the replayed handler must run after it.
  queueMicrotask(() => {
    const replayed = new Set<HTMLFormElement>();
    for (const { form, submitter } of mine) {
      if (replayed.has(form)) continue;
      replayed.add(form);
      form.requestSubmit(submitter ?? undefined);
    }
  });
};

export const resetLazyIntentForTest = (): void => {
  armed.clear();
  waiting.clear();
  typed.clear();
  held = [];
  if (installed && typeof document !== 'undefined') {
    for (const type of INTENT_EVENTS)
      document.removeEventListener(type, onIntent, { capture: true });
    document.removeEventListener('submit', onSubmit, { capture: true });
  }
  installed = false;
};
