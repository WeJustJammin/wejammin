import {
  platformRegistrySet,
  SessionResourceSchema,
  TemplateDesignerContextSchema,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../infra/openapi-document.mjs';

/**
 * FE03 1129 (`cmsTemplateContextRead`): "It does not extend the general auth-session resource or
 * grant designer authority in the browser." The general auth-session resource is
 * `SessionResource` (authSessionRead and authSessionRefresh); the picker context is
 * `TemplateDesignerContext`. The two share no member, the session resource carries no CMS or
 * capability member, and the context carries no authority member.
 */
type Schema = Readonly<{
  properties: Readonly<Record<string, unknown>>;
  required?: readonly string[];
  additionalProperties?: boolean;
}>;
type Document = Readonly<{
  components: Readonly<{ schemas: Readonly<Record<string, Schema>> }>;
  paths: Readonly<
    Record<
      string,
      Readonly<
        Record<
          string,
          Readonly<{
            responses: Readonly<
              Record<
                string,
                Readonly<{
                  content?: Readonly<{
                    'application/json'?: Readonly<{ schema?: unknown }>;
                  }>;
                }>
              >
            >;
          }>
        >
      >
    >
  >;
}>;
const document = buildOpenApiDocument() as Document;
const SESSION_MEMBERS = [
  'accountState',
  'actingPartyId',
  'authenticated',
  'bootstrapState',
  'personId',
  'sessionExpiresAt',
];
const AUTHORITY_WORD =
  /cms|designer|capabilit|template|permission|grant|role/iu;

const session = {
  authenticated: true,
  accountState: 'active',
  bootstrapState: 'complete',
  personId: '44444444-4444-4444-8444-444444444444',
  actingPartyId: '44444444-4444-4444-8444-444444444444',
  sessionExpiresAt: '2026-09-01T05:00:00Z',
} as const;
const context = { contentTypes: [], registeredBlocks: [] } as const;

describe('Slice 12 template picker context and the general auth-session resource', () => {
  it('[P2-S12-AC-164] the session resource is exactly the six authentication members and names no CMS, designer or capability member', () => {
    const schema = document.components.schemas.SessionResource!;
    expect(Object.keys(schema.properties).sort()).toEqual(SESSION_MEMBERS);
    expect([...(schema.required ?? [])].sort()).toEqual(SESSION_MEMBERS);
    expect(schema.additionalProperties).toBe(false);
    expect(
      Object.keys(schema.properties).filter((key) => AUTHORITY_WORD.test(key)),
    ).toEqual([]);
  });

  it.each([
    ['capabilities', ['cms.template_designer']],
    ['cmsCapabilities', ['cms.template_designer']],
    ['templateDesigner', true],
    ['cmsTemplateContext', context],
    ['contentTypes', []],
  ])(
    '[P2-S12-AC-164] the session resource refuses a %s member instead of extending itself',
    (member, value) => {
      expect(SessionResourceSchema.safeParse(session).success).toBe(true);
      expect(
        SessionResourceSchema.safeParse({ ...session, [member]: value })
          .success,
      ).toBe(false);
    },
  );

  it('[P2-S12-AC-164] authSessionRead and authSessionRefresh answer SessionResource and carry no designer capability, while the context read is the one protected route that does', () => {
    for (const operationId of ['authSessionRead', 'authSessionRefresh']) {
      const route = platformRegistrySet.routes.find(
        (candidate) => candidate.operationId === operationId,
      );
      expect(route?.successSchema).toBe('SessionResourceSchema');
      expect(route?.capability).toBeUndefined();
    }
    const read = document.paths['/api/v1/auth/session']?.get;
    expect(
      read?.responses['200']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/SessionResource' });
    const contextRoute = platformRegistrySet.routes.find(
      ({ operationId }) => operationId === 'cmsTemplateContextRead',
    );
    expect(contextRoute?.successSchema).toBe('TemplateDesignerContextSchema');
    expect(contextRoute?.capability).toBe('cms.template_designer');
  });

  it('[P2-S12-AC-164] the picker context is exactly its two selector members and shares no member with the session resource', () => {
    const schema = document.components.schemas.TemplateDesignerContext!;
    expect(Object.keys(schema.properties).sort()).toEqual([
      'contentTypes',
      'registeredBlocks',
    ]);
    expect(schema.additionalProperties).toBe(false);
    expect(
      Object.keys(schema.properties).filter((key) =>
        SESSION_MEMBERS.includes(key),
      ),
    ).toEqual([]);
  });

  it.each([
    ['capabilities', ['cms.template_designer']],
    ['canDefine', true],
    ['designer', true],
    ['authenticated', true],
    ['actingPartyId', '44444444-4444-4444-8444-444444444444'],
    ['ownerId', '44444444-4444-4444-8444-444444444444'],
  ])(
    '[P2-S12-AC-164] the picker context refuses an authority or session member %s so it can grant no designer authority in the browser',
    (member, value) => {
      expect(TemplateDesignerContextSchema.safeParse(context).success).toBe(
        true,
      );
      expect(
        TemplateDesignerContextSchema.safeParse({
          ...context,
          [member]: value,
        }).success,
      ).toBe(false);
    },
  );
});
