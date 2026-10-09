import type { RichTextV1Document } from '@wejammin/contracts';

import type { FindingCollector, RenderPosition } from './findings';
import { richTextSpanLocation } from './locations';
import type { ParsedField } from './rules-structure';
import {
  genericLinkPhrases,
  hasNonWhitespace,
  normalizeIdentity,
  normalizeLinkText,
  primaryLanguageOf,
} from './text';

/**
 * BE05c link group over the rich_text.v1 spans in document order.
 *
 * A link is the run of ADJACENT spans that carry the same link target: the
 * rich_text.v1 canonical form only merges adjacent spans with equal marks AND
 * link, so one link styled with mixed marks is several spans. Judging a
 * single span would block "More" + "about jamming" as the generic text "more".
 * A finding addresses the first span of its run.
 *
 * `link.text_empty`: no non-whitespace text. `link.text_generic`: the
 * normalized text is in the language's generic-phrase list.
 * `link.text_is_url`: the text equals its target or starts with `https://` or
 * `mailto:`. `link.text_unchecked_language`: a link exists but the revision's
 * primary language has no list, so `link.text_generic` was not evaluated; the
 * warning is raised once, at the first link, never as silence.
 */

type Block = RichTextV1Document['blocks'][number];
type Span = Block['spans'][number];
type Link = NonNullable<Span['link']>;

type LinkRun = { link: Link; firstSpanIndex: number; text: string };

const URL_PREFIXES = ['https://', 'mailto:'] as const;

const targetOf = (link: Link): string =>
  link.kind === 'https'
    ? link.href
    : link.kind === 'mailto'
      ? link.address
      : link.route;

const linkKey = (link: Link): string => `${link.kind}:${targetOf(link)}`;

const linkRuns = (spans: readonly Span[]): LinkRun[] => {
  const runs: LinkRun[] = [];
  let open: { key: string; run: LinkRun } | null = null;
  spans.forEach((span, spanIndex) => {
    if (span.link === undefined) {
      open = null;
      return;
    }
    const key = linkKey(span.link);
    if (open !== null && open.key === key) {
      open.run.text += span.text;
      return;
    }
    const run: LinkRun = {
      link: span.link,
      firstSpanIndex: spanIndex,
      text: span.text,
    };
    runs.push(run);
    open = { key, run };
  });
  return runs;
};

const isUrlText = (run: LinkRun): boolean => {
  const shown = normalizeIdentity(run.text);
  return (
    URL_PREFIXES.some((prefix) => shown.startsWith(prefix)) ||
    shown === normalizeIdentity(targetOf(run.link))
  );
};

export type LinkRule = Readonly<{
  evaluate: (field: ParsedField) => void;
  /** Call once after the last field: raises the unchecked-language warning. */
  finish: () => void;
}>;

export const createLinkRule = (
  collector: FindingCollector,
  locale: string,
): LinkRule => {
  const phrases = genericLinkPhrases(primaryLanguageOf(locale));
  let firstLink: {
    location: ReturnType<typeof richTextSpanLocation>;
    position: RenderPosition;
  } | null = null;

  return {
    evaluate: (field) => {
      field.document.blocks.forEach((block, blockIndex) => {
        for (const run of linkRuns(block.spans)) {
          const location = richTextSpanLocation(
            field.fieldId,
            blockIndex,
            run.firstSpanIndex,
          );
          const position: RenderPosition = [
            field.nodeIndex,
            blockIndex,
            run.firstSpanIndex,
          ];
          firstLink ??= { location, position };
          if (!hasNonWhitespace(run.text)) {
            collector.add('link.text_empty', location, position);
            continue;
          }
          if (phrases?.has(normalizeLinkText(run.text)) === true)
            collector.add('link.text_generic', location, position);
          if (isUrlText(run))
            collector.add('link.text_is_url', location, position);
        }
      });
    },
    finish: () => {
      if (firstLink !== null && phrases === undefined)
        collector.add(
          'link.text_unchecked_language',
          firstLink.location,
          firstLink.position,
        );
    },
  };
};
