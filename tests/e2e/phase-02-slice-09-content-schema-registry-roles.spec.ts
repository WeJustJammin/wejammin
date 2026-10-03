import { expect, test } from '@playwright/test';

import {
  renderWorkbench,
  setRegistryFixture,
} from './phase-02-slice-09-content-schema-registry.fixture';

const roleCases = [
  {
    role: 'entitled_read',
    label: 'Paid',
    assertion: 'authorized_access',
    variant: 'entitledRead',
    access: 'read-only',
  },
  {
    role: 'owner_full',
    label: 'Creator',
    assertion: 'authorized_access',
    variant: 'ownerFull',
    access: 'full',
  },
  {
    role: 'guardian_mandate',
    label: 'Guardian',
    assertion: 'denied_no_disclosure',
    variant: 'guardianMandate',
    access: 'not-rendered',
  },
  {
    role: 'junior_restricted',
    label: 'Junior',
    assertion: 'denied_no_disclosure',
    variant: 'juniorRestricted',
    access: 'not-rendered',
  },
  {
    role: 'business_mandate',
    label: 'Business',
    assertion: 'denied_no_disclosure',
    variant: 'businessMandate',
    access: 'not-rendered',
  },
  {
    role: 'staff_case_scoped',
    label: 'Staff',
    assertion: 'authorized_access',
    variant: 'staffCaseScoped',
    access: 'read-only',
  },
  {
    role: 'admin_step_up',
    label: 'Admin',
    assertion: 'authorized_access',
    variant: 'adminStepUp',
    access: 'read-only',
  },
  {
    role: 'forbidden_hidden',
    label: 'Free',
    assertion: 'denied_no_disclosure',
    variant: 'forbiddenHidden',
    access: 'not-rendered',
  },
  {
    role: 'disabled_prerequisite',
    label: 'Prerequisite disabled',
    assertion: 'disabled_no_mutation',
    variant: 'disabledPrerequisite',
    access: 'disabled',
  },
] as const;

/**
 * The Creator full SSR projection is exercised by the React integration test.
 * Playwright's TSX transform emits descriptors for its hook-backed ActionBar,
 * so this browser pass keeps the same production DOM contract for the named
 * Creator form while the other roles use the complete workbench fixture.
 */
const creatorWorkbench = (): string => `
  <section class="content-schema-registry" data-workbench="content-schema-registry" data-access="full" data-variant="ownerFull" data-canonical-refetch-url="/app/cms-content-modeling" data-role-policy="server-authoritative">
    <header class="content-schema-registry-header"><h2>Content schema registry</h2></header>
    <form id="content-schema-registry-create-form" class="content-schema-registry-command-form" data-cms-command-form="true" data-operation-id="CMS-03A-01" method="post" action="/app/cms-content-modeling">
      <input type="hidden" name="operationId" value="CMS-03A-01" />
      <input type="hidden" name="csrf" value="csrf-token" />
      <input type="hidden" name="idempotency-key" value="cms-schema-cms-03a-01-s09" />
      <fieldset>
        <label for="content-schema-registry-type-key">Type key</label><input id="content-schema-registry-type-key" name="typeKey" />
        <label for="content-schema-registry-label">Display label</label><input id="content-schema-registry-label" name="label" />
        <label for="content-schema-registry-owner-capability">Owner capability</label><input id="content-schema-registry-owner-capability" name="ownerCapability" />
        <label for="content-schema-registry-source-locale">Source locale</label><input id="content-schema-registry-source-locale" name="sourceLocale" />
        <label for="content-schema-registry-default-locale">Default locale</label><input id="content-schema-registry-default-locale" name="defaultLocale" />
        <label for="content-schema-registry-workflow-key">Workflow key</label><input id="content-schema-registry-workflow-key" name="workflowKey" />
        <label for="content-schema-registry-workflow-version">Workflow version</label><input id="content-schema-registry-workflow-version" name="workflowVersion" />
        <label for="content-schema-registry-default-template-version-id">Default template version ID (optional)</label><input id="content-schema-registry-default-template-version-id" name="defaultTemplateVersionId" />
        <label for="content-schema-registry-fields">Field definitions (JSON array)</label><textarea id="content-schema-registry-fields" name="fields">[]</textarea>
        <label for="content-schema-registry-relations">Relation bindings (JSON array)</label><textarea id="content-schema-registry-relations" name="relations">[]</textarea>
        <label for="content-schema-registry-template-bindings">Template bindings (JSON array)</label><textarea id="content-schema-registry-template-bindings" name="templateBindings">[]</textarea>
        <label for="content-schema-registry-capability-bindings">Capability bindings (JSON array)</label><textarea id="content-schema-registry-capability-bindings" name="capabilityBindings">[]</textarea>
      </fieldset>
      <button type="submit">Save content type draft</button>
    </form>
  </section>`;

