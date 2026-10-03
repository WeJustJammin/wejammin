import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ContentSchemaRegistryActivationForm from './ContentSchemaRegistryActivationForm';
import ContentSchemaRegistryActionBar from './ContentSchemaRegistryActionBar';
import CapabilityGate from '../infrastructure/CapabilityGate';
import ContentSchemaRegistryConfirmationStep from './ContentSchemaRegistryConfirmationStep';
import ContentSchemaRegistryCreateForm from './ContentSchemaRegistryCreateForm';
import ContentSchemaRegistryFieldForm from './ContentSchemaRegistryFieldForm';
import ContentSchemaRegistryOfflineStatus from './ContentSchemaRegistryOfflineStatus';
import ContentSchemaRegistryRelationForm from './ContentSchemaRegistryRelationForm';
import ContentSchemaRegistrySyncConflict from './ContentSchemaRegistrySyncConflict';

const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const FIELD_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const CSRF = 'csrf-token';
const IDEMPOTENCY = 'cms-operation-123';
const IF_MATCH = '"4"';

describe('content schema registry command forms and interaction primitives', () => {
  it('renders CMS-03A-01 from the generated request field names only', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ContentSchemaRegistryCreateForm, {
        action: '/app/cms-content-modeling',
        csrfToken: CSRF,
        idempotencyKey: IDEMPOTENCY,
      }),
    );

    for (const name of [
      'typeKey',
      'label',
      'ownerCapability',
      'sourceLocale',
      'defaultLocale',
      'workflowKey',
      'workflowVersion',
      'fields',
      'relations',
      'capabilityBindings',
      'csrf',
      'idempotency-key',
    ]) {
      expect(markup).toContain(`name="${name}"`);
    }
    // DEC-123: a new type binds no template at creation; the form offers no
    // template input and says where the binding is made instead.
    for (const name of ['defaultTemplateVersionId', 'templateBindings']) {
      expect(markup).not.toContain(`name="${name}"`);
    }
    expect(markup).not.toContain('content-schema-registry-template-bindings');
    expect(markup).not.toContain(
      'content-schema-registry-default-template-version-id',
    );
    expect(markup).toContain(
      'A template is bound after creation, through a successor version.',
    );
    expect(markup).not.toContain('ReleaseEnvelopeHeaders');
    expect(markup).toContain('Content type draft');
  });

  it('renders CMS-03A-02 with exact IDs, ETag, idempotency, and nullable migration', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ContentSchemaRegistryFieldForm, {
        action: `/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}`,
        contentTypeId: TYPE_ID,
        versionId: VERSION_ID,
        csrfToken: CSRF,
        idempotencyKey: IDEMPOTENCY,
        ifMatch: IF_MATCH,
      }),
    );

    expect(markup).toContain(
      `action="/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}"`,
    );
    expect(markup).toContain('name="if-match"');
    expect(markup).toContain(`value="&quot;4&quot;"`);
    expect(markup).toContain('name="migrationPlanId"');
    expect(markup).toContain('name="csrf"');
    expect(markup).toContain('name="idempotency-key"');
    expect(markup).toContain(`value="${TYPE_ID}"`);
    expect(markup).toContain(`value="${VERSION_ID}"`);
  });

  it('renders CMS-03A-03 with exact relation fields and path IDs', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ContentSchemaRegistryRelationForm, {
        action: `/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}`,
        contentTypeId: TYPE_ID,
        versionId: VERSION_ID,
        csrfToken: CSRF,
        idempotencyKey: IDEMPOTENCY,
        ifMatch: IF_MATCH,
        fieldId: FIELD_ID,
      }),
    );

    for (const name of [
      'fieldId',
      'targetKind',
      'targetType',
      'projectionKey',
      'cardinality',
      'min',
      'max',
      'ordered',
      'onUnavailable',
    ]) {
      expect(markup).toContain(`name="${name}"`);
    }
    expect(markup).toContain(`name="if-match"`);
    expect(markup).toContain(`value="${FIELD_ID}"`);
    expect(markup).not.toContain('releaseDigest');
  });

  it('renders CMS-03A-04 confirmation fields and no release-worker controls', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ContentSchemaRegistryActivationForm, {
        action: `/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}`,
        contentTypeId: TYPE_ID,
        versionId: VERSION_ID,
        csrfToken: CSRF,
        idempotencyKey: IDEMPOTENCY,
        ifMatch: IF_MATCH,
        expectedVersion: '4',
        dryRunId: '018f0c45-73fe-7dc2-9c09-68f7ecf132dc',
        approvalIds: ['018f0c45-73fe-7dc2-9c09-68f7ecf132dd'],
      }),
    );

    for (const name of [
      'expectedVersion',
      'dryRunId',
      'approvalIds',
      'expectedActivationEvidenceHash',
      'migrationPlanId',
      'csrf',
      'idempotency-key',
      'if-match',
    ]) {
      expect(markup).toContain(`name="${name}"`);
    }
    expect(markup).toContain('Confirm schema activation');
    expect(markup).toContain(
      'Activation affects the selected content type version',
    );
    expect(markup).not.toContain('X-WeJammin-Release');
  });

  it('renders no step-up token or password field; step-up is session-based (DEC-111)', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ContentSchemaRegistryActivationForm, {
        action: `/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}`,
        contentTypeId: TYPE_ID,
        versionId: VERSION_ID,
        csrfToken: CSRF,
        idempotencyKey: IDEMPOTENCY,
        ifMatch: IF_MATCH,
        expectedVersion: '4',
        dryRunId: '018f0c45-73fe-7dc2-9c09-68f7ecf132dc',
        approvalIds: ['018f0c45-73fe-7dc2-9c09-68f7ecf132dd'],
      }),
    );
    expect(markup).not.toContain('stepUpToken');
    expect(markup).not.toContain('step-up-token');
    expect(markup).not.toMatch(/type="password"/u);
    expect(markup).not.toMatch(
      /autoComplete="one-time-code"|autocomplete="one-time-code"/u,
    );
  });

  it('keeps capability, pending, confirmation, offline, and conflict semantics explicit', () => {
    const hidden = renderToStaticMarkup(
      React.createElement(CapabilityGate, {
        surface: 'content-schema-registry',
        variant: 'not-rendered',
        reasonCode: 'FORBIDDEN',
      }),
    );
    expect(hidden).toBe('');

    const disabled = renderToStaticMarkup(
      React.createElement(CapabilityGate, {
        surface: 'content-schema-registry',
        variant: 'disabled',
        reasonCode: 'SCHEMA_DESIGNER_REQUIRED',
        recoveryHref: '/app/security',
      }),
    );
    expect(disabled).toContain('SCHEMA_DESIGNER_REQUIRED');
    expect(disabled).toContain('/app/security');

    const actionBar = renderToStaticMarkup(
      React.createElement(ContentSchemaRegistryActionBar, {
        formId: 'activation-form',
        operationId: 'CMS-03A-04',
        expectedVersion: '4',
        state: 'pending',
        consequence: 'The selected draft becomes active.',
      }),
    );
    expect(actionBar).toContain('Saving schema activation');
    expect(actionBar).toContain('form="activation-form"');
    expect(actionBar).toContain('The selected draft becomes active.');

    const confirmation = renderToStaticMarkup(
      React.createElement(ContentSchemaRegistryConfirmationStep, {
        consequence: 'The selected draft becomes active.',
        affectedScope: 'content type release_note',
        expectedVersion: '4',
        stepUpState: 'required',
        idempotencyKey: IDEMPOTENCY,
      }),
    );
    expect(confirmation).toContain('Escape cancels before commit');
    expect(confirmation).toContain(IDEMPOTENCY);
    expect(confirmation).toContain('Step-up required before commit');

    const offline = renderToStaticMarkup(
      React.createElement(ContentSchemaRegistryOfflineStatus, {
        connectivity: 'offline',
        intents: 0,
        serverVersion: '4',
        localVersion: '4',
      }),
    );
    expect(offline).toContain('Canonical registry reads are unavailable');
    expect(offline).toContain('No registry intent was retained');

    const conflict = renderToStaticMarkup(
      React.createElement(ContentSchemaRegistrySyncConflict, {
        serverVersion: '5',
        localVersion: '4',
        onReviewLabel: 'Review current version',
      }),
    );
    expect(conflict).toContain('No registry draft was overwritten');
    expect(conflict).toContain('Server version:');
    expect(conflict).toContain('Review current version');
  });
});
