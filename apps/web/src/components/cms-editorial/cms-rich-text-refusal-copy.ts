/**
 * The one fixed sentence for a rich text document that is not canonical (BE03b reason token
 * `rich_text_not_canonical`). It is a module of its own because the field editors need it at
 * hydration while the rest of the refusal copy (`cms-editorial-reason-copy.ts`) is only needed
 * after a command is answered (P2-S11-AC-106).
 */
export const RICH_TEXT_NOT_CANONICAL_COPY =
  'The rich text is not in the supported format. Review the text and save again.';
