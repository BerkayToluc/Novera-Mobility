// Veritabanındaki kullanıcıyı openapi.yaml `User` biçimine çevirir (passwordHash asla çıkmaz).
export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  accountType: 'INDIVIDUAL' | 'CORPORATE';
  companyName: string | null;
  taxOffice: string | null;
  companyCity: string | null;
  companyPhone: string | null;
  contactTitle: string | null;
  // Veritabanında JSON: { "name": "...", "email": "...", "phone": "..." } ya da boş
  salesContact: unknown;
  locale: 'TR' | 'EN';
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  currency: 'TRY' | 'EUR' | 'USD';
}

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType: 'INDIVIDUAL' | 'CORPORATE';
  companyName: string | null;
  taxOffice: string | null;
  companyCity: string | null;
  companyPhone: string | null;
  contactTitle: string | null;
  salesContact: { name: string; email: string; phone: string } | null;
  locale: 'tr' | 'en';
  theme: 'light' | 'dark' | 'system';
  currency: 'TRY' | 'EUR' | 'USD';
}

// JSON alanının biçimi bozuksa (eksik/yanlış tür) satış iletişimi yokmuş gibi davranılır.
function readSalesContact(value: unknown): UserResponse['salesContact'] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const { name, email, phone } = value as Record<string, unknown>;
  if (typeof name === 'string' && typeof email === 'string' && typeof phone === 'string') {
    return { name, email, phone };
  }
  return null;
}

export function toUserResponse(user: UserRow): UserResponse {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    accountType: user.accountType,
    companyName: user.companyName,
    taxOffice: user.taxOffice,
    companyCity: user.companyCity,
    companyPhone: user.companyPhone,
    contactTitle: user.contactTitle,
    salesContact: readSalesContact(user.salesContact),
    locale: user.locale === 'EN' ? 'en' : 'tr',
    theme: user.theme.toLowerCase() as UserResponse['theme'],
    currency: user.currency,
  };
}
