import * as React from 'react';

import { encodeQr, qrSvgPath } from './qr/qr-encode';

export interface MfaQrCodeProps {
  /** The one-time `otpauth://` payload; it is encoded here and never rendered. */
  payload: string;
}

/**
 * Renders the enrollment QR locally as inline SVG: no third-party QR service,
 * no image request, and no otpauth link or text in the document. The symbol
 * is always black on white because scanners need that contrast in any theme.
 */
export function MfaQrCode({ payload }: MfaQrCodeProps): React.ReactElement {
  const { viewBoxSize, d } = React.useMemo(
    () => qrSvgPath(encodeQr(payload)),
    [payload],
  );
  return (
    <svg
      className="mfa-qr"
      role="img"
      aria-label="QR code for adding WeJammin to an authenticator app"
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      shapeRendering="crispEdges"
    >
      <rect width={viewBoxSize} height={viewBoxSize} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  );
}
