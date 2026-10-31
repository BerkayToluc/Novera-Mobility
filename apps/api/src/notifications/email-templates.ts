// The e-mails of the site that are about a booking or a service request (V2-44, docs/ARCHITECTURE.md ADR-32): a booking confirmed, a booking
// cancelled, the reminder the day before the rental, and a service request that moved to another step. Pure functions: what goes in is
// data already read, what comes out is a subject, a plain-text body and a simple HTML body, in the language of the person.
//
// The rules they keep: as little personal data as the message needs (a first name, the numbers, the car and the places; no phone, no address
// of the person, no reason for a cancellation), every value put in the HTML is escaped, and the brand colour is the one of SPEC §5.1.
export type MailLocale = 'TR' | 'EN';
export type Mail = { subject: string; text: string; html: string };

// SPEC §5.1 olive 700, the same value as the web app's `BRAND_COLORS.brand` (apps/web/lib/brand.ts): an e-mail cannot read the site's CSS.
export const BRAND_COLORS = { brand: '#45561d', onBrand: '#ffffff', muted: '#666666' } as const;

export type ReservationMail = {
  firstName: string;
  number: string;
  vehicle: string;
  pickup: string;
  dropoff: string;
  startAt: Date;
  endAt: Date;
  // In the currency's minor unit (kuruş, cent), the way the booking keeps it.
  total: number;
  currency: 'TRY' | 'EUR' | 'USD';
  // The page of the rental terms in the person's language (the cancellation rules are there).
  termsUrl: string;
};

export type RequestMail = {
  firstName: string;
  number: string;
  type: string;
  status: string;
  // The plate of the car the request is about; transfers have none.
  plate: string | null;
  // The page of the request, in the person's language.
  url: string;
};

