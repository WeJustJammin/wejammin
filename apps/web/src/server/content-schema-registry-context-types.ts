import { z } from 'zod';

import { ContentSchemaRegistryListQuerySchema } from './content-schema-registry-contracts';
import { CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS } from '@wejammin/contracts';

type Awaitable<T> = T | Promise<T>;

export const SessionSchema = z.union([
  z
    .object({
      userId: z.uuid(),
      expiresAt: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      serverVerified: z.literal(true),
      expiresAt: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      serverVerified: z.literal(true),
      userId: z.uuid(),
      expiresAt: z.number().int().nonnegative(),
    })
    .strict(),
]);

export const AuthoritySchema = z.union([
  z
    .object({
      actingPartyId: z.uuid(),
      capabilities: z.array(z.string().min(1).max(128)).max(64),
      presentationVariant: z
        .enum(CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS)
        .optional(),
      /** Trusted private projection metadata; used for disclosure only. */
      stepUpFreshUntil: z.string().optional(),
    })
    .strict(),
  z
    .object({
      serverVerified: z.literal(true),
      capabilities: z.array(z.string().min(1).max(128)).max(64),
      presentationVariant: z
        .enum(CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS)
        .optional(),
      stepUpFreshUntil: z.string().optional(),
    })
    .strict(),
]);

export const UuidSchema = z.uuid();
export const ReadCapabilities = new Set([
  'cms.schema_registry.read',
  'cms.schema_designer',
]);

export type ContentSchemaRegistrySession = z.infer<typeof SessionSchema>;
export type ContentSchemaRegistryAuthority = z.infer<typeof AuthoritySchema>;

export interface ContentSchemaRegistryPorts {
  readonly verifySession: (request: Request) => Awaitable<unknown>;
  readonly now: () => Awaitable<number>;
  readonly resolveAuthority: (input: {
    readonly request: Request;
    readonly session: ContentSchemaRegistrySession;
    readonly route: 'list' | 'detail';
    readonly contentTypeId: string | null;
    readonly versionId: string | null;
  }) => Awaitable<unknown>;
  readonly loadList: (input: {
    readonly request: Request;
    readonly session: ContentSchemaRegistrySession;
    readonly authority: ContentSchemaRegistryAuthority;
    readonly query: z.infer<typeof ContentSchemaRegistryListQuerySchema>;
  }) => Awaitable<unknown>;
  readonly loadDetail: (input: {
    readonly request: Request;
    readonly session: ContentSchemaRegistrySession;
    readonly authority: ContentSchemaRegistryAuthority;
    readonly contentTypeId: string;
    readonly versionId: string;
  }) => Awaitable<unknown>;
  /**
   * Server-only read of the authorized acting-context list, used solely to
   * resolve a human-readable context label for disclosure. It carries no
   * authority and its identifiers never reach the browser projection.
   */
  readonly loadActingContexts?: (input: {
    readonly request: Request;
  }) => Awaitable<Response>;
}
