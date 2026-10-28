// Prisma's error code for a unique constraint that a write ran into (P2002). The services turn it into the answer
// the contract names (an e-mail that is taken, ...); it was written out three times (V2-13, QUALITY M-01).
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';
}
