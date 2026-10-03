// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CapabilityGate from '../infrastructure/CapabilityGate';
import ContentSchemaRegistryWorkbench from './ContentSchemaRegistryWorkbench';
import ContentSchemaRegistryWorkbenchIsland from './ContentSchemaRegistryWorkbenchIsland';
import {
  islandPropsFixture,
  workbenchProps,
} from './content-schema-registry-island-refetch.test-support';
import type {
  ContentSchemaRegistryAccess,
  ContentSchemaRegistryVariant,
} from './content-schema-registry-types';

/**
 * FE00/FE03 CapabilityGate copy: the gate states the situation in its own
 * copy and shows a reason only when the server gave a typed code. A
 * presentation variant name (`ownerFull`, `entitledRead`, ...) is how the
 * server chose to present the page, never a reason, and must not reach the
 * person. Defect: a disabled registry gate printed "Reason: ownerFull".
 */

const VARIANTS: readonly ContentSchemaRegistryVariant[] = [
  'degradedPage',
  'entitledRead',
  'ownerFull',
  'guardianMandate',
  'juniorRestricted',
  'businessMandate',
  'staffCaseScoped',
  'adminStepUp',
  'schemaReviewAssigned',
  'forbiddenHidden',
  'disabledPrerequisite',
];

const gateOf = (markup: string): HTMLElement | null =>
  new DOMParser()
    .parseFromString(`<body>${markup}</body>`, 'text/html')
    .querySelector<HTMLElement>('.content-schema-registry-capability-gate');

const workbench = (
  access: ContentSchemaRegistryAccess,
  variant: ContentSchemaRegistryVariant,
): string =>
  renderToStaticMarkup(
    <ContentSchemaRegistryWorkbench {...workbenchProps({ access, variant })} />,
  );

const island = (
  access: ContentSchemaRegistryAccess,
  variant: ContentSchemaRegistryVariant,
): string =>
  renderToStaticMarkup(
    <ContentSchemaRegistryWorkbenchIsland
      {...islandPropsFixture({ access, variant })}
    />,
  );

describe('[P2-S09-AC-237] registry capability gate states a situation, never a presentation variant', () => {
  for (const variant of VARIANTS) {
    for (const [name, render] of [
      ['workbench', workbench],
      ['island', island],
    ] as const) {
      it(`[P2-S09-AC-237] ${name} gate for ${variant} never prints the variant as a reason`, () => {
        for (const access of ['read-only', 'disabled'] as const) {
          const gate = gateOf(render(access, variant));
          // A review-only page deliberately shows no read-only gate.
          if (variant === 'schemaReviewAssigned' && access === 'read-only')
            continue;
          expect(gate, `${access} renders a gate`).not.toBeNull();
          expect(gate?.textContent).not.toContain(variant);
          expect(gate?.getAttribute('data-reason-code')).not.toBe(variant);
        }
      });
    }
  }

  it('[P2-S09-AC-237] a disabled gate names the typed unavailability code and the spec copy', () => {
    const gate = gateOf(island('disabled', 'ownerFull'));
    expect(gate?.getAttribute('data-variant')).toBe('disabled');
    expect(gate?.getAttribute('data-reason-code')).toBe(
      'SCHEMA_REGISTRY_UNAVAILABLE',
    );
    expect(gate?.querySelector('h3')?.textContent).toBe(
      'Schema changes unavailable',
    );
    expect(gate?.textContent).toContain(
      'A server capability prerequisite is not satisfied.',
    );
    expect(gate?.textContent).toContain('Reason: SCHEMA_REGISTRY_UNAVAILABLE');
  });

  it('[P2-S09-AC-237] a read-only gate states what stays available and shows no reason line', () => {
    const gate = gateOf(workbench('read-only', 'entitledRead'));
    expect(gate?.querySelector('h3')?.textContent).toBe(
      'Read-only registry access',
    );
    expect(gate?.textContent).toContain('cannot change schemas.');
    expect(gate?.textContent).not.toContain('Reason');
    expect(gate?.hasAttribute('data-reason-code')).toBe(false);
  });
});

describe('[P2-S09-AC-1127] one FE00 CapabilityGate for every surface', () => {
  const html = (props: Parameters<typeof CapabilityGate>[0]): string =>
    renderToStaticMarkup(<CapabilityGate {...props} />);

  it('[P2-S09-AC-1127] renders nothing for not-rendered and for full access on every surface', () => {
    for (const surface of [
      'infrastructure',
      'platform-configuration',
      'content-schema-registry',
    ] as const)
      for (const variant of ['not-rendered', 'full'] as const)
        expect(
          html({ variant, surface, reasonCode: 'FORBIDDEN', disclosure: 'x' }),
        ).toBe('');
  });

  it('[P2-S09-AC-1127] keeps each surface heading, level, class and focus target', () => {
    const expected = {
      infrastructure: [
        'infra-capability-gate',
        'capability-gate-heading',
        'H2',
        'Action unavailable',
      ],
      'platform-configuration': [
        'platform-configuration-capability-gate',
        'platform-configuration-capability-heading',
        'H2',
        'Action unavailable',
      ],
      'content-schema-registry': [
        'content-schema-registry-capability-gate',
        'content-schema-registry-capability-heading',
        'H3',
        'Schema changes unavailable',
      ],
    } as const;
    for (const surface of Object.keys(expected) as (keyof typeof expected)[]) {
      const dom = new DOMParser().parseFromString(
        `<body>${html({ variant: 'disabled', surface })}</body>`,
        'text/html',
      );
      const [className, headingId, tag, heading] = expected[surface];
      const section = dom.querySelector(`section.${className}`);
      expect(section?.getAttribute('role')).toBe('status');
      const title = dom.getElementById(headingId);
      expect(title?.tagName).toBe(tag);
      expect(title?.textContent).toBe(heading);
      expect(title?.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('[P2-S09-AC-1127] a limited variant names what stays readable and is not focusable', () => {
    const dom = new DOMParser().parseFromString(
      `<body>${html({ variant: 'read-only', surface: 'platform-configuration' })}</body>`,
      'text/html',
    );
    expect(dom.querySelector('h2')?.textContent).toBe('Access is limited');
    expect(dom.querySelector('h2')?.hasAttribute('tabindex')).toBe(false);
    expect(dom.body.textContent).toContain(
      'This context can read only the disclosed configuration projection.',
    );
  });

  it('[P2-S09-AC-1127] shows disclosure, a typed reason and a recovery link exactly as supplied', () => {
    const dom = new DOMParser().parseFromString(
      `<body>${html({
        variant: 'disabled',
        disclosure: 'Recent verification is required.',
        reasonCode: 'CAPABILITY_REQUIRED',
        recoveryHref: '/app/security',
        recoveryLabel: 'Open security settings',
      })}</body>`,
      'text/html',
    );
    expect(dom.body.textContent).toContain('Recent verification is required.');
    expect(dom.body.textContent).toContain('Reason code: CAPABILITY_REQUIRED');
    const link = dom.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/app/security');
    expect(link?.textContent).toBe('Open security settings');
  });
});
