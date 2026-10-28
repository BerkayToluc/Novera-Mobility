import { cleanUserAgent, describeDevice, MAX_USER_AGENT_LENGTH } from './device.js';

// V2-19 (QUALITY T-03): the label in the open-sessions list is made from the User-Agent; it is a hint, never a check.
const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

describe('cleanUserAgent', () => {
  it('keeps a normal header as sent, trimmed', () => {
    expect(cleanUserAgent(`  ${CHROME_WINDOWS}  `)).toBe(CHROME_WINDOWS);
  });

  it('cuts a very long header to a safe length', () => {
    expect(cleanUserAgent('a'.repeat(MAX_USER_AGENT_LENGTH + 50))).toHaveLength(MAX_USER_AGENT_LENGTH);
  });

  it.each([[undefined], [null], [''], ['   '], [42], [{}], [['Chrome']]])('answers null for %j', (value) => {
    expect(cleanUserAgent(value)).toBeNull();
  });
});

describe('describeDevice', () => {
  it.each([
    [CHROME_WINDOWS, 'Chrome · Windows'],
    [SAFARI_IPHONE, 'Safari · iOS'],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
      'Edge · macOS',
    ],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0', 'Firefox · macOS'],
    [
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
      'Samsung Internet · Android',
    ],
    [
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/110.0.0.0',
      'Opera · Linux',
    ],
    [
      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Chrome · ChromeOS',
    ],
  ])('names %s', (userAgent, expected) => {
    expect(describeDevice(userAgent)).toBe(expected);
  });

  it('says what it can when only one part is known, and nothing when nothing is', () => {
    expect(describeDevice('curl/8.4.0 (Linux)')).toBe('Linux');
    expect(describeDevice('SomeBrowser/1.0 Safari/1.0')).toBe('Safari');
    expect(describeDevice('curl/8.4.0')).toBeNull();
    expect(describeDevice(null)).toBeNull();
    expect(describeDevice('')).toBeNull();
  });
});
