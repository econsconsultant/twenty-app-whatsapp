import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  ROLE_ADMIN,
  ROLE_AGENT,
} from '../constants/universal-identifiers';
import { metadataClient } from './clients';
import { describeError, logger } from './logger';

/**
 * Reading and writing this app's own application variables.
 *
 * **Why this exists at all.** `defineSettingsFrontComponent` *replaces* Twenty's
 * variable editor for the app rather than adding to it, so shipping a settings
 * surface silently removed the only place the variables could be changed. That
 * turned every one of them into a constant — including the opt-in and opt-out
 * confirmation wording, whose entire justification is that counsel can reword it
 * without a deploy (specs/01, FR-CON-3). The settings tab even told the
 * operator to go to a "Variables" tab that no longer existed.
 *
 * **It needs `SystemPermissionFlag.APPLICATIONS`, and the caller's own token is
 * not a way around that.** Forwarding the operator's bearer token works for
 * `currentUser` (D-53) but not here: `findOneApplication` is refused with the
 * same token that reads it happily from the browser, so the platform authorises
 * this call against the *executing application*, not the bearer. Attribution
 * therefore comes from the route's `requireRole(caller, 'admin')` gate rather
 * than from the credential.
 *
 * Secrets are never listed. `META_APP_SECRET` and the access token are
 * `serverVariables`, not application variables, so they are not in this set —
 * but `isSecret` is filtered anyway rather than relying on that staying true.
 */

export type EditableVariable = {
  key: string;
  value: string;
  description: string;
  type: string;
  options: unknown;
};

type ApplicationRow = {
  id: string;
  variables: EditableVariable[];
};

const loadApplication = async (): Promise<ApplicationRow | null> => {
  const result = await metadataClient().query({
    findOneApplication: {
      __args: { universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER },
      id: true,
      applicationVariables: {
        key: true,
        value: true,
        description: true,
        type: true,
        options: true,
        isSecret: true,
        isDeprecated: true,
      },
    },
  });

  const application = result.findOneApplication;

  if (application === null || application === undefined) return null;

  return {
    id: application.id,
    variables: (application.applicationVariables ?? [])
      .filter((variable) => variable.isSecret !== true && variable.isDeprecated !== true)
      .map((variable) => ({
        key: variable.key,
        value: variable.value,
        description: variable.description,
        type: variable.type,
        options: variable.options ?? null,
      })),
  };
};

/** The variable whose options are the workspace's own roles, not a fixed list. */
export const AGENT_ROLES_KEY = 'WA_ALLOW_AGENT_ROLES';

type RoleRow = {
  id: string;
  label: string;
  universalIdentifier?: string | null;
  canUpdateAllSettings: boolean;
  canBeAssignedToUsers: boolean;
};

/**
 * The roles worth offering for `WA_ALLOW_AGENT_ROLES`, as select options.
 *
 * A role ID pasted from a settings URL is exact but unreadable, and a typo in
 * one locks a team out without a word. Listing the roles by name lets the panel
 * show checkboxes while the variable keeps storing IDs, so renaming a role
 * never changes who gets in.
 *
 * Left out: roles no member can hold, roles that manage workspace settings
 * (already WhatsApp admins), and this app's own roles (already agents or
 * admins, or a machine identity).
 */
export const toRoleOptions = (roles: RoleRow[]): { label: string; value: string }[] => {
  const ownRoles = new Set([ROLE_ADMIN, ROLE_AGENT, DEFAULT_ROLE_UNIVERSAL_IDENTIFIER]);

  return roles
    .filter(
      (role) =>
        role.canBeAssignedToUsers &&
        !role.canUpdateAllSettings &&
        !ownRoles.has(role.universalIdentifier ?? ''),
    )
    .map((role) => ({ label: role.label, value: role.id }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

/** Null when the roles cannot be read: the panel then falls back to a text box. */
const loadRoleOptions = async (): Promise<{ label: string; value: string }[] | null> => {
  try {
    const result = await metadataClient().query({
      getRoles: {
        id: true,
        label: true,
        universalIdentifier: true,
        canUpdateAllSettings: true,
        canBeAssignedToUsers: true,
      },
    });

    return toRoleOptions(result.getRoles ?? []);
  } catch (error) {
    logger.warn('settings.role_options_failed', describeError(error));

    return null;
  }
};

export const listVariables = async (): Promise<EditableVariable[]> => {
  const variables = (await loadApplication())?.variables ?? [];

  if (!variables.some((variable) => variable.key === AGENT_ROLES_KEY)) return variables;

  const roleOptions = await loadRoleOptions();

  return roleOptions === null
    ? variables
    : variables.map((variable) =>
        variable.key === AGENT_ROLES_KEY ? { ...variable, options: roleOptions } : variable,
      );
};

/**
 * Refuses a key the app did not declare.
 *
 * `updateOneApplicationVariable` takes a bare string key, so without this the
 * route would be a general-purpose writer of any variable on the application —
 * and the set of keys is exactly the set already on screen.
 */
export const setVariable = async (
  key: string,
  value: string,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  const application = await loadApplication();

  if (application === null) return { ok: false, error: 'Application not found' };

  if (!application.variables.some((variable) => variable.key === key)) {
    return { ok: false, error: `Unknown or non-editable variable: ${key}` };
  }

  const result = await metadataClient().mutation({
    updateOneApplicationVariable: {
      __args: { key, value, applicationId: application.id },
    },
  });

  return result.updateOneApplicationVariable === true
    ? { ok: true }
    : { ok: false, error: 'The platform refused the change' };
};
