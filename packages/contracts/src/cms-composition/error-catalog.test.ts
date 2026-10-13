import { describe, expect, it } from 'vitest';

import {
  CMS_03C_CATALOGS,
  CMS_03C_OPERATION_CATALOG,
  cmsCompositionCatalogCode,
  cmsCompositionCatalogMessage,
} from './error-catalog';

const STATUSES = [400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504];

describe('BE03c normative application error catalog', () => {
  it('[P2-S12-AC-008] names the six catalogs with their exact ids and operation tokens', () => {
    expect(
      Object.fromEntries(
        Object.entries(CMS_03C_CATALOGS).map(([key, value]) => [
          key,
          [value.id, value.operationToken],
        ]),
      ),
    ).toEqual({
      template: ['cms.03c.template.v1', 'template'],
      composition: ['cms.03c.composition.v1', 'composition'],
      taxonomy: ['cms.03c.taxonomy.v1', 'taxonomy'],
      locale: ['cms.03c.locale.v1', 'locale'],
      relatedContent: ['cms.03c.related-content.v1', 'related-content'],
      governedReview: ['cms.03c.governed-review.v1', 'governed-review'],
    });
  });

  it('[P2-S12-AC-008] maps every status to the exact catalog code and never uses a status as a code', () => {
    const expected = {
      template: {
        403: 'TEMPLATE_FORBIDDEN',
        404: 'TEMPLATE_NOT_FOUND',
        409: 'TEMPLATE_VERSION_CONFLICT',
        422: 'TEMPLATE_VALIDATION_FAILED',
      },
      composition: {
        403: 'COMPOSITION_FORBIDDEN',
        404: 'COMPOSITION_NOT_FOUND',
        409: 'COMPOSITION_VERSION_CONFLICT',
        422: 'COMPOSITION_VALIDATION_FAILED',
      },
      taxonomy: {
        403: 'TAXONOMY_FORBIDDEN',
        404: 'TAXONOMY_NOT_FOUND',
        409: 'TAXONOMY_VERSION_CONFLICT',
        422: 'TAXONOMY_VALIDATION_FAILED',
      },
      locale: {
        403: 'LOCALE_FORBIDDEN',
        404: 'LOCALE_SOURCE_NOT_FOUND',
        409: 'LOCALE_VERSION_CONFLICT',
        422: 'LOCALE_VALIDATION_FAILED',
      },
      relatedContent: {
        403: 'RELATED_CONTENT_FORBIDDEN',
        404: 'RELATED_CONTENT_NOT_FOUND',
        409: 'RELATED_CONTENT_VERSION_CONFLICT',
        422: 'RELATED_CONTENT_VALIDATION_FAILED',
      },
      governedReview: {
        403: 'GOVERNED_REVIEW_FORBIDDEN',
        404: 'GOVERNED_REVIEW_NOT_FOUND',
        409: 'GOVERNED_REVIEW_VERSION_CONFLICT',
        422: 'GOVERNED_REVIEW_VALIDATION_FAILED',
      },
    } as const;
    for (const [catalog, specific] of Object.entries(expected)) {
      const codes = (
        CMS_03C_CATALOGS as Record<
          string,
          { codes: Readonly<Record<number, string>> }
        >
      )[catalog]!.codes;
      expect(Object.keys(codes).map(Number).sort()).toEqual(STATUSES);
      for (const [status, code] of Object.entries(specific))
        expect(codes[Number(status)], `${catalog} ${status}`).toBe(code);
      expect(codes[400]).toBe('INVALID_REQUEST');
      expect(codes[415]).toBe('UNSUPPORTED_MEDIA_TYPE');
      expect(codes[429]).toBe('RATE_LIMITED');
      expect(codes[500]).toBe('INTERNAL_ERROR');
      // R1: 502, 503 and 504 are one code, DEPENDENCY_UNAVAILABLE (DEC-172).
      for (const status of [502, 503, 504])
        expect(codes[status]).toBe('DEPENDENCY_UNAVAILABLE');
    }
  });

  it('[P2-S12-AC-074] gives the governed-review catalog a distinct STEP_UP_REQUIRED 401 and every other catalog UNAUTHENTICATED', () => {
    expect(CMS_03C_CATALOGS.governedReview.codes[401]).toBe('UNAUTHENTICATED');
    expect(CMS_03C_CATALOGS.governedReview.stepUpCode).toBe('STEP_UP_REQUIRED');
    for (const [name, catalog] of Object.entries(CMS_03C_CATALOGS)) {
      expect(catalog.codes[401], name).toBe('UNAUTHENTICATED');
      if (name !== 'governedReview')
        expect('stepUpCode' in catalog, name).toBe(false);
    }
  });

  it('[P2-S12-AC-008] binds a message to "{CODE}: {operation} operation rejected or unavailable." with nothing interpolated', () => {
    expect(
      cmsCompositionCatalogMessage('template', 'TEMPLATE_VERSION_CONFLICT'),
    ).toBe(
      'TEMPLATE_VERSION_CONFLICT: template operation rejected or unavailable.',
    );
    expect(
      cmsCompositionCatalogMessage(
        'relatedContent',
        'RELATED_CONTENT_FORBIDDEN',
      ),
    ).toBe(
      'RELATED_CONTENT_FORBIDDEN: related-content operation rejected or unavailable.',
    );
    expect(
      cmsCompositionCatalogMessage('governedReview', 'STEP_UP_REQUIRED'),
    ).toBe(
      'STEP_UP_REQUIRED: governed-review operation rejected or unavailable.',
    );
    // A code outside the catalog is not a message that may be produced.
    expect(() =>
      cmsCompositionCatalogMessage('template', 'TAXONOMY_FORBIDDEN'),
    ).toThrow(/not in the template catalog/u);
    expect(() =>
      cmsCompositionCatalogMessage('template', 'DEPENDENCY_INVALID_RESPONSE'),
    ).toThrow(/not in the template catalog/u);
  });

  it('[P2-S12-AC-274] resolves an operation to its catalog, shared catalogs included', () => {
    expect(CMS_03C_OPERATION_CATALOG['CMS-03C-01']).toBe('template');
    expect(CMS_03C_OPERATION_CATALOG.cmsTemplateLatestRead).toBe('template');
    for (const id of [
      'CMS-03C-02',
      'CMS-03C-12',
      'CMS-03C-13',
      'CMS-03C-14',
      'CMS-03C-15',
      'cmsPatternLatestRead',
    ] as const)
      expect(CMS_03C_OPERATION_CATALOG[id], id).toBe('composition');
    for (const id of [
      'CMS-03C-03',
      'CMS-03C-16',
      'CMS-03C-17',
      'cmsTaxonomyVersionsRead',
      'cmsTaxonomyTermsRead',
    ] as const)
      expect(CMS_03C_OPERATION_CATALOG[id], id).toBe('taxonomy');
    expect(CMS_03C_OPERATION_CATALOG['CMS-03C-04']).toBe('locale');
    expect(CMS_03C_OPERATION_CATALOG['CMS-03C-05']).toBe('relatedContent');
    for (const id of [
      'CMS-03C-06',
      'CMS-03C-07',
      'CMS-03C-08',
      'CMS-03C-09',
      'CMS-03C-10',
      'CMS-03C-11',
    ] as const)
      expect(CMS_03C_OPERATION_CATALOG[id], id).toBe('governedReview');
    expect(Object.keys(CMS_03C_OPERATION_CATALOG)).toHaveLength(21);
  });

  it('[P2-S12-AC-274] resolves a status to the catalog code of an operation and refuses a status outside the catalog', () => {
    expect(cmsCompositionCatalogCode('CMS-03C-07', 409)).toBe(
      'GOVERNED_REVIEW_VERSION_CONFLICT',
    );
    expect(cmsCompositionCatalogCode('CMS-03C-12', 422)).toBe(
      'COMPOSITION_VALIDATION_FAILED',
    );
    expect(cmsCompositionCatalogCode('cmsTaxonomyTermsRead', 502)).toBe(
      'DEPENDENCY_UNAVAILABLE',
    );
    expect(cmsCompositionCatalogCode('CMS-03C-04', 404)).toBe(
      'LOCALE_SOURCE_NOT_FOUND',
    );
    expect(cmsCompositionCatalogCode('CMS-03C-04', 418)).toBeNull();
    expect(cmsCompositionCatalogCode('CMS-03C-04', 200)).toBeNull();
  });
});