const escapeHtml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TAG = { TR: 'tr-TR', EN: 'en-GB' } as const;
const when = (at: Date, locale: MailLocale): string =>
  new Intl.DateTimeFormat(TAG[locale], { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(at);
const money = (minor: number, currency: ReservationMail['currency'], locale: MailLocale): string =>
  new Intl.NumberFormat(TAG[locale], { style: 'currency', currency }).format(minor / 100);

type Row = [label: string, value: string];

// One layout for all of them: a heading, a line of words, a small table of facts, an optional button, a grey closing line.
function layout(input: { subject: string; hello: string; intro: string; rows: Row[]; action?: { label: string; url: string }; outro: string }): Mail {
  const text = [
    input.hello,
    '',
    input.intro,
    '',
    ...input.rows.map(([label, value]) => `${label}: ${value}`),
    ...(input.action ? ['', `${input.action.label}: ${input.action.url}`] : []),
    '',
    input.outro,
    '',
    'Novera Mobility',
  ].join('\n');
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1c;max-width:560px">` +
    `<h1 style="font-size:20px;color:${BRAND_COLORS.brand};margin:0 0 16px">${escapeHtml(input.subject)}</h1>` +
    `<p>${escapeHtml(input.hello)}</p><p>${escapeHtml(input.intro)}</p>` +
    `<table role="presentation" style="border-collapse:collapse;width:100%;margin:16px 0">` +
    input.rows.map(([label, value]) => `<tr><td style="padding:6px 12px 6px 0;color:${BRAND_COLORS.muted}">${escapeHtml(label)}</td><td style="padding:6px 0"><strong>${escapeHtml(value)}</strong></td></tr>`).join('') +
    `</table>` +
    (input.action ? `<p><a href="${escapeHtml(input.action.url)}" style="display:inline-block;background:${BRAND_COLORS.brand};color:${BRAND_COLORS.onBrand};padding:10px 18px;text-decoration:none;border-radius:6px">${escapeHtml(input.action.label)}</a></p>` : '') +
    `<p style="color:${BRAND_COLORS.muted}">${escapeHtml(input.outro)}</p><p style="color:${BRAND_COLORS.muted}">Novera Mobility</p></div>`;
  return { subject: input.subject, text, html };
}

const WORDS = {
  TR: {
    hello: (name: string) => `Merhaba ${name},`,
    number: 'Rezervasyon no',
    vehicle: 'Araç',
    pickup: 'Teslim alış',
    dropoff: 'Teslim bırakış',
    start: 'Başlangıç',
    end: 'Bitiş',
    total: 'Toplam',
    terms: 'İptal koşulları',
    confirmedSubject: (n: string) => `Rezervasyonun onaylandı (${n})`,
    confirmedIntro: 'Rezervasyonun onaylandı. Ayrıntılar aşağıda.',
    confirmedOutro: 'Kiralama başlamadan önce Rezervasyonlarım sayfasından iptal edebilirsin.',
    cancelledSubject: (n: string) => `Rezervasyonun iptal edildi (${n})`,
    cancelledIntro: 'Aşağıdaki rezervasyon iptal edildi. Araç başkalarına yeniden açıldı; puan harcadıysan puanların hesabına geri döner.',
    cancelledOutro: 'Bir hata olduğunu düşünüyorsan bizimle iletişime geçebilirsin.',
    reminderSubject: (n: string) => `Yarın aracını teslim alıyorsun (${n})`,
    reminderIntro: 'Kiralaman 24 saat içinde başlıyor. Teslim alırken ehliyetini ve kimliğini yanında getirmeyi unutma.',
    reminderOutro: 'Bu hatırlatmayı hesap ayarlarından kapatabilirsin.',
    request: 'Talep no',
    requestType: 'Talep türü',
    requestStatus: 'Yeni durum',
    requestVehicle: 'Araç',
    requestOpen: 'Talebi görüntüle',
    requestSubject: (n: string, status: string) => `Talebin güncellendi: ${status} (${n})`,
    requestIntro: 'Servis talebinin durumu değişti.',
    requestOutro: 'Ayrıntıları ve zaman çizelgesini Filom\'daki talep sayfasında görebilirsin.',
  },
  EN: {
    hello: (name: string) => `Hello ${name},`,
    number: 'Booking no.',
    vehicle: 'Car',
    pickup: 'Pick-up',
    dropoff: 'Return',
    start: 'Starts',
    end: 'Ends',
    total: 'Total',
    terms: 'Cancellation terms',
    confirmedSubject: (n: string) => `Your booking is confirmed (${n})`,
    confirmedIntro: 'Your booking is confirmed. The details are below.',
    confirmedOutro: 'You can cancel it from My bookings until the rental starts.',
    cancelledSubject: (n: string) => `Your booking was cancelled (${n})`,
    cancelledIntro: 'The booking below was cancelled. The car is open to others again; if you spent points they come back to your account.',
    cancelledOutro: 'If you think this is a mistake, get in touch with us.',
    reminderSubject: (n: string) => `You pick up your car tomorrow (${n})`,
    reminderIntro: 'Your rental starts within 24 hours. Remember to bring your driving licence and ID when you collect the car.',
    reminderOutro: 'You can turn this reminder off in your account settings.',
    request: 'Request no.',
    requestType: 'Type',
    requestStatus: 'New status',
    requestVehicle: 'Car',
    requestOpen: 'View the request',
    requestSubject: (n: string, status: string) => `Your request was updated: ${status} (${n})`,
    requestIntro: 'The status of your service request has changed.',
    requestOutro: 'You can see the details and the timeline on the request page in Filom.',
  },
} as const;

function reservationRows(data: ReservationMail, locale: MailLocale): Row[] {
  const w = WORDS[locale];
  return [
    [w.number, data.number],
    [w.vehicle, data.vehicle],
    [w.pickup, data.pickup],
    [w.dropoff, data.dropoff],
    [w.start, when(data.startAt, locale)],
    [w.end, when(data.endAt, locale)],
    [w.total, money(data.total, data.currency, locale)],
  ];
}

export function reservationConfirmedEmail(data: ReservationMail, locale: MailLocale): Mail {
  const w = WORDS[locale];
  return layout({ subject: w.confirmedSubject(data.number), hello: w.hello(data.firstName), intro: w.confirmedIntro, rows: reservationRows(data, locale), action: { label: w.terms, url: data.termsUrl }, outro: w.confirmedOutro });
}

// No reason is in it: an administrator's reason is for the record, not for the person (docs/ADMIN.md §3.7).
export function reservationCancelledEmail(data: ReservationMail, locale: MailLocale): Mail {
  const w = WORDS[locale];
  return layout({ subject: w.cancelledSubject(data.number), hello: w.hello(data.firstName), intro: w.cancelledIntro, rows: reservationRows(data, locale), outro: w.cancelledOutro });
}

export function reservationReminderEmail(data: ReservationMail, locale: MailLocale): Mail {
  const w = WORDS[locale];
  return layout({ subject: w.reminderSubject(data.number), hello: w.hello(data.firstName), intro: w.reminderIntro, rows: reservationRows(data, locale), action: { label: w.terms, url: data.termsUrl }, outro: w.reminderOutro });
}

// Only the words of the step go in, never the note an administrator wrote on it (it can name a driver or a tow company).
export function requestStatusEmail(data: RequestMail, locale: MailLocale): Mail {
  const w = WORDS[locale];
  const rows: Row[] = [[w.request, data.number], [w.requestType, data.type], [w.requestStatus, data.status], ...(data.plate ? ([[w.requestVehicle, data.plate]] as Row[]) : [])];
  return layout({ subject: w.requestSubject(data.number, data.status), hello: w.hello(data.firstName), intro: w.requestIntro, rows, action: { label: w.requestOpen, url: data.url }, outro: w.requestOutro });
}

export const REQUEST_TYPE_WORDS = {
  TR: { ROADSIDE: 'Yol yardım', REPLACEMENT_VEHICLE: 'İkame araç', MAINTENANCE: 'Bakım ve lastik', TRANSFER: 'VIP transfer' },
  EN: { ROADSIDE: 'Roadside assistance', REPLACEMENT_VEHICLE: 'Replacement vehicle', MAINTENANCE: 'Maintenance and tyres', TRANSFER: 'VIP transfer' },
} as const;

export const REQUEST_STATUS_WORDS = {
  TR: { RECEIVED: 'Alındı', DISPATCHED: 'Yönlendirildi', EN_ROUTE: 'Yolda', APPROVED: 'Onaylandı', DELIVERED: 'Teslim edildi', RETURNED: 'İade alındı', SCHEDULED: 'Randevu verildi', IN_SERVICE: 'Serviste', DRIVER_ASSIGNED: 'Şoför atandı', MET: 'Karşılandı', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal edildi' },
  EN: { RECEIVED: 'Received', DISPATCHED: 'Dispatched', EN_ROUTE: 'On the way', APPROVED: 'Approved', DELIVERED: 'Delivered', RETURNED: 'Returned', SCHEDULED: 'Appointment made', IN_SERVICE: 'In service', DRIVER_ASSIGNED: 'Driver assigned', MET: 'Met', COMPLETED: 'Completed', CANCELLED: 'Cancelled' },
} as const;
