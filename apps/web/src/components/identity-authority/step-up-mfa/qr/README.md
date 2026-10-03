# Client-side QR encoder

## Contents

A small, dependency-free QR Code (byte mode, error-correction level M) encoder
used only to draw the otpauth enrollment URI inside the browser.

- `qr-tables.ts` capacity, block layout and Reed-Solomon tables
- `qr-matrix.ts` module placement, masking and format information
- `qr-penalty.ts` mask scoring
- `qr-encode.ts` `encodeQr` and `qrSvgPath`, the public entry points

## Ownership

This directory owns the pure QR matrix and SVG-path encoding only. Rendering
lives in `../MfaQrCode.tsx`, and the enrollment payload is issued by the server.

## Extension

Change behavior only together with `qr-encode.test.ts`, which pins known
reference matrices. Keep every module pure: no DOM, no network, no storage.

## Conventions

The encoded payload is the one-time otpauth URI. Nothing here logs, stores or
transmits it.

## Related links

`../MfaQrCode.tsx` renders the matrix as an SVG.
