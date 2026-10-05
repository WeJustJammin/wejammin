import * as React from 'react';

/** Tab-scoped memory of the tablet disclosure choice; never an identifier. */
export const CONTENT_SCHEMA_REGISTRY_SIDEBAR_STORAGE_KEY =
  'wj:cms-registry-sidebar';

const NAV_ID = 'content-schema-registry-sidebar-nav';
/** FE03 Responsive Behavior tablet band: 769 to 1024 CSS px. */
const TABLET_QUERY = '(width > 48rem) and (width < 64.0625rem)';

export interface ContentSchemaRegistrySidebarProps {
  readonly listUrl: string;
  readonly reviewMode: boolean;
  /** A review-only reader is never linked to a list or version they cannot read. */
  readonly reviewOnly: boolean;
  readonly version: { readonly label: string; readonly href: string } | null;
  readonly actingContextLabel?: string | undefined;
}

type Preference = 'collapsed' | 'expanded';

const readPreference = (): Preference => {
  try {
    return window.sessionStorage.getItem(
      CONTENT_SCHEMA_REGISTRY_SIDEBAR_STORAGE_KEY,
    ) === 'collapsed'
      ? 'collapsed'
      : 'expanded';
  } catch {
    return 'expanded';
  }
};

const serverPreference = (): Preference => 'expanded';
const subscribeToNothing = (): (() => void) => () => undefined;

const writePreference = (preference: Preference): void => {
  try {
    window.sessionStorage.setItem(
      CONTENT_SCHEMA_REGISTRY_SIDEBAR_STORAGE_KEY,
      preference,
    );
  } catch {
    // Blocked storage leaves the choice for this page view only.
  }
};

/** The disclosure only exists in the tablet band; elsewhere the sidebar is fixed. */
const isDisclosureViewport = (): boolean =>
  typeof window.matchMedia !== 'function' ||
  window.matchMedia(TABLET_QUERY).matches;

const CurrentItem = ({ children }: { readonly children: string }) => (
  <li>
    <span aria-current="page">{children}</span>
  </li>
);

/**
 * FE03 registry shell sidebar: a persistent region at desktop and a native
 * button disclosure (aria-expanded, aria-controls) at tablet. Server HTML is
 * always expanded; the remembered choice applies after hydration.
 */
export default function ContentSchemaRegistrySidebar({
  listUrl,
  reviewMode,
  reviewOnly,
  version,
  actingContextLabel,
}: ContentSchemaRegistrySidebarProps): React.ReactElement {
  // The remembered choice is an external (browser storage) value: server and
  // hydration render expanded, then the client snapshot applies it.
  const stored = React.useSyncExternalStore(
    subscribeToNothing,
    readPreference,
    serverPreference,
  );
  // A choice made on this page view also wins when storage is blocked.
  const [chosen, setChosen] = React.useState<Preference | null>(null);
  const collapsed = (chosen ?? stored) === 'collapsed';
  const toggleRef = React.useRef<HTMLButtonElement>(null);
  const choose = (next: boolean): void => {
    const preference = next ? 'collapsed' : 'expanded';
    setChosen(preference);
    writePreference(preference);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Escape' || collapsed || !isDisclosureViewport()) return;
    choose(true);
    toggleRef.current?.focus();
  };
  const listCurrent = !reviewMode && version === null;
  return (
    <aside
      className="content-schema-registry-sidebar"
      aria-label="Registry sidebar"
      data-collapsed={collapsed ? 'true' : 'false'}
      onKeyDown={onKeyDown}
    >
      <button
        ref={toggleRef}
        type="button"
        className="content-schema-registry-sidebar-toggle"
        aria-expanded={!collapsed}
        aria-controls={NAV_ID}
        onClick={() => choose(!collapsed)}
      >
        <span className="content-schema-registry-sidebar-label">
          Registry sections
        </span>
      </button>
      <nav
        id={NAV_ID}
        className="content-schema-registry-sidebar-nav"
        aria-label="Registry section links"
      >
        <ul>
          {reviewOnly ? null : listCurrent ? (
            <CurrentItem>Registry overview</CurrentItem>
          ) : (
            <li>
              <a href={listUrl}>Registry overview</a>
            </li>
          )}
          {version === null || reviewMode ? null : (
            <li>
              <a href={version.href} aria-current="page">
                {`Selected version: ${version.label}`}
              </a>
            </li>
          )}
          {reviewMode ? <CurrentItem>Schema review</CurrentItem> : null}
        </ul>
        {actingContextLabel === undefined ? null : (
          <p className="content-schema-registry-help">
            Context: {actingContextLabel}
          </p>
        )}
      </nav>
    </aside>
  );
}
