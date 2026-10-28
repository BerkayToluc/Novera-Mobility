// The top-level namespaces of a messages object that are named, nothing else. A name that does not exist is a mistake
// in i18n/client-messages.ts and stops the page at once, instead of leaving a component without its text.
export function pickNamespaces<T extends Record<string, unknown>>(messages: T, names: readonly string[]): Partial<T> {
  const picked: Record<string, unknown> = {};
  for (const name of names) {
    if (!(name in messages)) throw new Error(`Unknown message namespace "${name}" (i18n/client-messages.ts)`);
    picked[name] = messages[name];
  }
  return picked as Partial<T>;
}
