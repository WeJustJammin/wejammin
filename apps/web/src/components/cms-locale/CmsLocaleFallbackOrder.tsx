import * as React from 'react';

interface Props {
  readonly locale: string;
  readonly chain: readonly string[];
}

/**
 * The fallback order as read-only text, "{target}: {a} → {b} → {default}" (FE03 :1336). It is never a
 * control: the form submits it unchanged as the equality expectation, and a 409 replaces it with the active
 * one. The default language has an empty order.
 */
export default function CmsLocaleFallbackOrder({
  locale,
  chain,
}: Props): React.ReactElement {
  return (
    <p className="cms-locale-order">
      <strong id="cms-locale-order-label">Fallback order</strong>{' '}
      <span aria-labelledby="cms-locale-order-label">
        {chain.length === 0
          ? `${locale}: no fallback order, this is the default language`
          : `${locale}: ${chain.join(' → ')}`}
      </span>
    </p>
  );
}
