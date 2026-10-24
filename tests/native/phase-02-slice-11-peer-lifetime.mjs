import test from 'node:test';
import { LifetimeFixture } from './helpers/dec203-lifetime-harness.mjs';
import { buildCases } from './helpers/dec203-lifetime-build-cases.mjs';
import { capabilityCases } from './helpers/dec203-lifetime-capability-cases.mjs';

const check = (name, body) =>
  test(name, { concurrency: false }, async (context) => {
    const fixture = await LifetimeFixture.open(context);
    await body(fixture, context);
  });

buildCases(check);
capabilityCases(check);
