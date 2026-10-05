# Components

## Contents

One directory per product surface (`authentication`, `cms-capability-grants`,
`content-schema-registry`, `identity-authority`, `infrastructure`,
`platform-configuration`, `profile-ownership`, and so on), each with its own
README, plus the cross-surface step-up files at this level:
`step-up-required.ts` and its inventory and cross-surface tests, and the shared
`SystemStatus.astro` banner.

## Ownership

`step-up-required.ts` is the only place that recognises the FE00 401
`STEP_UP_REQUIRED` refusal and builds the `/step-up?returnTo=` target. No
surface compares the code literal or builds that href by hand; the inventory
test fails when one does.

## Extension

Create `<surface>/` with a `README.md`, keep components at or under 200 lines,
map a 401 `STEP_UP_REQUIRED` through `step-up-required.ts`, and add the surface
to the inventory test.

## Conventions

Components render and `../lib/` computes. Every surface shares one
`CapabilityGate` (`infrastructure/CapabilityGate.tsx`) for FE00 denial copy.

## Related links

- `../lib/`
- `../server/`
- `.memory/wiki/specs/fe/`
