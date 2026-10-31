// Veritabanındaki kullanıcıyı openapi.yaml `User` biçimine çevirir (passwordHash asla çıkmaz).
export interface UserRow {
  id: string;
  email: string;
  passwordHash: string | null;
  googleSub: string | null;
  firstName: string;
  lastName: string;
  accountType: 'INDIVIDUAL' | 'CORPORATE';
  // Panel yetkisi (V2-23); yalnızca `pnpm admin:create` değiştirir.
  role: 'CUSTOMER' | 'ADMIN';
  contactTitle: string | null;
  // Kurumsal hesabın şirketi (V2-33). `GET /me` cevabının firma alanları buradan doldurulur; bu yüzden bir kullanıcıyı `/me` için
  // yükleyen her sorgu şirketi de getirir (`USER_WITH_COMPANY`). Yüklenmediyse (ya da şirket yoksa) firma alanları boştur.
  companyId?: string | null;
  company?: CompanyRow | null;
  locale: 'TR' | 'EN';
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  currency: 'TRY' | 'EUR' | 'USD';
  notifyReminders: boolean;
  notifyCampaigns: boolean;
}

// Şirketin `GET /me` için gereken kısmı. Veritabanında `salesContact` JSON'dur: { "name": "...", "email": "...", "phone": "..." } ya da boş.
export interface CompanyRow {
  name: string;
  taxOffice: string | null;
  city: string | null;
  phone: string | null;
  salesContact: unknown;
  // Şirketin etkin filo sözleşmesi (en çok biri yüklenir): Filom bağlantısı yalnızca sözleşmeli şirkette görünür (V2-36).
  fleetContracts?: Array<{ id: string }>;
}

// Kullanıcıyı şirketiyle birlikte yükleyen sorgu seçeneği (Prisma `include`).
// Şirketle birlikte etkin bir filo sözleşmesi olup olmadığı da gelir (`hasFleet`): tek satırlık küçük bir sorgu, yalnızca kurumsal hesapta.
export const USER_WITH_COMPANY = { company: { include: { fleetContracts: { where: { status: 'ACTIVE' as const }, select: { id: true }, take: 1 } } } } as const;

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType: 'INDIVIDUAL' | 'CORPORATE';
  role: 'CUSTOMER' | 'ADMIN';
  companyName: string | null;
  taxOffice: string | null;
  companyCity: string | null;
  companyPhone: string | null;
  contactTitle: string | null;
  salesContact: { name: string; email: string; phone: string } | null;
  locale: 'tr' | 'en';
  theme: 'light' | 'dark' | 'system';
  currency: 'TRY' | 'EUR' | 'USD';
  notifications: { reminders: boolean; campaigns: boolean };
  // false: the account was opened with Google and has no password yet.
  hasPassword: boolean;
  googleLinked: boolean;
  // Şirketin etkin filo sözleşmesi var: Filom'un giriş noktaları görünür (V2-36). Bireysel hesapta ve sözleşmesiz şirkette yanlıştır.
  hasFleet: boolean;
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
    role: user.role,
    companyName: user.company?.name ?? null,
    taxOffice: user.company?.taxOffice ?? null,
    companyCity: user.company?.city ?? null,
    companyPhone: user.company?.phone ?? null,
    contactTitle: user.contactTitle,
    salesContact: readSalesContact(user.company?.salesContact),
    locale: user.locale === 'EN' ? 'en' : 'tr',
    theme: user.theme.toLowerCase() as UserResponse['theme'],
    currency: user.currency,
    notifications: { reminders: user.notifyReminders, campaigns: user.notifyCampaigns },
    hasPassword: user.passwordHash !== null,
    googleLinked: user.googleSub !== null,
    hasFleet: user.accountType === 'CORPORATE' && (user.company?.fleetContracts?.length ?? 0) > 0,
  };
}
