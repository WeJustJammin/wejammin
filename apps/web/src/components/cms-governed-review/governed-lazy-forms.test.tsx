// @vitest-environment jsdom
import * as React from 'react';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  INSTANT,
  REVIEW_ID,
  SUBJECT_ID,
  HASH_A,
  governedDetailFixture,
} from '../../server/cms-governed-review-fixtures.test-support';
import {
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsGovernedReviewDetailIsland from './CmsGovernedReviewDetailIsland';
import CmsGovernedReviewPanel, {
  type GovernedPanelSubject,
} from './CmsGovernedReviewPanel';

/*
 * FE03 "Performance budgets and loading strategy": a command form's chunk loads the first time
 * the server offers its action, and a reader who is offered none loads none. The views modules are
 * replaced here by components that record that they were mounted (the browser fetches a lazy form
 * exactly when it is mounted).
 */
const mounted = vi.hoisted(() => ({ names: [] as string[] }));

vi.mock('./governed-review-form-views', async () => {
  const React = await import('react');
  const view = (name: string) => () => {
    React.useEffect(() => {
      mounted.names.push(name);
    }, []);
    return null;
  };
  return {
    GovernedDecisionFormView: view('decision'),
    GovernedAssignmentFormView: view('assignment'),
    GovernedActivationFormView: view('activation'),
  };
});
vi.mock('./governed-panel-form-views', async () => {
  const React = await import('react');
  return {
    GovernedSubmitFormView: () => {
      React.useEffect(() => {
        mounted.names.push('submit');
      }, []);
      return null;
    },
  };
});

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => {
  mounted.names.length = 0;
});

const island = (permittedNextActions: readonly string[]) =>
  mountElement(
    <CmsGovernedReviewDetailIsland
      init={{
        review: governedDetailFixture({ permittedNextActions }),
        reviewId: REVIEW_ID,
        verifiedAt: INSTANT,
      }}
      readReview={async () => ({
        kind: 'ok',
        resource: governedDetailFixture({ permittedNextActions }),
      })}
    />,
  );

describe('the definition review island mounts a form only for an action the server offers', () => {
  it.each([
    [[], []],
    [['record_decision'], ['decision']],
    [['assign_reviewer'], ['assignment']],
    [['revoke_assignment'], ['assignment']],
    [['activate'], ['activation']],
    [['schedule'], ['activation']],
    [['retire'], ['activation']],
    [
      ['record_decision', 'assign_reviewer', 'retire'],
      ['decision', 'assignment', 'activation'],
    ],
  ] as const)('with %j it mounts %j', async (permitted, expected) => {
    island(permitted);
    await flush();
    expect(mounted.names).toEqual(expected);
  });
});

describe('the definition panel mounts its submit form only for a draft', () => {
  const subject = (
    state: GovernedPanelSubject['state'],
  ): GovernedPanelSubject => ({
    kind: 'template_version',
    id: SUBJECT_ID,
    hash: HASH_A,
    key: 'profile-header',
    version: 2,
    state,
  });
  const panel = (state: GovernedPanelSubject['state']) =>
    mountElement(
      <CmsGovernedReviewPanel
        subject={subject(state)}
        readSubject={async () => subject(state)}
      />,
    );

  it.each(['review', 'approved', 'scheduled', 'active', 'retired'] as const)(
    'loads nothing for a %s version',
    async (state) => {
      panel(state);
      await flush();
      expect(mounted.names).toEqual([]);
    },
  );

  it('loads it for a draft', async () => {
    panel('draft');
    await flush();
    expect(mounted.names).toEqual(['submit']);
  });
});
