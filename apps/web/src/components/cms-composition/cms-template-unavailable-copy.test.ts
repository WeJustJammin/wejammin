import { describe, expect, it } from 'vitest';

import { cmsTemplateUnavailableCopy } from './cms-template-unavailable-copy';

describe('cmsTemplateUnavailableCopy (the edit page notice, FE03 :877, :1066)', () => {
  it('says the template is not available for a malformed or reserved key, whatever the status', () => {
    expect(cmsTemplateUnavailableCopy(null, 400)).toBe(
      'This template is not available.',
    );
    expect(cmsTemplateUnavailableCopy(null, 403)).toBe(
      'This template is not available.',
    );
  });

  it.each([
    [
      403,
      'Template designer access is required for the current acting context.',
    ],
    [404, 'This template is unavailable to the current acting context.'],
    [429, 'Template choices are temporarily rate-limited. Wait and reload.'],
    [
      500,
      'The template or its choices are unavailable. Reload when the service is ready.',
    ],
    [
      502,
      'The template or its choices are unavailable. Reload when the service is ready.',
    ],
  ])('answers %i with its fixed sentence', (status, sentence) => {
    expect(cmsTemplateUnavailableCopy('release-notes', status)).toBe(sentence);
  });
});
