import { parseDetails } from './request-details.js';

const TODAY = '2026-10-31';
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

  it('a transfer has no shape yet (V2-42)', () => {
    expect(errorsOf(parseDetails('TRANSFER', { passenger: 'Ada' }, TODAY))).toEqual({ type: 'NOT_ALLOWED' });
  });
});
