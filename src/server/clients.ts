import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

/**
 * Memoised API clients.
 *
 * A logic function invocation is short-lived but can make dozens of calls;
 * rebuilding the genql client each time rebuilds its type map for nothing. The
 * clients read `TWENTY_API_URL` and the injected app access token from the
 * environment, so there is nothing to configure and nothing to pass around.
 *
 * `runAs: 'application'` because the routes enforce their own roles (SEC-5)
 * and must act with the app's role. Since Twenty 2.33 a user-triggered
 * function's default token is delegated — bounded by the caller's role *and*
 * the app's — so a member whose role lacks the `ROLES` flag or access to the
 * WhatsApp objects (a custom "Sales Manager", say) could not even have their
 * permissions checked.
 */

let core: CoreApiClient | null = null;
let metadata: MetadataApiClient | null = null;

export const coreClient = (): CoreApiClient =>
  (core ??= new CoreApiClient({ runAs: 'application' }));

export const metadataClient = (): MetadataApiClient =>
  (metadata ??= new MetadataApiClient({ runAs: 'application' }));

/** Test seam. Also the correct response to a token rotation mid-process. */
export const resetClients = (): void => {
  core = null;
  metadata = null;
};
