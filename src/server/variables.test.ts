import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  ROLE_ADMIN,
  ROLE_AGENT,
} from '../constants/universal-identifiers';
import { toRoleOptions } from './variables';

const role = (
  label: string,
  overrides: Partial<Parameters<typeof toRoleOptions>[0][number]> = {},
) => ({
  id: `id-${label}`,
  label,
  universalIdentifier: null,
  canUpdateAllSettings: false,
  canBeAssignedToUsers: true,
  ...overrides,
});

/**
 * The checklist for WA_ALLOW_AGENT_ROLES offers only roles whose listing would
 * change something: a member can hold it, and it does not already grant access.
 */
describe('toRoleOptions', () => {
  it('offers workspace roles by name, storing their ids, sorted by name', () => {
    expect(toRoleOptions([role('Sales Manager'), role('Management')])).toEqual([
      { label: 'Management', value: 'id-Management' },
      { label: 'Sales Manager', value: 'id-Sales Manager' },
    ]);
  });

  it('leaves out roles that manage settings, since they are WhatsApp admins already', () => {
    expect(toRoleOptions([role('Admin', { canUpdateAllSettings: true })])).toEqual([]);
  });

  it('leaves out roles no member can hold', () => {
    expect(toRoleOptions([role('Integration', { canBeAssignedToUsers: false })])).toEqual([]);
  });

  it("leaves out this app's own roles", () => {
    expect(
      toRoleOptions([
        role('WhatsApp Admin', { universalIdentifier: ROLE_ADMIN }),
        role('WhatsApp Agent', { universalIdentifier: ROLE_AGENT }),
        role('WhatsApp function role', { universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER }),
      ]),
    ).toEqual([]);
  });
});
