/**
 * The clock the app renders and partitions days in (FR-UI-5, specs/08 §8).
 *
 * Not the reader's browser: a rep must see the day boundary the *customer* is
 * on, or a message sent at 23:30 files itself under tomorrow. Which zone that is
 * belongs to the workspace, so it is the `WA_TIME_ZONE` application variable;
 * each layer reads it its own way (`server/config.ts`, `components/common/
 * format.ts`) and hands it here.
 */

export const DEFAULT_TIME_ZONE = 'Africa/Luanda';

let lastInput: string | null | undefined;
let lastZone = DEFAULT_TIME_ZONE;

/**
 * A configured IANA zone, or the default when it is blank or unknown.
 *
 * Validated because `Intl` throws on a name it does not know, which would turn
 * one typo into every timestamp failing to render. Memoised on the last input
 * because a campaign snapshot resolves the zone once per recipient.
 */
export const resolveTimeZone = (value: string | null | undefined): string => {
  if (value === lastInput) return lastZone;

  const candidate = value?.trim() ?? '';
  let zone = DEFAULT_TIME_ZONE;

  if (candidate.length > 0) {
    try {
      zone = new Intl.DateTimeFormat('en-US', { timeZone: candidate }).resolvedOptions().timeZone;
    } catch {
      zone = DEFAULT_TIME_ZONE;
    }
  }

  lastInput = value;
  lastZone = zone;

  return zone;
};
