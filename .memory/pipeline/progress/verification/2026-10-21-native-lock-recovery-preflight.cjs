'use strict';
// WeJammin Slice 12 native lock-recovery — preflight entrypoint.
//
// Runs one observational preflight window through the shared collector. No
// privilege, no lock creation, no admission or native-clear claim; ROOT
// interprets the actual evidence.

const { observe } = require('./2026-10-21-native-lock-recovery-observe.cjs');

const result = observe('preflight');
if (result.ok !== true) {
  process.exitCode = 1;
}
