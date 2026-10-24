import * as React from 'react';
import { vi } from 'vitest';

import { mountElement } from '../cms-editorial-fields/cms-editor-dom.test-support';
import { TYPE_ID } from '../../server/cms-pattern-platform.test-support';
import CmsPatternVersionDesigner from './CmsPatternVersionDesigner';
import {
  CSRF_TOKEN,
  designerContext,
  latestDetail,
  submitStub,
} from './pattern-designer.test-support';
import type { PatternSubmitResult } from './pattern-designer-submit';
import type { PatternLatestResult } from './pattern-latest-read';

export const firstVersionDetail = (patternKey: string) =>
  latestDetail({
    patternKey,
    version: '1',
    patternVersion: 1,
    nodeCount: 1,
    compatibleTypeIds: [TYPE_ID],
    blockTree: [
      {
        kind: 'block',
        key: 'hero',
        blockKey: 'profile.header',
        blockVersion: 1,
        props: {},
        children: [],
      },
    ],
  });

export const mountEditHeldRead = (...submitResults: PatternSubmitResult[]) => {
  const pending: ((value: PatternLatestResult) => void)[] = [];
  const readLatest = vi.fn(
    () =>
      new Promise<PatternLatestResult>((resolve) => {
        pending.push(resolve);
      }),
  );
  const submit = submitStub(...submitResults);
  const mounted = mountElement(
    <CmsPatternVersionDesigner
      context={designerContext}
      latest={latestDetail()}
      csrfToken={CSRF_TOKEN}
      submit={submit}
      readLatest={readLatest}
    />,
  );
  return {
    ...mounted,
    submit,
    readLatest,
    settleFirst: (value: PatternLatestResult): void => pending[0]?.(value),
  };
};

export const mountNewHeldRead = (...submitResults: PatternSubmitResult[]) => {
  const pending: ((value: PatternLatestResult) => void)[] = [];
  const readLatest = vi.fn(
    () =>
      new Promise<PatternLatestResult>((resolve) => {
        pending.push(resolve);
      }),
  );
  const submit = submitStub(...submitResults);
  const mounted = mountElement(
    <CmsPatternVersionDesigner
      context={designerContext}
      latest={null}
      csrfToken={CSRF_TOKEN}
      submit={submit}
      readLatest={readLatest}
    />,
  );
  return {
    ...mounted,
    submit,
    readLatest,
    settleFirst: (value: PatternLatestResult): void => pending[0]?.(value),
  };
};
