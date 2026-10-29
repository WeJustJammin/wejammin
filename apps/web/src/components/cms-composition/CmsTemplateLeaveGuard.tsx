import * as React from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

import { useCmsEditorialLeaveGuard } from '../cms-editorial/use-cms-editorial-leave-guard';
import CmsTemplateLateEditNotice from './CmsTemplateLateEditNotice';
import CmsTemplateLeaveConfirm from './CmsTemplateLeaveConfirm';

interface Props {
  /** True while the designer holds values the server has not confirmed. */
  readonly dirty: boolean;
  /** True when values typed during a save that then succeeded were not part of it. */
  readonly lateEdits?: boolean;
  /** Leaves this page for a destination the person confirmed. */
  readonly navigate?: ((href: string) => void) | undefined;
  readonly children: React.ReactNode;
}

const defaultNavigate = (href: string): void => window.location.assign(href);

/**
 * The designers have no autosave: there is no "save and leave", so nothing is ever sent by the
 * guard and the draft always stays unsent until the person chooses to keep or discard it.
 */
export const CMS_TEMPLATE_NO_AUTOSAVE = {
  save: async (): Promise<void> => undefined,
  stillUnsent: (): boolean => true,
} as const;

/**
 * The designer's root element and its FE03 "Unsaved changes" contract: the draft stays while the
 * person decides, an inline confirmation guards in-app links, and `beforeunload` is armed only
 * while the form is dirty. There is no autosave, so the only exits are keeping the draft or the
 * explicit discard; the guard disarms when the form is clean (after a verified success or a reset).
 */
export default function CmsTemplateLeaveGuard({
  dirty,
  lateEdits = false,
  navigate,
  children,
}: Props): React.ReactElement {
  const guard = useCmsEditorialLeaveGuard({
    active: dirty,
    ...CMS_TEMPLATE_NO_AUTOSAVE,
    navigate: navigate ?? defaultNavigate,
  });
  // The island holds almost no link of its own: the page's navigation lies outside it (the header of
  // templates/new.astro and [templateKey].astro), so the capture listens on the document.
  const capture = React.useRef(guard.onClickCapture);
  React.useEffect(() => {
    capture.current = guard.onClickCapture;
  });
  React.useEffect(() => {
    const listen = (event: MouseEvent): void =>
      capture.current(event as unknown as ReactMouseEvent<HTMLElement>);
    document.addEventListener('click', listen, true);
    return () => document.removeEventListener('click', listen, true);
  }, []);
  return (
    <section
      className="cms-template-designer"
      aria-labelledby="cms-template-designer-title"
    >
      {guard.pendingHref === null ? null : (
        <CmsTemplateLeaveConfirm
          onStay={guard.stay}
          onLeave={guard.leaveWithoutSaving}
        />
      )}
      {lateEdits ? <CmsTemplateLateEditNotice /> : null}
      {children}
    </section>
  );
}
