import { describe, expect, it } from 'vitest';

import {
  emptyResource,
  leakedKeys,
  schemaArtifact,
  selectedResource,
  selectedType,
  uuid,
  uuid2,
  uuid3,
  validField,
  validType,
} from './authoring-context-fixtures.test-support';
import { AuthoringContextReadSchema } from './index';

describe('CMS-03B-14 authoring-context read precedence', () => {
  it('reads the creatable set with no selection and no returned fields', () => {
    expect(
      AuthoringContextReadSchema.parse({ query: {}, resource: emptyResource }),
    ).toEqual({ query: {}, resource: emptyResource });
  });

  it('reads the selected projection when the version id is present', () => {
    expect(
      AuthoringContextReadSchema.safeParse({
        query: { contentTypeVersionId: uuid2 },
        resource: selectedResource,
      }).success,
    ).toBe(true);
  });

  it('forces selectedType null and empty fields when the version id is absent', () => {
    expect(
      AuthoringContextReadSchema.safeParse({
        query: {},
        resource: { creatableTypes: [validType], selectedType, fields: [] },
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextReadSchema.safeParse({
        query: {},
        resource: {
          creatableTypes: [validType],
          selectedType: null,
          fields: [validField],
        },
      }).success,
    ).toBe(false);
  });

  it('forces a non-null selected type that matches the requested version', () => {
    expect(
      AuthoringContextReadSchema.safeParse({
        query: { contentTypeVersionId: uuid2 },
        resource: {
          creatableTypes: [validType],
          selectedType: null,
          fields: [],
        },
      }).success,
    ).toBe(false);
    expect(
      AuthoringContextReadSchema.safeParse({
        query: { contentTypeVersionId: uuid3 },
        resource: selectedResource,
      }).success,
    ).toBe(false);
  });

  it('refuses unknown keys and caller-supplied authority on the read envelope', () => {
    const read = { query: {}, resource: emptyResource };
    for (const leaked of leakedKeys)
      expect(
        AuthoringContextReadSchema.safeParse({ ...read, [leaked]: uuid })
          .success,
      ).toBe(false);
  });

  it('validates nested evidence through the read envelope', () => {
    expect(
      AuthoringContextReadSchema.safeParse({
        query: { contentTypeVersionId: uuid2 },
        resource: {
          ...selectedResource,
          selectedType: {
            ...selectedType,
            schemaArtifact: { ...schemaArtifact, artifactHash: 'short' },
          },
        },
      }).success,
    ).toBe(false);
  });
});
