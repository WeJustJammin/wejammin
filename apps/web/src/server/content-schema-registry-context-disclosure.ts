import { resolveContentSchemaRegistryActingContextLabel } from './content-schema-registry-acting-context';
import type {
  ContentSchemaRegistryAuthority,
  ContentSchemaRegistryPorts,
} from './content-schema-registry-context-types';

export interface ContentSchemaRegistryDisclosure {
  readonly now: number;
  readonly actingContextLabel?: string;
}

/**
 * Presentation-only disclosure. The label comes from the authorized identity
 * read and is matched on the trusted server acting party; any failure degrades
 * the disclosure rather than the protected read, and no identifier ever
 * reaches the page projection.
 */
export const resolveContentSchemaRegistryDisclosure = async (input: {
  readonly request: Request;
  readonly ports: ContentSchemaRegistryPorts;
  readonly authority: ContentSchemaRegistryAuthority;
  readonly now: () => number;
}): Promise<ContentSchemaRegistryDisclosure> => {
  const now = input.now();
  const actingPartyId =
    'actingPartyId' in input.authority ? input.authority.actingPartyId : null;
  const loadActingContexts = input.ports.loadActingContexts;
  const actingContextLabel =
    actingPartyId !== null && loadActingContexts !== undefined
      ? await resolveContentSchemaRegistryActingContextLabel({
          actingPartyId,
          now,
          fetchActingContexts: () =>
            Promise.resolve(loadActingContexts({ request: input.request })),
        })
      : null;
  return {
    now,
    ...(actingContextLabel === null ? {} : { actingContextLabel }),
  };
};
