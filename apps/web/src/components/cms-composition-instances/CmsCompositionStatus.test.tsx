// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsCompositionStatus, {
  RESULT_HEADING_ID,
} from './CmsCompositionStatus';
import { failure, IDLE, pending, success } from './composition-status';

/*
 * The one result region (FE03 1114, 1115): pending is a polite status; a success is a status that names each outcome;
 * a refusal is an alert; focus moves to the named result heading when an outcome arrives.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

describe('CmsCompositionStatus', () => {
  it('renders nothing while idle', () => {
    const { container } = mountElement(<CmsCompositionStatus status={IDLE} />);
    expect(container.textContent).toBe('');
  });

  it('announces pending politely', () => {
    const { container } = mountElement(
      <CmsCompositionStatus status={pending('Placing the pattern…')} />,
    );
    const region = container.querySelector('[role="status"]');
    expect(region?.textContent).toBe('Placing the pattern…');
  });

  it('names a success with each line and focuses the result heading', () => {
    const { container } = mountElement(
      <CmsCompositionStatus
        status={success('Update applied', [
          '/main/a: Now on pattern version 2',
          '/main/b: Local copy',
        ])}
      />,
    );
    const region = container.querySelector('[role="status"]');
    expect(region?.querySelector('h2')?.textContent).toBe('Update applied');
    expect(
      Array.from(region!.querySelectorAll('li')).map((li) => li.textContent),
    ).toEqual(['/main/a: Now on pattern version 2', '/main/b: Local copy']);
    expect(document.activeElement?.id).toBe(RESULT_HEADING_ID);
  });

  it('states a refusal as an alert with its message and the progress it kept', () => {
    const { container } = mountElement(
      <CmsCompositionStatus
        status={failure('Update not applied', 'Your choices are kept.', [
          '1 of 3 requests applied',
        ])}
      />,
    );
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Update not applied');
    expect(alert?.textContent).toContain('Your choices are kept.');
    expect(alert?.textContent).toContain('1 of 3 requests applied');
    expect(document.activeElement?.id).toBe(RESULT_HEADING_ID);
  });

  it('moves focus again when a new outcome replaces the old one', () => {
    const mounted = mountElement(
      <CmsCompositionStatus status={success('One')} />,
    );
    (document.activeElement as HTMLElement).blur();
    mounted.rerender(<CmsCompositionStatus status={success('Two')} />);
    expect(document.activeElement?.id).toBe(RESULT_HEADING_ID);
  });
});
