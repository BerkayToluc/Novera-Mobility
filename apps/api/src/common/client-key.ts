import { createHash } from 'node:crypto';
import type { Request } from 'express';

// Recognises the client by a hash of its address; the address itself is not stored.
//
// The address is `request.ip`. Express works it out from the connection and from the `X-Forwarded-For`
// header, and trusts that header only as far as TRUST_PROXY_HOPS says (see app.setup.ts): the entries
// added by our own proxies count, anything a visitor typed further left does not. Reading the first
// entry of the header by hand, as this function used to, let anyone choose their own key.
export function clientKeyOf(request: Request): string {
  const address = request.ip || request.socket.remoteAddress || 'unknown';
  return createHash('sha256').update(address).digest('hex').slice(0, 32);
}
