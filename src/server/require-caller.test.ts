import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `requireCaller` against the identity Twenty 2.49 actually provides.
 *
 * Route triggers stopped forwarding `authorization` in 2.44, so the event
 * carries only `userWorkspaceId`, and `getRoles` lists members by id with a
 * null `userWorkspaceId`. The one join left is the execution context's
 * `workspaceMemberId`; without it every caller — Twenty admins included —
 * matched no role and was refused.
 */

vi.mock('twenty-sdk/logic-function', () => ({
  kv: { get: async () => null, set: async () => undefined, delete: async () => true },
}));

const metadataQuery = vi.fn();

vi.mock('./clients', () => ({
  metadataClient: () => ({ query: (...args: unknown[]) => metadataQuery(...args) }),
}));

const { ROLE_ADMIN, ROLE_AGENT } = await import('../constants/universal-identifiers');
const { ForbiddenError, requireCaller, requireRole } = await import('./auth');

const WORKSPACE_ADMIN_ROLE = 'f6a0e7b2-9d41-4c38-8e15-2b7d3c9a6f04';

const roles = [
  {
    universalIdentifier: WORKSPACE_ADMIN_ROLE,
    canUpdateAllSettings: true,
    workspaceMembers: [{ id: 'wm-admin', userWorkspaceId: null }],
  },
  {
    universalIdentifier: ROLE_AGENT,
    canUpdateAllSettings: false,
    workspaceMembers: [{ id: 'wm-agent', userWorkspaceId: null }],
  },
  {
    universalIdentifier: ROLE_ADMIN,
    canUpdateAllSettings: false,
    workspaceMembers: [{ id: 'wm-wa-admin', userWorkspaceId: null }],
  },
  {
    universalIdentifier: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f',
    canUpdateAllSettings: false,
    workspaceMembers: [{ id: 'wm-sales', userWorkspaceId: null }],
  },
];

const event = { userWorkspaceId: 'uw-1' };

beforeEach(() => {
  metadataQuery.mockReset();
  metadataQuery.mockResolvedValue({ getRoles: roles });
});

describe('requireCaller', () => {
  it('treats a Twenty workspace admin as a WhatsApp admin', async () => {
    const caller = await requireCaller(event, { workspaceMemberId: 'wm-admin' });

    expect(caller).toMatchObject({
      workspaceMemberId: 'wm-admin',
      isAdmin: true,
      isAgent: true,
      isMachine: false,
    });
    expect(() => requireRole(caller, 'agent')).not.toThrow();
  });

  it('places holders of the app roles by their member id', async () => {
    const agent = await requireCaller(event, { workspaceMemberId: 'wm-agent' });
    const admin = await requireCaller(event, { workspaceMemberId: 'wm-wa-admin' });

    expect(agent).toMatchObject({ isAdmin: false, isAgent: true });
    expect(admin).toMatchObject({ isAdmin: true, isAgent: true });
  });

  it('refuses a member whose role grants nothing', async () => {
    const caller = await requireCaller(event, { workspaceMemberId: 'wm-sales' });

    expect(caller).toMatchObject({ isAdmin: false, isAgent: false });
    expect(() => requireRole(caller, 'agent')).toThrow(ForbiddenError);
  });

  /**
   * Fails closed. Every member in the role map has a null `userWorkspaceId`,
   * so a missing member id must not be able to match them on null.
   */
  it('gives a caller with no resolved member no roles at all', async () => {
    for (const context of [undefined, { workspaceMemberId: null }]) {
      const caller = await requireCaller(event, context);

      expect(caller).toMatchObject({
        workspaceMemberId: null,
        roleUniversalIdentifiers: [],
        isAdmin: false,
        isAgent: false,
      });
    }
  });

  it('refuses everyone when the role map cannot be read', async () => {
    metadataQuery.mockRejectedValue(new Error('Entity performing the request does not have permission'));

    await expect(requireCaller(event, { workspaceMemberId: 'wm-admin' })).rejects.toThrow(
      'Could not verify permissions',
    );
  });

  it('refuses a machine caller unless API keys are allowed', async () => {
    await expect(requireCaller({}, undefined)).rejects.toThrow(ForbiddenError);
    expect(metadataQuery).not.toHaveBeenCalled();
  });
});
