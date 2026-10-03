import { describe, expect, it } from 'vitest';

import { mediaTypeDetails } from './media-type-details';

describe('mediaTypeDetails (BE00 UNSUPPORTED_MEDIA_TYPE details)', () => {
  it('falls back to the JSON allowlist when nothing usable is supplied', () => {
    for (const source of [
      undefined,
      null,
      'text/plain',
      [],
      {},
      { allowedMediaTypes: 'application/json' },
      { allowedMediaTypes: [1] },
      { allowedMediaTypes: ['not a media type'] },
      { allowedMediaTypes: Array(9).fill('application/json') },
    ])
      expect(mediaTypeDetails(source)).toEqual({
        allowedMediaTypes: ['application/json'],
      });
  });

  it('keeps a short list of well-formed media types, including an empty one', () => {
    expect(
      mediaTypeDetails({ allowedMediaTypes: ['application/json', 'text/csv'] }),
    ).toEqual({ allowedMediaTypes: ['application/json', 'text/csv'] });
    expect(mediaTypeDetails({ allowedMediaTypes: [] })).toEqual({
      allowedMediaTypes: [],
    });
  });
});
