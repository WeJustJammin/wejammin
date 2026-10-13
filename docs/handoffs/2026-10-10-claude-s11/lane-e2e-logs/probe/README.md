# Lane e2e probe

The throw-away probe of the `e2e` lane: a Playwright spec, its config and a unit twin used to isolate the max-input behaviour. It is not part of any suite.

## Contents

- `playwright.lane-e2e-probe.config.ts`: the config that runs only the probe spec.
- `zz-lane-e2e-probe.spec.ts`: the browser probe.
- `zz-lane-e2e-max-input-probe.test.ts`: the unit probe of the max-input bound.

## Ownership

The `e2e` lane owns this directory; no suite, config or gate includes it.

## Extension

Add a probe only to isolate one behaviour for a report, name it `zz-lane-<lane>-*` and delete or leave it here once the report cites its result. A probe never becomes a test: promote the check into the suite that owns the behaviour instead.

## Conventions

The files keep the `zz-` prefix so that no glob of a real suite matches them.

## Related links

- `../README.md`
- `../../lane-e2e-report.md`
