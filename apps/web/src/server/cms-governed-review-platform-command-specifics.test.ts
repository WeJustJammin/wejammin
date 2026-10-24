import { describe, expect, it } from 'vitest';

import {
  LATER,
  SUBJECT_ID,
  governedAssignmentFixture,
  governedReviewFixture,
} from './cms-governed-review-fixtures.test-support';
import {
  CASES,
  catalogError,
  request,
  run,
  success,
  type CommandCase,
} from './cms-governed-review-platform-command.test-support';
import { forwardCmsGovernedReviewCommand } from './cms-governed-review-platform-command';
import { bindingFor } from './cms-workflow-platform-command.test-support';

describe('CMS-03C-06 submit specifics', () => {
  const [submit] = CASES as readonly [CommandCase];

  it('refuses any If-Match because a submission names its subject by id and hash', async () => {
    const binding = bindingFor();
    const response = await run(
      submit,
      request(submit, { headers: { 'if-match': '"1"' } }),
      binding,
    );
    expect(response.status).toBe(400);
    expect(binding.fetch).not.toHaveBeenCalled();
  });

  it('does not take the subject from anything but the body', async () => {
    const response = await run(
      submit,
      request(submit, {
        body: JSON.stringify({ ...submit.body, subjectHash: 'not-a-hash' }),
      }),
      bindingFor(),
    );
    expect(response.status).toBe(422);
    const body = (await response.json()) as {
      details: { violations: { path: string }[] };
    };
    expect(body.details.violations.map((entry) => entry.path)).toContain(
      '/subjectHash',
    );
  });

  it('relays canonical_source_unavailable with the named domain', async () => {
    const response = await run(
      submit,
      request(submit),
      bindingFor(
        catalogError(422, 'GOVERNED_REVIEW_VALIDATION_FAILED', {
          reasonCode: 'canonical_source_unavailable',
          domain: 'gear',
        }),
      ),
    );
    expect(response.status).toBe(422);
    expect(((await response.json()) as { details: unknown }).details).toEqual({
      reasonCode: 'canonical_source_unavailable',
      domain: 'gear',
    });
  });
});

describe('versioned commands (CMS-03C-07, CMS-03C-08, CMS-03C-09)', () => {
  const versioned = CASES.filter((testCase) => testCase.ifMatch !== null);

  it.each(versioned)(
    '$name requires the strong If-Match to equal expectedVersion',
    async (testCase) => {
      const binding = bindingFor();
      for (const ifMatch of [null, '"3"', 'W/"2"', '2']) {
        const response = await run(
          testCase,
          request(testCase, { headers: { 'if-match': ifMatch } }),
          binding,
        );
        expect(response.status).toBe(400);
      }
      expect(binding.fetch).not.toHaveBeenCalled();
    },
  );

  it('relays the step-up shortfall as 401 STEP_UP_REQUIRED with its recovery', async () => {
    for (const testCase of versioned) {
      const response = await run(
        testCase,
        request(testCase),
        bindingFor(
          catalogError(401, 'STEP_UP_REQUIRED', {
            recoveryAction: 'step_up',
            allowedMethods: ['totp'],
          }),
        ),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        code: 'STEP_UP_REQUIRED',
        details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
      });
      expect(response.headers.has('x-cms-editorial-outcome')).toBe(false);
    }
  });

  it('CMS-03C-07 refuses a path review that is not the body review with a 422 at /reviewId', async () => {
    const decision = CASES[1] as CommandCase;
    const response = await forwardCmsGovernedReviewCommand(
      'CMS-03C-07',
      request(decision),
      { reviewId: SUBJECT_ID },
      bindingFor(),
    );
    expect(response.status).toBe(422);
    expect(
      (
        (await response.json()) as {
          details: { violations: { path: string }[] };
        }
      ).details.violations[0]?.path,
    ).toBe('/reviewId');
  });

  it('refuses a malformed path review before any upstream call', async () => {
    const binding = bindingFor();
    for (const testCase of versioned) {
      const response = await forwardCmsGovernedReviewCommand(
        testCase.operationId,
        request(testCase),
        { reviewId: 'not-a-uuid' },
        binding,
      );
      expect(response.status).toBe(400);
    }
    expect(binding.fetch).not.toHaveBeenCalled();
  });

  it('relays each 409 reason of the decision and assignment tokens', async () => {
    for (const reasonCode of [
      'review_not_open',
      'duplicate_decision',
      'specialist_slot_unsatisfiable',
      'dependency_changed',
    ]) {
      const testCase = CASES[1] as CommandCase;
      const response = await run(
        testCase,
        request(testCase),
        bindingFor(
          catalogError(409, 'GOVERNED_REVIEW_VERSION_CONFLICT', { reasonCode }),
        ),
      );
      expect(response.status).toBe(409);
      expect(((await response.json()) as { details: unknown }).details).toEqual(
        { reasonCode },
      );
    }
    const assignment = CASES[2] as CommandCase;
    const eligible = await run(
      assignment,
      request(assignment),
      bindingFor(
        catalogError(409, 'GOVERNED_REVIEW_VERSION_CONFLICT', {
          reasonCode: 'reviewer_not_eligible',
        }),
      ),
    );
    expect(((await eligible.json()) as { details: unknown }).details).toEqual({
      reasonCode: 'reviewer_not_eligible',
    });
  });
});

describe('commit binding beyond identity', () => {
  const [submit, decide, create] = CASES as readonly [
    CommandCase,
    CommandCase,
    CommandCase,
  ];

  it('answers 502 for a submission that is not at version 1 or already has a decision', async () => {
    for (const resource of [
      governedReviewFixture({ version: '2' }),
      governedReviewFixture({
        state: 'approved',
        recordedDecisionCount: 1,
        decidedAt: LATER,
      }),
    ]) {
      const response = await run(
        submit,
        request(submit),
        bindingFor(
          success(submit, { resource, etag: `"${resource.version}"` }),
        ),
      );
      expect(response.status).toBe(502);
    }
  });

  it('answers 502 for a decision that did not advance the review version by one or whose state contradicts it', async () => {
    for (const resource of [
      governedReviewFixture({
        version: '5',
        state: 'approved',
        recordedDecisionCount: 1,
        decidedAt: LATER,
      }),
      governedReviewFixture({
        version: '3',
        state: 'rejected',
        recordedDecisionCount: 1,
        decidedAt: LATER,
      }),
    ]) {
      const response = await run(
        decide,
        request(decide),
        bindingFor(
          success(decide, { resource, etag: `"${resource.version}"` }),
        ),
      );
      expect(response.status).toBe(502);
    }
  });

  it('answers 502 for an assignment whose window or reason is not the one asked for', async () => {
    for (const resource of [
      governedAssignmentFixture({ expiresAt: '2026-10-09T18:00:00Z' }),
      governedAssignmentFixture({ reason: 'invented' }),
      governedAssignmentFixture({ state: 'revoked' }),
    ]) {
      const response = await run(
        create,
        request(create),
        bindingFor(success(create, { resource })),
      );
      expect(response.status).toBe(502);
    }
  });
});