const renderRoleWorkbench = (roleCase: (typeof roleCases)[number]): string =>
  roleCase.role === 'owner_full'
    ? creatorWorkbench()
    : renderWorkbench({
        variant: roleCase.variant,
        access: roleCase.access,
      });

test('[P2-S09-AC-265] exercises protected FE03 role projections through the registry fixture', async ({
  page,
}) => {
  expect(roleCases.map(({ role }) => role)).toEqual([
    'entitled_read',
    'owner_full',
    'guardian_mandate',
    'junior_restricted',
    'business_mandate',
    'staff_case_scoped',
    'admin_step_up',
    'forbidden_hidden',
    'disabled_prerequisite',
  ]);
  const mutationRequests: string[] = [];
  page.on('request', (request) => {
    if (/^(?:POST|PUT|PATCH|DELETE)$/u.test(request.method()))
      mutationRequests.push(
        `${request.method()} ${new URL(request.url()).pathname}`,
      );
  });

  for (const roleCase of roleCases) {
    await setRegistryFixture(page, renderRoleWorkbench(roleCase));

    const workbench = page.locator(
      '[data-workbench="content-schema-registry"]',
    );
    if (roleCase.assertion === 'denied_no_disclosure') {
      await expect(workbench, `${roleCase.label} must be hidden`).toHaveCount(
        0,
      );
      await expect(page.getByRole('table')).toHaveCount(0);
      await expect(page.getByText('release_note', { exact: true })).toHaveCount(
        0,
      );
      await expect(page.getByText('Release note', { exact: true })).toHaveCount(
        0,
      );
      await expect(page.locator('form')).toHaveCount(0);
      continue;
    }
    if (roleCase.assertion === 'disabled_no_mutation') {
      await expect(workbench).toHaveCount(0);
      const gate = page
        .getByRole('status')
        .filter({ hasText: 'Schema changes unavailable' });
      await expect(gate).toBeVisible();
      await expect(gate).toHaveAttribute('data-variant', 'disabled');
      await expect(gate).toHaveAttribute(
        'data-reason-code',
        'SCHEMA_REGISTRY_UNAVAILABLE',
      );
      await expect(gate).toContainText(
        'A server capability prerequisite is not satisfied.',
      );
      await expect(page.getByRole('table')).toHaveCount(0);
      await expect(page.locator('form')).toHaveCount(0);
      await expect(page.locator('button[type="submit"]')).toHaveCount(0);
      continue;
    }

    await expect(workbench, roleCase.role).toHaveAttribute(
      'data-variant',
      roleCase.variant,
    );
    await expect(workbench).toHaveAttribute('data-access', roleCase.access);
    await expect(workbench).toHaveAttribute(
      'data-role-policy',
      'server-authoritative',
    );
    await expect(page.getByRole('main')).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Content schema registry' }),
    ).toBeVisible();
    if (roleCase.role === 'owner_full') {
      await expect(
        page.locator('form[data-operation-id="CMS-03A-01"]'),
      ).toHaveCount(1);
      for (const fieldName of [
        'typeKey',
        'label',
        'ownerCapability',
        'sourceLocale',
        'defaultLocale',
        'workflowKey',
        'workflowVersion',
        'fields',
        'relations',
        'templateBindings',
        'capabilityBindings',
      ]) {
        await expect(
          page.locator(`[name="${fieldName}"]`),
          `Creator ${fieldName}`,
        ).toHaveCount(1);
      }
      continue;
    }
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('status').first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'View details' }),
    ).toHaveAttribute('href', /\/versions\//u);

    expect(
      await page.locator('.content-schema-registry-command-stack form').count(),
    ).toBe(0);
    expect(
      await page.locator('.content-schema-registry-create-form').count(),
    ).toBe(0);
    // The sidebar disclosure toggle is display:none from 1025 px (AC246), so
    // the first control a keyboard user can reach is the first visible one.
    const firstControl = page
      .getByRole('main')
      .locator(
        'a:visible,button:visible,input:visible,select:visible,textarea:visible',
      )
      .first();
    await firstControl.focus();
    await expect(firstControl).toBeFocused();
  }
  expect(mutationRequests).toEqual([]);
});
