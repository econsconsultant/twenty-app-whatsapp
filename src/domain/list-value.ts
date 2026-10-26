/**
 * An `ARRAY` application variable's items, trimmed, empties dropped.
 *
 * Twenty injects `ARRAY` variables as JSON (`["STOP","SAIR"]`); a hand-typed
 * comma-separated value is accepted too. Splitting the JSON on commas would
 * leave brackets and quotes on the first and last items.
 *
 * Shared by `server/config.ts`, which reads the variable, and the settings
 * panel, which edits it — the two must agree on what a stored value means, or
 * the screen shows a list the server does not act on.
 */
export const parseListValue = (value: string): string[] => {
  const parsed = ((): unknown[] | null => {
    try {
      const json: unknown = JSON.parse(value);

      return Array.isArray(json) ? json : null;
    } catch {
      return null;
    }
  })();

  return (parsed ?? value.split(','))
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
};
