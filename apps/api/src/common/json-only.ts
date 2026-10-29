import type { NextFunction, Request, Response } from 'express';

// Every endpoint that reads a body reads JSON. Anything else (a form post, text/plain) is turned away before a body
// parser sees it: Nest would otherwise also parse `application/x-www-form-urlencoded`, which a page on another
// site can send without a CORS preflight (QUALITY §3.1 Girdi, G-20). A request without a body is let through:
// logout, cancel and the DELETE calls have none.
export function jsonOnly(request: Request, response: Response, next: NextFunction): void {
  const hasBody = request.headers['transfer-encoding'] !== undefined || Number(request.headers['content-length'] ?? 0) > 0;
  if (hasBody && request.is('json') !== 'json') {
    response.status(415).json({ code: 'BAD_REQUEST', message: 'This content type is not supported' });
    return;
  }
  next();
}
