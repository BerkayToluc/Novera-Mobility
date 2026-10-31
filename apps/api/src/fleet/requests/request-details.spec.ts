import { parseDetails } from './request-details.js';

const TODAY = '2026-10-31';
const NOW = new Date('2026-10-31T10:00:00.000Z');
const errorsOf = (result: ReturnType<typeof parseDetails>) => ('errors' in result ? result.errors : null);

describe('the details of a roadside request (V2-41)', () => {
  const good = { incident: 'BREAKDOWN', location: { address: 'D550 Karayolu 12. km, İzmir' }, description: 'Motor uyarı ışığı yandı' };

  it('takes an address, or a position from the phone, or both', () => {
    expect(parseDetails('ROADSIDE', good, TODAY)).toEqual({ value: { incident: 'BREAKDOWN', location: { address: 'D550 Karayolu 12. km, İzmir', latitude: null, longitude: null }, description: 'Motor uyarı ışığı yandı' } });
    const byPosition = parseDetails('ROADSIDE', { incident: 'TIRE', location: { latitude: 38.42, longitude: 27.14 } }, TODAY);
    expect(byPosition).toEqual({ value: { incident: 'TIRE', location: { address: null, latitude: 38.42, longitude: 27.14 }, description: null } });
    expect('value' in parseDetails('ROADSIDE', { ...good, location: { address: 'x', latitude: 1, longitude: 2 } }, TODAY)).toBe(true);
  });

  it('names the field that is wrong, with a dotted name', () => {
    expect(errorsOf(parseDetails('ROADSIDE', {}, TODAY))).toEqual({ 'details.incident': 'REQUIRED', 'details.location': 'REQUIRED' });
    expect(errorsOf(parseDetails('ROADSIDE', { ...good, incident: 'FLOOD' }, TODAY))).toEqual({ 'details.incident': 'INVALID_FORMAT' });
    expect(errorsOf(parseDetails('ROADSIDE', { ...good, description: 'x'.repeat(501) }, TODAY))).toEqual({ 'details.description': 'TOO_LONG' });
    expect(errorsOf(parseDetails('ROADSIDE', { ...good, location: {} }, TODAY))).toEqual({ 'details.location': 'REQUIRED' });
    expect(errorsOf(parseDetails('ROADSIDE', { ...good, location: { address: '   ' } }, TODAY))).toEqual({ 'details.location': 'REQUIRED' });
    expect(errorsOf(parseDetails('ROADSIDE', { ...good, location: 'burada' }, TODAY))).toEqual({ 'details.location': 'INVALID_FORMAT' });
    expect(errorsOf(parseDetails('ROADSIDE', { ...good, location: { latitude: 38 } }, TODAY))).toEqual({ 'details.location': 'INVALID_FORMAT' });
    expect(errorsOf(parseDetails('ROADSIDE', { ...good, location: { latitude: 138, longitude: 27 } }, TODAY))).toEqual({ 'details.location.latitude': 'OUT_OF_RANGE' });
    expect(errorsOf(parseDetails('ROADSIDE', { ...good, location: { latitude: '38', longitude: 27 } }, TODAY))).toEqual({ 'details.location.latitude': 'INVALID_FORMAT' });
  });
});

describe('the details of a replacement vehicle request', () => {
  const good = { address: 'Alsancak, İzmir', date: '2026-11-03', durationDays: 5 };

  it('takes an address, a day from today on and a number of days', () => {
    expect(parseDetails('REPLACEMENT_VEHICLE', good, TODAY)).toEqual({ value: good });
    expect('value' in parseDetails('REPLACEMENT_VEHICLE', { ...good, date: TODAY }, TODAY)).toBe(true);
  });

  it('names the field that is wrong', () => {
    expect(errorsOf(parseDetails('REPLACEMENT_VEHICLE', {}, TODAY))).toEqual({ 'details.durationDays': 'REQUIRED', 'details.address': 'REQUIRED', 'details.date': 'REQUIRED' });
    expect(errorsOf(parseDetails('REPLACEMENT_VEHICLE', { ...good, date: '2026-10-30' }, TODAY))).toEqual({ 'details.date': 'OUT_OF_RANGE' });
    expect(errorsOf(parseDetails('REPLACEMENT_VEHICLE', { ...good, date: '2028-01-01' }, TODAY))).toEqual({ 'details.date': 'OUT_OF_RANGE' });
    expect(errorsOf(parseDetails('REPLACEMENT_VEHICLE', { ...good, date: '2026-02-30' }, TODAY))).toEqual({ 'details.date': 'INVALID_FORMAT' });
    for (const [durationDays, code] of [[0, 'OUT_OF_RANGE'], [91, 'OUT_OF_RANGE'], [2.5, 'INVALID_FORMAT'], ['5', 'INVALID_FORMAT']] as const) {
      expect(errorsOf(parseDetails('REPLACEMENT_VEHICLE', { ...good, durationDays }, TODAY))).toEqual({ 'details.durationDays': code });
    }
    expect(errorsOf(parseDetails('REPLACEMENT_VEHICLE', { ...good, address: 'a'.repeat(201) }, TODAY))).toEqual({ 'details.address': 'TOO_LONG' });
  });
});

