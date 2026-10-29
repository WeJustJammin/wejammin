/**
 * Valid requests for the Slice 12 taxonomy, pattern, related-content, locale-variant and
 * composition-instance operations (BE03c CMS-03C-02/03/05/12..17 and the cms*Read routes) whose
 * caller is resolved by `cms_actor` -> `cfg_actor` (family `cfg-actor`). Every one is executable
 * by service_role only (the Worker), so the gate class is `service-role`.
 *
 * Every member the function checks before it resolves the caller is present and well formed
 * (the whole envelope for `cms_apply_pattern_update`, `cms_pattern_latest`, `cms_get_instance_update_diff`,
 * `cms_list_taxonomy_terms` and `cms_list_taxonomy_selector`, which validate it before the actor), so the
 * identity gate is the first thing that can refuse the request. The post-gate outcome for a real
 * caller (a real auth user with no person, named by service_role or not) is the function's own
 * next domain step, read from the live private body. For all sixteen it is NOT_FOUND:
 *   - the taxonomy and pattern commands and reads (`cms_act_taxonomy_term`,
 *     `cms_create_taxonomy_version`, `cms_list_taxonomy_versions`, `cms_list_taxonomy_terms`,
 *     `cms_list_taxonomy_selector`, `cms_create_pattern_version`, `cms_pattern_latest`,
 *     `cms_list_pattern_selector`, `cms_list_pattern_nestable`) resolve the caller's person and owner-party visibility before
 *     any capability check, and a caller with no person cannot read the owner party: concealed
 *     NOT_FOUND;
 *   - the entry and instance operations (`cms_curate_related_content`, `cms_get_related_content`,
 *     `cms_insert_pattern_instance`, `cms_get_instance_update_diff`, `cms_apply_pattern_update`,
 *     `cms_get_locale_variant`, `cms_list_composition_instances`) look the entry, revision or
 *     instance up by the id in the request, which names no row: concealed NOT_FOUND.
 * None of these is a request-validation refusal, and none reaches the idempotency reservation,
 * so no probe persists anything and a repeat answers identically.
 */
import {
  IDEMPOTENCY_KEY,
  id,
  type FixtureTable,
} from './claim-gate-fixtures-types';

const NOT_FOUND = '400:NOT_FOUND';

export const CMS_COMPOSITION_FIXTURES: FixtureTable = {
  // CMS-03C-03: any object passes the pre-gate check; the full eight-member action body is sent.
  cms_act_taxonomy_term: {
    request: {
      taxonomyId: id(42),
      action: 'create',
      termKey: 'gate-probe',
      parentId: null,
      survivorId: null,
      labels: [{ locale: 'en', label: 'Gate probe' }],
      aliases: [],
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: NOT_FOUND,
  },
  // CMS-03C-16 (first version: expectedVersion null, no ifMatch).
  cms_create_taxonomy_version: {
    request: {
      taxonomyKey: 'gate-probe',
      shape: 'flat',
      allowedTypeKeys: ['article'],
      allowedFieldKeys: ['topic'],
      canonicalOverlapDomains: [],
      expectedVersion: null,
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: NOT_FOUND,
  },
  // cmsTaxonomyVersionsRead: { taxonomyId } only (checked after the person/capability steps).
  cms_list_taxonomy_versions: {
    request: { taxonomyId: id(42) },
    real: NOT_FOUND,
  },
  // cmsTaxonomyTermsRead: the exact-key envelope is checked BEFORE the actor, taxonomyId is a UUID.
  cms_list_taxonomy_terms: { request: { taxonomyId: id(42) }, real: NOT_FOUND },
  // CMS-03C-17: the exact-key envelope is checked BEFORE the actor; values are checked after.
  cms_list_taxonomy_selector: {
    request: { typeKey: 'article', fieldKey: 'topic', locale: 'en' },
    real: NOT_FOUND,
  },
  // CMS-03C-05: envelope, pins, exclusions and derivedRule schema are checked after the actor.
  cms_curate_related_content: {
    request: {
      entryId: id(7),
      pins: [],
      exclusions: [],
      derivedRule: null,
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: NOT_FOUND,
  },
  // cmsRelatedContentRead (DEC-195): { entryId }, a UUID checked after the actor.
  cms_get_related_content: { request: { entryId: id(7) }, real: NOT_FOUND },
  // CMS-03C-12 (first version: expectedVersion null, no ifMatch).
  cms_create_pattern_version: {
    request: {
      patternKey: 'gate-probe',
      compatibleTypeIds: [id(1)],
      blockTree: [],
      expectedVersion: null,
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: NOT_FOUND,
  },
  // cmsPatternLatestRead: the exact { patternKey, context } envelope is checked BEFORE the actor.
  cms_pattern_latest: {
    request: { patternKey: 'gate-probe' },
    real: NOT_FOUND,
  },
  // CMS-03C-02: cms_pattern_placement_check passes (exact envelope, slotPath '/', overrides {}).
  cms_insert_pattern_instance: {
    request: {
      revisionId: id(8),
      patternId: id(43),
      patternVersion: 1,
      linkMode: 'detached',
      slotPath: '/',
      overrides: {},
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: NOT_FOUND,
  },
  // cmsPatternNestableRead (DEC-196, DEC-232): as CMS-03C-13, the actor is resolved first; contentTypeId is the array of 1-64 unique UUIDs.
  cms_list_pattern_nestable: {
    request: { contentTypeId: [id(1)] },
    real: NOT_FOUND,
  },
  // CMS-03C-13: the envelope and contentTypeId are checked after the actor, before concealment.
  cms_list_pattern_selector: {
    request: { contentTypeId: id(1) },
    real: NOT_FOUND,
  },
  // CMS-03C-14: the exact { instanceId, context } envelope is checked BEFORE the actor.
  cms_get_instance_update_diff: {
    request: { instanceId: id(44) },
    real: NOT_FOUND,
  },
  // CMS-03C-15: cms_pattern_update_check runs BEFORE the actor and passes for this accept request.
  cms_apply_pattern_update: {
    request: {
      action: 'accept',
      targetPatternVersion: 2,
      instances: [{ instanceId: id(44), expectedVersion: '1' }],
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: NOT_FOUND,
  },
  // cmsLocaleVariantRead (DEC-205): entryId and locale are checked after the actor, before the lookup.
  cms_get_locale_variant: {
    request: { entryId: id(7), locale: 'fr' },
    real: NOT_FOUND,
  },
  // cmsCompositionInstancesRead (DEC-206): entryId (UUID) is checked after the actor, before the lookup.
  cms_list_composition_instances: {
    request: { entryId: id(7) },
    real: NOT_FOUND,
  },
};
