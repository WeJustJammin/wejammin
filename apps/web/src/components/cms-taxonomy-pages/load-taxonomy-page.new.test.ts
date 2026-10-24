import { readFileSync } from 'node:fs';

import { CmsLineageIdSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { TAXONOMY_ID } from '../../server/cms-taxonomy-platform.test-support';
import { TAXONOMY_PROBE_ID, loadTaxonomyPage } from './load-taxonomy-page';
import {
  failure,
  request,
  reads,
  termsOk,
  versionsOk,
} from './load-taxonomy-page.test-support';
import type { TaxonomyPageReads } from './taxonomy-page-reads';

const VALID_UUID_MIGRATION =
  '../../../../../supabase/migrations/20260902080000_content_schema_registry_authority.sql';

/** The `cms_valid_uuid` grammar exactly as the SQL producer enforces it (read, never copied). */
const producerUuidGrammar = (): RegExp => {
  const sql = readFileSync(
    new URL(VALID_UUID_MIGRATION, import.meta.url),
    'utf8',
  );
  const body =
    /function platform_private\.cms_valid_uuid[\s\S]*?\$body\$([\s\S]*?)\$body\$/.exec(
      sql,
    );
  const grammar = /p_value ~ '([^']+)'/.exec(body?.[1] ?? '');
  if (grammar?.[1] === undefined)
    throw new Error('cms_valid_uuid grammar not found');
  return new RegExp(grammar[1]);
};

/**
 * The producer's answer to the curator's lineage read (BE03c; `20261014030400_cms_list_taxonomy_versions`):
 * capability first, then `cms_valid_uuid` (INVALID_REQUEST 400), then the lookup (absent lineage 404).
 * The stub is faithful so a probe id the producer would refuse cannot pass as a curator.
 */
const curatorProducer =
  (grammar: RegExp) =>
  async (_request: Request, id: string): Promise<Response> =>
    grammar.test(id) ? failure(404) : failure(400);

describe('loadTaxonomyPage: the probe id of a new vocabulary', () => {
  it('passes the cms_valid_uuid grammar read from the migration (a nil id does not)', () => {
    const grammar = producerUuidGrammar();
    expect(grammar.test(TAXONOMY_PROBE_ID)).toBe(true);
    expect(grammar.test('00000000-0000-0000-0000-000000000000')).toBe(false);
    expect(grammar.test(TAXONOMY_ID)).toBe(true);
  });

  it('is a lineage id the Web proxy and the Worker contract accept', () => {
    expect(CmsLineageIdSchema.safeParse(TAXONOMY_PROBE_ID).success).toBe(true);
  });

  it('is a verified curator view when the producer answers the probe as it does for an absent lineage', async () => {
    const outcome = await loadTaxonomyPage({
      request: request('/app/cms-content-modeling/taxonomies/new'),
      taxonomyId: null,
      reads: {
        versions: curatorProducer(producerUuidGrammar()),
        terms: vi.fn(async () => termsOk()),
      },
    });
    expect(outcome.kind).toBe('view');
  });
});

describe('loadTaxonomyPage: a new vocabulary', () => {
  const load = (stub: TaxonomyPageReads) =>
    loadTaxonomyPage({
      request: request('/app/cms-content-modeling/taxonomies/new'),
      taxonomyId: null,
      reads: stub,
    });

  it('proves session and curator authority with a read of the reserved probe lineage and serves only the CSRF token', async () => {
    const stub = reads(failure(404));
    const outcome = await load(stub);
    if (outcome.kind !== 'view') throw new Error('expected a view');
    expect(outcome.status).toBe(200);
    expect(outcome.view).toEqual({
      mode: 'create',
      csrfToken: 'csrf-token-1',
      latest: null,
      versions: [],
      vocabulary: null,
      terms: null,
      query: { lifecycle: null, cursor: null },
      basePath: '/app/cms-content-modeling/taxonomies/new',
      panel: null,
    });
    expect(stub.versions).toHaveBeenCalledWith(
      expect.any(Request),
      TAXONOMY_PROBE_ID,
    );
    expect(stub.terms).not.toHaveBeenCalled();
  });

  it('redirects an expired session to sign-in and back to the new-vocabulary page', async () => {
    expect(await load(reads(failure(401)))).toEqual({
      kind: 'redirect',
      location:
        '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling%2Ftaxonomies%2Fnew',
    });
  });

  it('is the curator capability gate when the probe is refused with 403', async () => {
    const outcome = await load(reads(failure(403)));
    expect(outcome.kind).toBe('notice');
    if (outcome.kind !== 'notice') return;
    expect(outcome.notice.status).toBe(403);
    expect(outcome.notice.message).toContain('Vocabulary curator access');
  });

  it.each([429, 503])('shows one closed notice for a %i', async (status) => {
    const outcome = await load(reads(failure(status, { 'retry-after': '9' })));
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(status);
  });

  it.each([400, 500])(
    'does not treat a %i from the probe as a curator pass',
    async (status) => {
      const outcome = await load(reads(failure(status)));
      expect(outcome.kind).toBe('notice');
    },
  );

  it('renders nothing from a probe that answered 200', async () => {
    const outcome = await load(reads(versionsOk()));
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(502);
  });
});
