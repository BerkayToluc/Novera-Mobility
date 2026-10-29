import { blobPublicHost, currentEnv, type Env } from '../config/env.js';
import { field } from './zod-fields.js';

// The address of a picture a record may carry (`imageUrl`, ARCHITECTURE ADR-28): either a path inside the site (`/images/...`,
// the 15 photos that live in the repository) or an address on the photo store the panel uploads to. Nothing else: an
// administrator cannot point a model at a picture on any other host, so a model page can never load something from an
// address that nobody chose on purpose, and the Content-Security-Policy of the site (img-src) is the same list.
export const IMAGE_PATH_PREFIX = '/images/';
export const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';
export const MAX_IMAGE_URL_LENGTH = 500;

// Letters, digits and the few marks a file name has; no `%`, so no encoded `..` or `/`.
const SAFE_PATH = /^[A-Za-z0-9._\-/]+$/;
// One label (the store id) in front of the store family's domain.
const STORE_HOST = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/;

function hasDotSegment(path: string): boolean {
  return path.split('/').some((segment) => segment === '..' || segment === '.');
}

export function isAllowedImageUrl(value: string, source: Env = currentEnv()): boolean {
  if (value.length === 0 || value.length > MAX_IMAGE_URL_LENGTH) return false;

  if (value.startsWith('/')) {
    // A path of the site: under /images/, plain characters, no `..`, no `//`.
    return (
      value.startsWith(IMAGE_PATH_PREFIX) &&
      value.length > IMAGE_PATH_PREFIX.length &&
      SAFE_PATH.test(value) &&
      !hasDotSegment(value) &&
      !value.includes('//')
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  // https only, no credentials, no port, no query or fragment (a store address has none, and a tracking one would).
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return false;
  const host = url.hostname.toLowerCase();
  const configured = blobPublicHost(source);
  if (configured ? host !== configured : !STORE_HOST.test(host)) return false;
  // The path is read from the text that was given, not from `url.pathname`: the URL parser folds `/../` away, which would hide it.
  const rawPath = value.replace(/^https:\/\/[^/]*/i, '');
  return rawPath.length > 1 && SAFE_PATH.test(rawPath) && !hasDotSegment(rawPath) && !rawPath.includes('//');
}

// A required `imageUrl`: missing is REQUIRED, anything that is not an allowed address INVALID_FORMAT.
export const imageUrl = () =>
  field<string>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
    return typeof raw === 'string' && isAllowedImageUrl(raw.trim()) ? { value: raw.trim() } : { code: 'INVALID_FORMAT' };
  });
