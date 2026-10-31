import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { RESEND_URL, ResetLinkNotifier, resetEmail } from './reset-link-notifier.js';

const LINK = 'https://novera.example/tr/sifre-sifirla/yeni?token=abc_DEF-123';
const KEYS = ['RESEND_API_KEY', 'MAIL_FROM', 'NODE_ENV'] as const;

describe('ResetLinkNotifier', () => {
  const saved: Record<string, string | undefined> = {};
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  let calls: Array<{ url: string; init: RequestInit }>;

  const notifier = (answer: () => Promise<Response>) => {
    const instance = new ResetLinkNotifier();
    instance.fetcher = async (url, init) => {
      calls.push({ url, init });
      return answer();
    };
    return instance;
  };
  const ok = async () => new Response('{"id":"1"}', { status: 200 });

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    // Development has to be said outright; with NODE_ENV unset the notifier counts as production.
    process.env.NODE_ENV = 'development';
    calls = [];
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    jest.restoreAllMocks();
  });

  describe('without a mail provider', () => {
    it('writes the link to the log in development', async () => {
      await notifier(ok).send('ayse@example.com', LINK);
      expect(log).toHaveBeenCalledWith(expect.stringContaining(LINK));
      expect(calls).toHaveLength(0);
    });

    it('never writes the link in production, only a warning', async () => {
      process.env.NODE_ENV = 'production';
      await notifier(ok).send('ayse@example.com', LINK);
      const written = JSON.stringify([...log.mock.calls, ...warn.mock.calls, ...error.mock.calls]);
      expect(written).not.toContain('abc_DEF');
      expect(written).not.toContain('ayse@example.com');
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('does not write the link when NODE_ENV is missing either (fails closed)', async () => {
      delete process.env.NODE_ENV;
      await notifier(ok).send('ayse@example.com', LINK);
      const written = JSON.stringify([...log.mock.calls, ...warn.mock.calls, ...error.mock.calls]);
      expect(written).not.toContain('abc_DEF');
      expect(written).not.toContain('ayse@example.com');
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('needs both settings: a key alone sends nothing', async () => {
      process.env.RESEND_API_KEY = 're_test';
      await notifier(ok).send('ayse@example.com', LINK);
      expect(calls).toHaveLength(0);
    });
  });

  describe('with a mail provider', () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = 're_test_123';
      process.env.MAIL_FROM = 'Novera Mobility <noreply@novera.example>';
    });

    it("sends the e-mail through Resend in the person's language", async () => {
      await notifier(ok).send('ayse@example.com', LINK, 'TR');
      expect(calls).toHaveLength(1);
      expect(calls[0]!.url).toBe(RESEND_URL);
      const headers = calls[0]!.init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer re_test_123');
      const body = JSON.parse(calls[0]!.init.body as string);
      expect(body.from).toBe('Novera Mobility <noreply@novera.example>');
      expect(body.to).toEqual(['ayse@example.com']);
      expect(body.subject).toBe('Novera Mobility: şifreni sıfırla');
      expect(body.text).toContain(LINK);
      expect(body.html).toContain(`href="${LINK}"`);
      expect(log).not.toHaveBeenCalled();
    });

    it('sends English to an English account', async () => {
      await notifier(ok).send('john@example.com', LINK, 'EN');
      const body = JSON.parse(calls[0]!.init.body as string);
      expect(body.subject).toBe('Novera Mobility: reset your password');
    });

    it('does not throw when the provider refuses, and logs only the status', async () => {
      await expect(
        notifier(async () => new Response('{"message":"ayse@example.com is not allowed"}', { status: 403 })).send(
          'ayse@example.com',
          LINK,
        ),
      ).resolves.toBeUndefined();
      const written = JSON.stringify(error.mock.calls);
      expect(written).toContain('403');
      expect(written).not.toContain('ayse@example.com');
      expect(written).not.toContain('abc_DEF');
    });

    it('does not throw when the network is down', async () => {
      await expect(
        notifier(async () => {
          throw new Error('getaddrinfo ENOTFOUND api.resend.com ayse@example.com');
        }).send('ayse@example.com', LINK),
      ).resolves.toBeUndefined();
      expect(JSON.stringify(error.mock.calls)).not.toContain('ayse@example.com');
    });
  });
});

describe('resetEmail', () => {
  it('escapes what goes into the HTML', () => {
    const { html } = resetEmail('https://x.example/?a=1&b="2"<script>', 'EN');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&amp;b=&quot;2&quot;&lt;script&gt;');
  });
});

// The invitation of a person to a corporate account (V2-33): the same delivery as a reset link, with its own text.
describe('the invitation e-mail', () => {
  const INVITE = { company: 'Ege Lojistik A.Ş.', name: 'Mert' };

  it('names the person and the company, says the link lives seven days, and carries the link', () => {
    const tr = resetEmail(LINK, 'TR', INVITE);
    expect(tr.subject).toBe('Novera Mobility: kurumsal hesabın hazır');
    expect(tr.text).toContain('Merhaba Mert');
    expect(tr.text).toContain('Ege Lojistik A.Ş.');
    expect(tr.text).toContain('7 gün');
    expect(tr.text).toContain(LINK);
    expect(tr.html).toContain(`href="${LINK}"`);
    // It is not the reset text: that one lives an hour.
    expect(tr.text).not.toContain('1 saat');

    const en = resetEmail(LINK, 'EN', INVITE);
    expect(en.subject).toBe('Novera Mobility: your corporate account is ready');
    expect(en.text).toContain('Hello Mert');
    expect(en.text).toContain('7 days');
    expect(en.text).not.toContain('1 hour');
  });

  it('escapes the company and the name in the HTML, so a name cannot add markup to the mail', () => {
    const { html, text } = resetEmail(LINK, 'EN', { company: '<b>Acme</b> & "Co"', name: '<script>x</script>' });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>Acme</b>');
    expect(html).toContain('&lt;b&gt;Acme&lt;/b&gt; &amp; &quot;Co&quot;');
    // The plain text is plain: it is not HTML, so it keeps what was written.
    expect(text).toContain('<b>Acme</b> & "Co"');
  });

  it('is sent through the mail provider with the invitation text, and logged in development without one', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.MAIL_FROM = 'Novera <no-reply@novera.example>';
    try {
      const instance = new ResetLinkNotifier();
      instance.fetcher = async (url, init) => {
        calls.push({ url, init });
        return new Response('{"id":"1"}', { status: 200 });
      };
      await instance.send('mert@egelojistik.example', LINK, 'TR', INVITE);
      expect(calls).toHaveLength(1);
      const body = JSON.parse(calls[0]!.init.body as string);
      expect(body).toMatchObject({ to: ['mert@egelojistik.example'], subject: 'Novera Mobility: kurumsal hesabın hazır' });
      expect(body.text).toContain('Ege Lojistik A.Ş.');
    } finally {
      delete process.env.RESEND_API_KEY;
      delete process.env.MAIL_FROM;
    }
  });
});
