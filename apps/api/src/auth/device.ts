// A short, readable device label for the open-sessions list ("Chrome · Windows"), made from the
// User-Agent the browser sent at sign-in. It is only a hint for the person, never used for security.
const BROWSERS: Array<[RegExp, string]> = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/(Chrome|CriOS)\//, 'Chrome'],
  [/(Firefox|FxiOS)\//, 'Firefox'],
  [/Safari\//, 'Safari'],
];
const SYSTEMS: Array<[RegExp, string]> = [
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/(iPhone|iPad|iPod)/, 'iOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

export const MAX_USER_AGENT_LENGTH = 300;

// Stored as sent, cut to a safe length; a missing or odd header is simply "unknown".
export function cleanUserAgent(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, MAX_USER_AGENT_LENGTH);
  return trimmed === '' ? null : trimmed;
}

export function describeDevice(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (browser && system) return `${browser} · ${system}`;
  return browser ?? system ?? null;
}
