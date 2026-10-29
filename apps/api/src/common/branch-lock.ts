import { Prisma } from '../generated/prisma/client.js';
import type { Db } from './db.js';
import { validationFailed } from './zod-validation.js';

// A booking or a hold takes its branches for sharing, as the last of its locks (V2-27): the administrator who closes a branch
// takes the same row for update, so the two take turns. Either the booking is made first and the closing sees it (and
// refuses), or the closing comes first and the booking sees a closed branch (and is refused). Without this a booking that
// passed the check a moment before could still be written after the branch was closed.
//
// It is always the last lock, after the vehicle, the account and the campaign code, and the closing takes no other lock,
// so no two requests can wait for each other.
export async function lockOpenBranches(
  tx: Db<'$queryRaw'>,
  branches: { pickupBranchId: string; returnBranchId: string },
): Promise<void> {
  const ids = [...new Set([branches.pickupBranchId, branches.returnBranchId])];
  const open = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Branch" WHERE "id" IN (${Prisma.join(ids)}) AND "closedAt" IS NULL FOR SHARE`;
  const known = new Set(open.map((row) => row.id));
  const errors: Record<string, string> = {};
  if (!known.has(branches.pickupBranchId)) errors.pickupBranchId = 'UNKNOWN_REFERENCE';
  if (!known.has(branches.returnBranchId)) errors.returnBranchId = 'UNKNOWN_REFERENCE';
  if (Object.keys(errors).length > 0) throw validationFailed(errors, 'Branch reference not found');
}
