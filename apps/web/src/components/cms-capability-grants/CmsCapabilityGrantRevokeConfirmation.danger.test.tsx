// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { grantResource } from '../../server/cms-capability-grant.test-support';
import CmsCapabilityGrantRevokeConfirmation from './CmsCapabilityGrantRevokeConfirmation';

/**
 * Revoking a grant ends access at once and names that consequence (CMS-03A-17, "I understand
 * this revokes access immediately"), so its commit control carries the shared destructive
 * treatment (DESIGN.md, Components > Buttons; `styles/cms-danger-action.css`). Cancel does not.
 */
const markup = (pending: boolean): Document => {
  const html = renderToStaticMarkup(
    <CmsCapabilityGrantRevokeConfirmation
      grant={grantResource()}
      csrfToken="csrf"
      idempotencyKey="key-1"
      disabled={false}
      pending={pending}
      serverErrors={{}}
      onSubmit={() => undefined}
      onCancel={() => undefined}
    />,
  );
  return new DOMParser().parseFromString(html, 'text/html');
};

describe('the revoke confirmation', () => {
  it.each([false, true])(
    'marks the commit control, and only it, as a danger action (pending: %s)',
    (pending) => {
      const doc = markup(pending);
      const danger = Array.from(doc.querySelectorAll('.cms-danger-action'));
      expect(danger).toHaveLength(1);
      expect(danger[0]?.getAttribute('type')).toBe('submit');
      expect(danger[0]?.textContent).toBe(
        pending ? 'Revoking' : 'Revoke grant',
      );
    },
  );
});
