import { CMS_RELATED_RULES, findRelatedRule } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { RELATED_RULES, RELATED_RULE_KEYS, ruleByKey } from './related-rules';

/*
 * The browser copy of the code-owned registry `CMS_RELATED_RULES` (BE03c OD-5, FE03 :1794). The
 * contract constant lives behind the zod barrel, which the island must not import (AC261); this test
 * is the drift guard that keeps the two identical.
 */
describe('the browser related-rule registry', () => {
  it('has exactly the contract registry members, versions and reasons', () => {
    expect(Object.keys(RELATED_RULES).sort()).toEqual(
      Object.keys(CMS_RELATED_RULES).sort(),
    );
    for (const key of RELATED_RULE_KEYS) {
      const contract = CMS_RELATED_RULES[key];
      expect(RELATED_RULES[key].version, key).toBe(contract.version);
      expect(RELATED_RULES[key].reasonCode, key).toBe(contract.reasonCode);
    }
  });

  it('lists every key once, in registry order', () => {
    expect(RELATED_RULE_KEYS).toEqual(['shared-terms', 'same-type-recent']);
  });

  it('resolves a key to a member the server also accepts', () => {
    for (const key of RELATED_RULE_KEYS) {
      const member = ruleByKey(key);
      expect(member).not.toBeNull();
      expect(findRelatedRule(key, member?.version ?? '')).toMatchObject({
        reasonCode: member?.reasonCode,
      });
    }
  });

  it('refuses an unknown key and an inherited property name', () => {
    expect(ruleByKey('top-rated')).toBeNull();
    expect(ruleByKey('constructor')).toBeNull();
    expect(ruleByKey('')).toBeNull();
  });

  it('gives every member a non-empty label and an explanation', () => {
    for (const key of RELATED_RULE_KEYS) {
      expect(RELATED_RULES[key].label.length).toBeGreaterThan(3);
      expect(RELATED_RULES[key].explanation.length).toBeGreaterThan(20);
    }
  });
});
