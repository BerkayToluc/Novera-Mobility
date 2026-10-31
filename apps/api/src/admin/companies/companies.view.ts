// What the administrator sees of a company and of the people invited to it (V2-33, ADMIN.md §3.3). The people's names and e-mail
// addresses are personal data: on the screen and in the answer, never in the audit log, which writes field names only.
type Json = unknown;

type CompanyRow = {
  id: string;
  name: string;
  taxOffice: string | null;
  city: string | null;
  phone: string | null;
  salesContact: Json;
  createdAt: Date;
  updatedAt: Date;
};

export type SalesContact = { name: string; email: string; phone: string };

// The JSON column holds { name, email, phone } or nothing; anything else is treated as nothing, like `GET /me` does.
export function readSalesContact(value: Json): SalesContact | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const { name, email, phone } = value as Record<string, unknown>;
  return typeof name === 'string' && typeof email === 'string' && typeof phone === 'string' ? { name, email, phone } : null;
}

export type CompanyListItem = {
  id: string;
  name: string;
  taxOffice: string | null;
  city: string | null;
  phone: string | null;
  // People of the company, and how many of them have not set a password yet.
  users: number;
  pendingUsers: number;
  createdAt: string;
  // The version of the record: an edit sends it back and is refused (STALE_WRITE) if the record moved on.
  updatedAt: string;
};

// Where a person is: invited and waiting (the link may have run out), or active (has a password, or signs in with Google).
export type InviteStatus = 'PENDING' | 'ACTIVE';

export type CompanyUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  title: string | null;
  status: InviteStatus;
  // For a person who is waiting: when the link of the last invitation runs out, and whether it already has. Empty otherwise.
  invite: { expiresAt: string; expired: boolean } | null;
  createdAt: string;
};

export type CompanyDetail = Omit<CompanyListItem, 'users' | 'pendingUsers'> & {
  salesContact: SalesContact | null;
  users: CompanyUser[];
};

export function companyListItem(row: CompanyRow, users: number, pendingUsers: number): CompanyListItem {
  return {
    id: row.id,
    name: row.name,
    taxOffice: row.taxOffice,
    city: row.city,
    phone: row.phone,
    users,
    pendingUsers,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  contactTitle: string | null;
  passwordHash: string | null;
  googleSub: string | null;
  createdAt: Date;
};

// Waiting = no password and no Google link yet: the person has not used the invitation.
export const isPending = (user: Pick<UserRow, 'passwordHash' | 'googleSub'>): boolean => user.passwordHash === null && user.googleSub === null;

export function companyUser(user: UserRow, lastInviteExpiresAt: Date | null, now: Date): CompanyUser {
  const pending = isPending(user);
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    title: user.contactTitle,
    status: pending ? 'PENDING' : 'ACTIVE',
    invite: pending && lastInviteExpiresAt ? { expiresAt: lastInviteExpiresAt.toISOString(), expired: lastInviteExpiresAt.getTime() <= now.getTime() } : null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function companyDetail(row: CompanyRow, users: CompanyUser[]): CompanyDetail {
  const { users: _count, pendingUsers: _pending, ...rest } = companyListItem(row, 0, 0);
  void _count;
  void _pending;
  return { ...rest, salesContact: readSalesContact(row.salesContact), users };
}
