/**
 * The sentence of the template edit page's "Designer unavailable" region (FE03 :877, :1066): what the person is told
 * when the protected reads did not produce a verified designer. A malformed or reserved key (`null`) is never
 * answered with a status-specific sentence, so no read outcome is implied for it.
 */
export const cmsTemplateUnavailableCopy = (
  templateKey: string | null,
  failureStatus: number,
): string => {
  if (templateKey === null) return 'This template is not available.';
  if (failureStatus === 403)
    return 'Template designer access is required for the current acting context.';
  if (failureStatus === 404)
    return 'This template is unavailable to the current acting context.';
  if (failureStatus === 429)
    return 'Template choices are temporarily rate-limited. Wait and reload.';
  return 'The template or its choices are unavailable. Reload when the service is ready.';
};
