import { describe, expect, it } from 'vitest';

import {
  CMS_EDITORIAL_ENTRY_CREATE_BOUNDARY,
  resolveCmsEditorialEntryCreatePageState,
} from './cms-editorial-entry-create';

describe('cms-editorial entry create fail-closed boundary', () => {
  it('declares the served route but unavailable policy evidence', () => {
    expect(CMS_EDITORIAL_ENTRY_CREATE_BOUNDARY.status).toBe(
      'route-served-policy-evidence-unavailable',
    );
    expect(CMS_EDITORIAL_ENTRY_CREATE_BOUNDARY.operationId).toBe('CMS-03B-10');
    expect(CMS_EDITORIAL_ENTRY_CREATE_BOUNDARY.ifMatchRequired).toBe(false);
    expect(CMS_EDITORIAL_ENTRY_CREATE_BOUNDARY.idempotencyRequired).toBe(true);
  });

  it('names the unresolved workflow-policy evidence source as the blocker', () => {
    expect(CMS_EDITORIAL_ENTRY_CREATE_BOUNDARY.blocker).toContain(
      'workflowPolicy',
    );
    expect(CMS_EDITORIAL_ENTRY_CREATE_BOUNDARY.blocker).toContain(
      'private editorial-policy source',
    );
  });

  it('renders an honest disabled state that fabricates no entry', () => {
    const state = resolveCmsEditorialEntryCreatePageState();
    expect(state.status).toBe('disabled');
    expect(state).not.toHaveProperty('data');
  });
});
