import { describe, expect, it } from 'vitest';

import {
  CMS_EMPTY_RICH_TEXT,
  cmsDatetimeToLocalInput,
  cmsLocalInputToDatetime,
  isJsonRecord,
} from './cms-field-basics';
import {
  CMS_EMPTY_RICH_TEXT as valueEmptyRichText,
  cmsDatetimeToLocalInput as valueToLocal,
  cmsLocalInputToDatetime as valueToDatetime,
} from './cms-field-value';
import {
  CMS_EMPTY_RICH_TEXT as structuredEmptyRichText,
  isJsonRecord as structuredIsJsonRecord,
} from './cms-field-value-structured';
import {
  cmsDatetimeToLocalInput as scalarToLocal,
  cmsLocalInputToDatetime as scalarToDatetime,
} from './cms-field-value-scalar';

describe('isJsonRecord', () => {
  it.each([
    [{}, true],
    [{ a: 1 }, true],
    [[], false],
    [[1], false],
    [null, false],
    [undefined, false],
    ['text', false],
    [3, false],
  ])('%j -> %s', (value, expected) => {
    expect(isJsonRecord(value)).toBe(expected);
  });
});

describe('CMS_EMPTY_RICH_TEXT', () => {
  it('is the one-empty-paragraph rich_text.v1 document', () => {
    expect(CMS_EMPTY_RICH_TEXT).toEqual({
      format: 'rich_text.v1',
      blocks: [{ type: 'paragraph', spans: [] }],
    });
  });
});

describe('datetime-local conversions', () => {
  it('renders an unparsable stored value as an empty control', () => {
    expect(cmsDatetimeToLocalInput('not a date')).toBe('');
  });

  it('round-trips an instant through the local control value', () => {
    const local = cmsDatetimeToLocalInput('2026-03-04T05:06:07Z');
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/u);
    expect(cmsLocalInputToDatetime(local)).toBe('2026-03-04T05:06:07Z');
  });

  it.each(['', '2026-03-04', '2026-03-04T05', 'x2026-03-04T05:06:07'])(
    'refuses the control value %j',
    (local) => {
      expect(cmsLocalInputToDatetime(local)).toBeNull();
    },
  );

  it('refuses a control value that is not a real date', () => {
    expect(cmsLocalInputToDatetime('2026-13-45T05:06')).toBeNull();
  });
});

describe('the validator modules keep exporting the helpers', () => {
  it('re-exports the same references, so existing importers are unaffected', () => {
    expect(structuredIsJsonRecord).toBe(isJsonRecord);
    expect(structuredEmptyRichText).toBe(CMS_EMPTY_RICH_TEXT);
    expect(valueEmptyRichText).toBe(CMS_EMPTY_RICH_TEXT);
    expect(valueToLocal).toBe(cmsDatetimeToLocalInput);
    expect(scalarToLocal).toBe(cmsDatetimeToLocalInput);
    expect(valueToDatetime).toBe(cmsLocalInputToDatetime);
    expect(scalarToDatetime).toBe(cmsLocalInputToDatetime);
  });
});
