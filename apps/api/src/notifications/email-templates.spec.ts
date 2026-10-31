import {
  BRAND_COLORS,
  REQUEST_STATUS_WORDS,
  REQUEST_TYPE_WORDS,
  reservationCancelledEmail,
  reservationConfirmedEmail,
  reservationReminderEmail,
  requestStatusEmail,
  type RequestMail,
  type ReservationMail,
} from './email-templates.js';

// The e-mails of V2-44, as pure functions: the words, the language, what is in them and what is kept out.
const BOOKING: ReservationMail = {
  firstName: 'Ayşe',
  number: 'NVR-2026-00123',
  vehicle: 'Fiat Egea',
  pickup: 'Alsancak, İzmir',
  dropoff: 'Esenboğa, Ankara',
  startAt: new Date('2026-11-05T07:30:00.000Z'), // 10:30 in Istanbul
  endAt: new Date('2026-11-08T15:00:00.000Z'), // 18:00 in Istanbul
  total: 1_234_567,
  currency: 'TRY',
  termsUrl: 'https://novera.example/kiralama-kosullari',
};
const REQUEST: RequestMail = { firstName: 'Ayşe', number: 'TLP-2026-00007', type: 'Yol yardım', status: 'Yolda', plate: '35 FLM 101', url: 'https://novera.example/filom/talepler/TLP-2026-00007' };

describe('a booking confirmed', () => {
  it('says the number, the car, both places, the two moments in Istanbul time and the total, in Turkish', () => {
    const mail = reservationConfirmedEmail(BOOKING, 'TR');
    expect(mail.subject).toBe('Rezervasyonun onaylandı (NVR-2026-00123)');
    for (const part of ['Merhaba Ayşe,', 'NVR-2026-00123', 'Fiat Egea', 'Alsancak, İzmir', 'Esenboğa, Ankara', '10:30', '18:00', '5 Kasım 2026', '12.345,67']) expect(mail.text).toContain(part);
    expect(mail.text).toContain('İptal koşulları: https://novera.example/kiralama-kosullari');
    expect(mail.html).toContain('href="https://novera.example/kiralama-kosullari"');
  });

  it('says the same in English, with the English moments and money', () => {
    const mail = reservationConfirmedEmail(BOOKING, 'EN');
    expect(mail.subject).toBe('Your booking is confirmed (NVR-2026-00123)');
    for (const part of ['Hello Ayşe,', 'Booking no.: NVR-2026-00123', '5 November 2026', '10:30', '12,345.67']) expect(mail.text).toContain(part);
    expect(mail.text).toContain('Cancellation terms:');
  });

  it('writes the amount in the currency of the booking', () => {
    expect(reservationConfirmedEmail({ ...BOOKING, currency: 'EUR', total: 25_000 }, 'EN').text).toContain('€250.00');
    expect(reservationConfirmedEmail({ ...BOOKING, currency: 'USD', total: 25_000 }, 'EN').text).toContain('$250.00');
  });
});

describe('a booking cancelled', () => {
  it('says it was cancelled and keeps the reason, if there was one, out of it', () => {
    const mail = reservationCancelledEmail(BOOKING, 'TR');
    expect(mail.subject).toBe('Rezervasyonun iptal edildi (NVR-2026-00123)');
    expect(mail.text).toContain('iptal edildi');
    expect(Object.keys(BOOKING)).not.toContain('reason');
    expect(reservationCancelledEmail(BOOKING, 'EN').subject).toBe('Your booking was cancelled (NVR-2026-00123)');
  });
});

describe('the reminder', () => {
  it('says the rental begins within a day, and what to bring, in both languages', () => {
    expect(reservationReminderEmail(BOOKING, 'TR').subject).toBe('Yarın aracını teslim alıyorsun (NVR-2026-00123)');
    expect(reservationReminderEmail(BOOKING, 'TR').text).toContain('ehliyetini');
    expect(reservationReminderEmail(BOOKING, 'EN').subject).toBe('You pick up your car tomorrow (NVR-2026-00123)');
    expect(reservationReminderEmail(BOOKING, 'EN').text).toContain('driving licence');
  });

  it('says how to turn it off', () => {
    expect(reservationReminderEmail(BOOKING, 'TR').text).toContain('hesap ayarlarından kapatabilirsin');
    expect(reservationReminderEmail(BOOKING, 'EN').text).toContain('account settings');
  });
});

describe('a request that moved', () => {
  it('says the number, the kind and the new step, with the car and a link to the request', () => {
    const mail = requestStatusEmail(REQUEST, 'TR');
    expect(mail.subject).toBe('Talebin güncellendi: Yolda (TLP-2026-00007)');
    for (const part of ['TLP-2026-00007', 'Yol yardım', 'Yolda', '35 FLM 101', 'https://novera.example/filom/talepler/TLP-2026-00007']) expect(mail.text).toContain(part);
    expect(requestStatusEmail(REQUEST, 'EN').subject).toBe('Your request was updated: Yolda (TLP-2026-00007)');
  });

  it('leaves the car out for a request that has none (a transfer)', () => {
    const mail = requestStatusEmail({ ...REQUEST, plate: null }, 'TR');
    expect(mail.text).not.toContain('Araç:');
  });

  it('has a word in both languages for every kind and every step', () => {
    const types = ['ROADSIDE', 'REPLACEMENT_VEHICLE', 'MAINTENANCE', 'TRANSFER'];
    const statuses = ['RECEIVED', 'DISPATCHED', 'EN_ROUTE', 'APPROVED', 'DELIVERED', 'RETURNED', 'SCHEDULED', 'IN_SERVICE', 'DRIVER_ASSIGNED', 'MET', 'COMPLETED', 'CANCELLED'];
    for (const locale of ['TR', 'EN'] as const) {
      expect(Object.keys(REQUEST_TYPE_WORDS[locale]).sort()).toEqual([...types].sort());
      expect(Object.keys(REQUEST_STATUS_WORDS[locale]).sort()).toEqual([...statuses].sort());
    }
  });
});

describe('every one of them', () => {
  const all = [reservationConfirmedEmail(BOOKING, 'TR'), reservationCancelledEmail(BOOKING, 'EN'), reservationReminderEmail(BOOKING, 'TR'), requestStatusEmail(REQUEST, 'EN')];

  it('has a plain-text and an HTML body, and the brand colour', () => {
    for (const mail of all) {
      expect(mail.text.length).toBeGreaterThan(40);
      expect(mail.html).toContain(BRAND_COLORS.brand);
      expect(mail.html.startsWith('<div')).toBe(true);
    }
  });

  it('escapes what a person or a place can contain, so a name cannot add markup', () => {
    const mail = reservationConfirmedEmail({ ...BOOKING, firstName: '<script>alert(1)</script>', vehicle: 'A & B "C"' }, 'TR');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('A &amp; B &quot;C&quot;');
  });

  it('holds no more of the person than a first name', () => {
    for (const mail of all) expect(mail.text + mail.html).not.toMatch(/@|\+90|Yılmaz/);
  });
});
