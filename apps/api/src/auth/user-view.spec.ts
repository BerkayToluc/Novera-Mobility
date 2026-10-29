import { toUserResponse, type UserRow } from './user-view.js';

// V2-19 (QUALITY T-03): the row becomes the contract's `User`; the password hash never leaves.
const row = (over: Partial<UserRow> = {}): UserRow => ({
  id: 'u1',
  email: 'elif@example.com',
  passwordHash: 'scrypt$secret',
  googleSub: null,
  firstName: 'Elif',
  lastName: 'Yıldız',
  accountType: 'INDIVIDUAL',
  role: 'CUSTOMER',
  companyName: null,
  taxOffice: null,
  companyCity: null,
  companyPhone: null,
  contactTitle: null,
  salesContact: null,
  locale: 'TR',
  theme: 'LIGHT',
  currency: 'TRY',
  notifyReminders: true,
  notifyCampaigns: false,
  ...over,
});

describe('toUserResponse', () => {
  it('maps an individual account and never carries the hash or the Google id', () => {
    const view = toUserResponse(row());
    expect(view).toEqual({
      id: 'u1',
      email: 'elif@example.com',
      firstName: 'Elif',
      lastName: 'Yıldız',
      accountType: 'INDIVIDUAL',
      role: 'CUSTOMER',
      companyName: null,
      taxOffice: null,
      companyCity: null,
      companyPhone: null,
      contactTitle: null,
      salesContact: null,
      locale: 'tr',
      theme: 'light',
      currency: 'TRY',
      notifications: { reminders: true, campaigns: false },
      hasPassword: true,
      googleLinked: false,
    });
    expect(JSON.stringify(view)).not.toContain('scrypt');
    expect(view).not.toHaveProperty('passwordHash');
    expect(view).not.toHaveProperty('googleSub');
  });

  it('lower-cases the theme and the language, and says whether a password or Google is set', () => {
    const view = toUserResponse(
      row({ locale: 'EN', theme: 'SYSTEM', currency: 'EUR', passwordHash: null, googleSub: 'sub-1' }),
    );
    expect(view).toMatchObject({
      locale: 'en',
      theme: 'system',
      currency: 'EUR',
      hasPassword: false,
      googleLinked: true,
    });
  });

  it('reads the sales contact of a corporate account', () => {
    const salesContact = { name: 'Selin', email: 'satis@novera.example', phone: '+90 212 555 01 99' };
    expect(
      toUserResponse(row({ accountType: 'CORPORATE', companyName: 'Ege Lojistik', salesContact })).salesContact,
    ).toEqual(salesContact);
  });

  it.each([
    [null],
    [undefined],
    ['Selin'],
    [42],
    [['Selin']],
    [{ name: 'Selin' }],
    [{ name: 'Selin', email: 'a@b.c', phone: 5 }],
  ])('treats a sales contact of the wrong shape (%j) as none', (salesContact) => {
    expect(toUserResponse(row({ salesContact })).salesContact).toBeNull();
  });
});