describe('the details of a maintenance request', () => {
  const good = { service: 'WINTER_TIRES', preferredDate: '2026-11-10', valet: false };

  it('takes a service, a day and whether a valet comes; the address is needed only for a valet', () => {
    expect(parseDetails('MAINTENANCE', good, TODAY)).toEqual({ value: { ...good, address: null } });
    expect(parseDetails('MAINTENANCE', { ...good, valet: true, address: 'Bornova' }, TODAY)).toEqual({ value: { ...good, valet: true, address: 'Bornova' } });
    expect(errorsOf(parseDetails('MAINTENANCE', { ...good, valet: true }, TODAY))).toEqual({ 'details.address': 'REQUIRED' });
  });

  it('names the field that is wrong', () => {
    expect(errorsOf(parseDetails('MAINTENANCE', {}, TODAY))).toEqual({ 'details.valet': 'REQUIRED', 'details.service': 'REQUIRED', 'details.preferredDate': 'REQUIRED' });
    expect(errorsOf(parseDetails('MAINTENANCE', { ...good, service: 'WASH' }, TODAY))).toEqual({ 'details.service': 'INVALID_FORMAT' });
    expect(errorsOf(parseDetails('MAINTENANCE', { ...good, valet: 'evet' }, TODAY))).toEqual({ 'details.valet': 'INVALID_FORMAT' });
    expect(errorsOf(parseDetails('MAINTENANCE', { ...good, preferredDate: '2025-01-01' }, TODAY))).toEqual({ 'details.preferredDate': 'OUT_OF_RANGE' });
  });
});

describe('what is not a set of details', () => {
  it('is REQUIRED when missing and INVALID_FORMAT when it is not an object', () => {
    for (const type of ['ROADSIDE', 'REPLACEMENT_VEHICLE', 'MAINTENANCE'] as const) {
      expect(errorsOf(parseDetails(type, undefined, TODAY))).toEqual({ details: 'REQUIRED' });
      expect(errorsOf(parseDetails(type, 'x', TODAY))).toEqual({ details: 'INVALID_FORMAT' });
      expect(errorsOf(parseDetails(type, [], TODAY))).toEqual({ details: 'INVALID_FORMAT' });
    }
  });

  it('a transfer is read as a transfer, so a roadside request’s fields are not', () => {
    expect(errorsOf(parseDetails('TRANSFER', { incident: 'TIRE' }, TODAY, NOW))).toMatchObject({ 'details.passengerName': 'REQUIRED' });
  });
});

