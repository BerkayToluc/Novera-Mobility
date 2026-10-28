// The shape of an id (a UUID). A path or body value that does not look like one cannot be a row, so the endpoints
// answer 404 or 422 before the database sees it (a text column would only find nothing, but a malformed value is
// never a reason to ask).
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}
