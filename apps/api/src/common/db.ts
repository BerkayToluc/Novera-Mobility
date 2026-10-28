import type { Prisma } from '../generated/prisma/client.js';

// The part of the database client a function needs. Both the client (`PrismaService`) and the client inside an
// interactive transaction (`tx`) fit, so a function can run in or out of a transaction without a cast (V2-13, QUALITY M-03).
export type Db<Delegates extends keyof Prisma.TransactionClient> = Pick<Prisma.TransactionClient, Delegates>;
