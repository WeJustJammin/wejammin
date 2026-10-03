import * as React from 'react';
import { z } from 'zod';
import * as C from '@wejammin/contracts';

import ContentSchemaRegistryCreateForm from './ContentSchemaRegistryCreateForm';
import {
  activationPreparation,
  approvedReviewPreparation,
  passedDryRunPreparation,
  startDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';
import {
  approvedProtectedReview,
  assignmentResource,
  draftDetail,
  reviewResource,
} from './content-schema-review-dec108.test-support';
import {
  renderDocument,
  reviewPageProps,
  reviewSuccess,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';
import {
  mount,
  type Mounted,
} from './content-schema-registry-locale-fields.test-support';

/**
 * Real rendered forms for every BE03a human command, with the generated
 * request schema each one maps to (FE03 "Form-by-source completeness").
 */

export const holder: { mounted: Mounted | null } = { mounted: null };

export const closeMounted = (): void => {
  holder.mounted?.unmount();
  holder.mounted = null;
};

export const TRANSPORT = new Set([
  'operationId',
  'csrf',
  'idempotency-key',
  'if-match',
  'contentTypeId',
  'versionId',
  'reviewId',
]);
export const UI_ONLY = new Set(['localeChoice', 'confirmed']);

export const inputKeys = (schema: z.ZodType): string[][] => {
  const json = z.toJSONSchema(schema, {
    io: 'input',
    unrepresentable: 'any',
  }) as {
    properties?: Record<string, unknown>;
    oneOf?: { properties: Record<string, unknown> }[];
  };
  return json.properties === undefined
    ? (json.oneOf ?? []).map((variant) => Object.keys(variant.properties))
    : [Object.keys(json.properties)];
};

export const bodyControls = (form: HTMLFormElement): string[] => [
  ...new Set(
    [...form.elements]
      .map((element) => (element as HTMLInputElement).name)
      .filter(
        (name) => name !== '' && !TRANSPORT.has(name) && !UI_ONLY.has(name),
      ),
  ),
];

const draftDoc = () =>
  renderDocument(
    versionPageProps({
      initialDetail: successDetail(draftDetail(approvedReviewPreparation)),
      initialReview: reviewSuccess(approvedProtectedReview()),
    }),
  );
const pageDoc = (preparation: Parameters<typeof draftDetail>[0]) =>
  renderDocument(
    versionPageProps({
      initialDetail: successDetail(draftDetail(preparation)),
    }),
  );
const OWNER_REVIEW = reviewResource({
  permittedNextActions: ['assign_reviewer'],
  assignments: [
    {
      assignmentId: assignmentResource().id,
      version: '2',
      state: 'active',
      startsAt: '2026-10-02T12:00:00.000Z',
      endsAt: '2026-10-05T12:00:00.000Z',
      reviewerLabel: 'Reviewer A',
    },
  ],
});

export const createForm = (): HTMLFormElement => {
  holder.mounted = mount(
    React.createElement(ContentSchemaRegistryCreateForm, {
      action: '/app/cms-content-modeling',
      csrfToken: 'csrf-token-value',
      idempotencyKey: 'cms-schema-cms-03a-01-support',
    }),
  );
  return holder.mounted.form;
};

export interface Case {
  readonly id: string;
  readonly schema: z.ZodType;
  readonly form: () => HTMLFormElement;
  readonly variant?: number;
}

export const formOf = (
  doc: Document,
  id: string,
  index = 0,
): HTMLFormElement => {
  const forms = doc.querySelectorAll<HTMLFormElement>(
    `form[data-operation-id="${id}"]`,
  );
  const form = forms[index];
  if (form === undefined) throw new Error(`${id} form not rendered`);
  return form;
};

export const CASES: readonly Case[] = [
  {
    id: 'CMS-03A-01',
    schema: C.ContentTypeDraftRequestSchema,
    form: createForm,
  },
  {
    id: 'CMS-03A-02',
    schema: C.FieldSchemaChangeRequestSchema,
    form: () => formOf(draftDoc(), 'CMS-03A-02'),
  },
  {
    id: 'CMS-03A-03',
    schema: C.RelationBindingRequestSchema,
    form: () => formOf(draftDoc(), 'CMS-03A-03'),
  },
  {
    id: 'CMS-03A-04',
    schema: C.SchemaActivationRequestSchema,
    form: () => formOf(draftDoc(), 'CMS-03A-04'),
  },
  {
    id: 'CMS-03A-09',
    schema: C.SchemaSuccessorRequestSchema,
    form: () =>
      formOf(
        pageDoc(
          activationPreparation({ permittedNextActions: ['create_successor'] }),
        ),
        'CMS-03A-09',
      ),
  },
  {
    id: 'CMS-03A-10',
    schema: C.SchemaDryRunRequestSchema,
    form: () => formOf(pageDoc(startDryRunPreparation), 'CMS-03A-10'),
  },
  {
    id: 'CMS-03A-11',
    schema: C.SchemaReviewSubmissionRequestSchema,
    form: () => formOf(pageDoc(passedDryRunPreparation), 'CMS-03A-11'),
  },
  {
    id: 'CMS-03A-12',
    schema: C.SchemaReviewDecisionRequestSchema,
    form: () =>
      formOf(
        renderDocument(
          reviewPageProps(
            reviewResource({ permittedNextActions: ['record_decision'] }),
            {
              variant: 'schemaReviewAssigned',
              access: 'read-only',
            },
          ),
        ),
        'CMS-03A-12',
      ),
  },
  {
    id: 'CMS-03A-14',
    schema: C.SchemaReviewAssignmentRequestSchema,
    variant: 0,
    form: () =>
      formOf(
        renderDocument(
          reviewPageProps(OWNER_REVIEW, {
            variant: 'ownerFull',
            access: 'full',
          }),
        ),
        'CMS-03A-14',
        0,
      ),
  },
  {
    id: 'CMS-03A-14',
    schema: C.SchemaReviewAssignmentRequestSchema,
    variant: 1,
    form: () =>
      formOf(
        renderDocument(
          reviewPageProps(OWNER_REVIEW, {
            variant: 'ownerFull',
            access: 'full',
          }),
        ),
        'CMS-03A-14',
        1,
      ),
  },
];