describe('the details of a transfer request (V2-42)', () => {
  const good = { passengerName: 'Ada Kaya', passengers: 3, flightNumber: 'TK1234', meeting: { airport: 'ADB' }, meetingAt: '2026-11-03T09:30:00+03:00', destination: 'Alsancak, İzmir', note: 'Tabelayla karşılama' };

  it('takes a passenger, a count, a flight, an airport or an address, a moment and a destination', () => {
    expect(parseDetails('TRANSFER', good, TODAY, NOW)).toEqual({
      value: { passengerName: 'Ada Kaya', passengers: 3, flightNumber: 'TK1234', meeting: { airport: 'ADB', address: null }, meetingAt: '2026-11-03T06:30:00.000Z', destination: 'Alsancak, İzmir', note: 'Tabelayla karşılama' },
    });
    // The flight and the note are optional; the flight is kept in capitals without spaces; the place may be an address.
    const bare = parseDetails('TRANSFER', { passengerName: 'Ada Kaya', passengers: 1, flightNumber: ' tk 12 ', meeting: { address: 'Otel Lobisi' }, meetingAt: '2026-11-03T09:30:00+03:00', destination: 'Havalimanı' }, TODAY, NOW);
    expect(bare).toMatchObject({ value: { flightNumber: 'TK12', meeting: { airport: null, address: 'Otel Lobisi' }, note: null } });
    expect(parseDetails('TRANSFER', { ...good, flightNumber: '' }, TODAY, NOW)).toMatchObject({ value: { flightNumber: null } });
  });

  it('names the field that is wrong', () => {
    expect(errorsOf(parseDetails('TRANSFER', {}, TODAY, NOW))).toEqual({
      'details.passengerName': 'REQUIRED',
      'details.passengers': 'REQUIRED',
      'details.meeting': 'REQUIRED',
      'details.meetingAt': 'REQUIRED',
      'details.destination': 'REQUIRED',
    });
    for (const [passengers, code] of [[0, 'OUT_OF_RANGE'], [8, 'OUT_OF_RANGE'], [2.5, 'INVALID_FORMAT'], ['3', 'INVALID_FORMAT']] as const) {
      expect(errorsOf(parseDetails('TRANSFER', { ...good, passengers }, TODAY, NOW))).toEqual({ 'details.passengers': code });
    }
    for (const flightNumber of ['TURKISH1', 'T', '1234', 'TK12345', 'TK-12']) expect(errorsOf(parseDetails('TRANSFER', { ...good, flightNumber }, TODAY, NOW))).toEqual({ 'details.flightNumber': 'INVALID_FORMAT' });
    expect(errorsOf(parseDetails('TRANSFER', { ...good, passengerName: 'x'.repeat(101) }, TODAY, NOW))).toEqual({ 'details.passengerName': 'TOO_LONG' });
    expect(errorsOf(parseDetails('TRANSFER', { ...good, destination: '' }, TODAY, NOW))).toEqual({ 'details.destination': 'REQUIRED' });
    expect(errorsOf(parseDetails('TRANSFER', { ...good, note: 'n'.repeat(501) }, TODAY, NOW))).toEqual({ 'details.note': 'TOO_LONG' });
  });

  it('the place is an airport of the list or an address, one of them', () => {
    expect(errorsOf(parseDetails('TRANSFER', { ...good, meeting: { airport: 'XXX' } }, TODAY, NOW))).toEqual({ 'details.meeting.airport': 'INVALID_FORMAT' });
    expect(errorsOf(parseDetails('TRANSFER', { ...good, meeting: {} }, TODAY, NOW))).toEqual({ 'details.meeting': 'REQUIRED' });
    expect(errorsOf(parseDetails('TRANSFER', { ...good, meeting: { airport: 'IST', address: 'Otel' } }, TODAY, NOW))).toEqual({ 'details.meeting': 'INVALID_FORMAT' });
    expect(errorsOf(parseDetails('TRANSFER', { ...good, meeting: 'IST' }, TODAY, NOW))).toEqual({ 'details.meeting': 'INVALID_FORMAT' });
  });

  it('the moment is at least two hours from now and at most a year; the edge itself is allowed', () => {
    const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();
    expect('value' in parseDetails('TRANSFER', { ...good, meetingAt: at(2 * 3_600_000) }, TODAY, NOW)).toBe(true);
    expect(errorsOf(parseDetails('TRANSFER', { ...good, meetingAt: at(2 * 3_600_000 - 1_000) }, TODAY, NOW))).toEqual({ 'details.meetingAt': 'OUT_OF_RANGE' });
    expect(errorsOf(parseDetails('TRANSFER', { ...good, meetingAt: at(-3_600_000) }, TODAY, NOW))).toEqual({ 'details.meetingAt': 'OUT_OF_RANGE' });
    expect(errorsOf(parseDetails('TRANSFER', { ...good, meetingAt: at(400 * 86_400_000) }, TODAY, NOW))).toEqual({ 'details.meetingAt': 'OUT_OF_RANGE' });
    expect(errorsOf(parseDetails('TRANSFER', { ...good, meetingAt: 'yarın' }, TODAY, NOW))).toEqual({ 'details.meetingAt': 'INVALID_FORMAT' });
    expect(errorsOf(parseDetails('TRANSFER', { ...good, meetingAt: '2026-11-03' }, TODAY, NOW))).toEqual({ 'details.meetingAt': 'INVALID_FORMAT' });
  });
});
