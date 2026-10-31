// What the administrator sees of an account (V2-34, ADMIN.md §3.11). An e-mail address and a name are personal data: they are on
// the screen and in the answer, never in the audit log, which writes field names only.
export const USER_TYPES = ['INDIVIDUAL', 'CORPORATE', 'ADMIN'] as const;
export type UserType = (typeof USER_TYPES)[number];
export const USER_STATUSES = ['ACTIVE', 'DISABLED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

type Row = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType: 'INDIVIDUAL' | 'CORPORATE';
  role: 'CUSTOMER' | 'ADMIN';
  contactTitle: string | null;
  passwordHash: string | null;
  googleSub: string | null;
  locale: 'TR' | 'EN';
  disabledAt: Date | null;
  createdAt: Date;
  company: { id: string; name: string } | null;
};

// An administrator is its own kind: the account type of one is INDIVIDUAL, and that would hide what it is.
export const typeOf = (row: Pick<Row, 'accountType' | 'role'>): UserType => (row.role === 'ADMIN' ? 'ADMIN' : row.accountType);

export type UserListItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  type: UserType;
  status: UserStatus;
  // The company of a corporate account.
  companyName: string | null;
  disabledAt: string | null;
  createdAt: string;
};

export type UserDetail = UserListItem & {
  title: string | null;
  locale: 'TR' | 'EN';
  // How the person can sign in: with a password, with Google, or neither yet (an invitation not used).
  hasPassword: boolean;
  googleLinked: boolean;
  company: { id: string; name: string } | null;
  // Bookings of the account, and how many of them are still to come (confirmed, not started): closing the account leaves them.
  reservations: { total: number; upcoming: number };
  // The points the account has now (earned minus spent).
  points: number;
};

export function userListItem(row: Row): UserListItem {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    type: typeOf(row),
    status: row.disabledAt ? 'DISABLED' : 'ACTIVE',
    companyName: row.company?.name ?? null,
    disabledAt: row.disabledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function userDetail(row: Row, reservations: { total: number; upcoming: number }, points: number): UserDetail {
  return {
    ...userListItem(row),
    title: row.contactTitle,
    locale: row.locale,
    hasPassword: row.passwordHash !== null,
    googleLinked: row.googleSub !== null,
    company: row.company,
    reservations,
    points,
  };
}
