import { z } from 'zod';
import { parseInput } from './zod-validation.js';
import { imageUrl, isAllowedImageUrl } from './image-url.js';

const STORE = 'https://ce0rcu23vrrdzqap.public.blob.vercel-storage.com/vehicle-models/0b1c2d3e.webp';
const none = {} as NodeJS.ProcessEnv;
const configured = { BLOB_PUBLIC_HOST: 'ce0rcu23vrrdzqap.public.blob.vercel-storage.com' } as NodeJS.ProcessEnv;

// The ones of a list that were answered the wrong way, so a failure names them (a bare loop would not).
const refusedOf = (values: string[], env = none) => values.filter((value) => !isAllowedImageUrl(value, env));
const takenOf = (values: string[], env = none) => values.filter((value) => isAllowedImageUrl(value, env));

describe('the picture addresses a record may carry (V2-28, ADR-28)', () => {
  it('takes a path of the site under /fleet/', () => {
    expect(refusedOf(['/fleet/fiat-egea.webp', '/fleet/a.png', '/fleet/sub/dir/photo-1.jpg'])).toEqual([]);
  });

  it('refuses a path that leaves /fleet/, climbs out of it, or hides something in it', () => {
    expect(
      takenOf([
        '/fleet/',
        '/images/fiat-egea.webp', // the path the first draft of ADR-28 named: nothing lives there
        '/fleet/../secret.webp',
        '/fleet/./a.webp',
        '/fleet//evil.com/a.webp',
        '/fleet/%2e%2e/a.webp',
        '/fleet/a b.webp',
        '/fleet/a.webp?x=1',
        '//evil.com/fleet/a.webp',
        '/fleet/\\evil.webp',
      ]),
    ).toEqual([]);
  });

  it('takes an address on the photo store, over https', () => {
    expect(refusedOf([STORE])).toEqual([]);
    expect(refusedOf([STORE], configured)).toEqual([]);
    expect(refusedOf([STORE.replace('ce0rcu23vrrdzqap', 'CE0RCU23VRRDZQAP')], configured)).toEqual([]);
  });

  it('when the store is named, only that store: another store of the same family is refused', () => {
    const other = STORE.replace('ce0rcu23vrrdzqap', 'someoneelsesstore');
    expect(isAllowedImageUrl(other, none)).toBe(true);
    expect(isAllowedImageUrl(other, configured)).toBe(false);
  });

  it('refuses every other host, scheme and trick', () => {
    expect(
      takenOf([
        'http://ce0rcu23vrrdzqap.public.blob.vercel-storage.com/a.webp',
        'https://evil.com/a.webp',
        'https://evil.com/.public.blob.vercel-storage.com/a.webp',
        'https://public.blob.vercel-storage.com/a.webp',
        'https://a.b.public.blob.vercel-storage.com/a.webp',
        'https://ce0rcu23vrrdzqap.public.blob.vercel-storage.com.evil.com/a.webp',
        'https://evilpublic.blob.vercel-storage.com/a.webp',
        'https://user:pass@ce0rcu23vrrdzqap.public.blob.vercel-storage.com/a.webp',
        'https://ce0rcu23vrrdzqap.public.blob.vercel-storage.com:8443/a.webp',
        'https://ce0rcu23vrrdzqap.private.blob.vercel-storage.com/a.webp',
        'https://ce0rcu23vrrdzqap.public.blob.vercel-storage.com/a.webp?track=1',
        'https://ce0rcu23vrrdzqap.public.blob.vercel-storage.com/a.webp#x',
        'https://ce0rcu23vrrdzqap.public.blob.vercel-storage.com/',
        'https://ce0rcu23vrrdzqap.public.blob.vercel-storage.com/../a.webp',
        'javascript:alert(1)',
        'data:image/png;base64,AAAA',
        'ftp://ce0rcu23vrrdzqap.public.blob.vercel-storage.com/a.webp',
        'not an address',
        '',
      ]),
    ).toEqual([]);
  });

  it('refuses an address that is too long', () => {
    expect(isAllowedImageUrl(`/fleet/${'a'.repeat(500)}.webp`, none)).toBe(false);
  });

  it('as a field: missing is REQUIRED, a wrong address INVALID_FORMAT, a good one is trimmed', () => {
    const schema = z.object({ imageUrl: imageUrl() });
    const fieldErrors = (input: unknown) => expect.objectContaining({ response: expect.objectContaining({ fieldErrors: input }) });
    expect(parseInput(schema, { imageUrl: ' /fleet/a.webp ' }, 'x')).toEqual({ imageUrl: '/fleet/a.webp' });
    expect(() => parseInput(schema, {}, 'x')).toThrow(fieldErrors({ imageUrl: 'REQUIRED' }));
    expect(() => parseInput(schema, { imageUrl: 'https://evil.com/a.webp' }, 'x')).toThrow(fieldErrors({ imageUrl: 'INVALID_FORMAT' }));
    expect(() => parseInput(schema, { imageUrl: 42 }, 'x')).toThrow(fieldErrors({ imageUrl: 'INVALID_FORMAT' }));
  });
});
