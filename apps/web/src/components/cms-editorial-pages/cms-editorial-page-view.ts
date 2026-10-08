import type { CmsEditorialPageNoticeOutcome } from './cms-editorial-page-outcome';

/**
 * A loaded page: the status and the document identity (title, heading,
 * description) the shell renders, plus the verified view data of that page.
 * A loader returns this, a notice (one closed state) or a sign-in redirect;
 * the Astro page does nothing but map those to a response.
 */
export interface CmsEditorialPageView<V> {
  readonly kind: 'view';
  readonly status: number;
  readonly title: string;
  readonly heading: string;
  readonly description: string;
  readonly view: V;
}

export type CmsEditorialPageOutcome<V> =
  CmsEditorialPageView<V> | CmsEditorialPageNoticeOutcome;
