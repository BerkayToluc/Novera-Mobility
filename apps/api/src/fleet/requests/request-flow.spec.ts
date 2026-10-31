import { canCustomerCancel, canMoveTo, isOpen, nextStatuses, REQUEST_FLOWS, REQUEST_STATUSES, REQUEST_TYPES, statusesOf } from './request-flow.js';

describe('the life of a service request (V2-41, SPEC §3.D)', () => {
  it('each kind has the steps of the spec, in order', () => {
    expect(REQUEST_FLOWS.ROADSIDE).toEqual(['RECEIVED', 'DISPATCHED', 'EN_ROUTE', 'COMPLETED']);
    expect(REQUEST_FLOWS.REPLACEMENT_VEHICLE).toEqual(['RECEIVED', 'APPROVED', 'DELIVERED', 'RETURNED']);
    expect(REQUEST_FLOWS.MAINTENANCE).toEqual(['RECEIVED', 'SCHEDULED', 'IN_SERVICE', 'COMPLETED']);
    expect(REQUEST_FLOWS.TRANSFER).toEqual(['RECEIVED', 'DRIVER_ASSIGNED', 'MET', 'COMPLETED']);
  });

  it('every status belongs to some kind, and every kind can be cancelled', () => {
    const used = new Set(REQUEST_TYPES.flatMap((type) => statusesOf(type)));
    expect(used).toEqual(new Set(REQUEST_STATUSES));
    for (const type of REQUEST_TYPES) expect(statusesOf(type)).toContain('CANCELLED');
  });

  it('moves a request to a later step of its kind or to cancelled, and nowhere else', () => {
    expect(nextStatuses('ROADSIDE', 'RECEIVED')).toEqual(['DISPATCHED', 'EN_ROUTE', 'COMPLETED', 'CANCELLED']);
    expect(nextStatuses('ROADSIDE', 'DISPATCHED')).toEqual(['EN_ROUTE', 'COMPLETED', 'CANCELLED']);
    expect(nextStatuses('MAINTENANCE', 'IN_SERVICE')).toEqual(['COMPLETED', 'CANCELLED']);
    expect(canMoveTo('ROADSIDE', 'DISPATCHED', 'EN_ROUTE')).toBe(true);
    // Never back, never to the same step, never to another kind's step.
    expect(canMoveTo('ROADSIDE', 'EN_ROUTE', 'DISPATCHED')).toBe(false);
    expect(canMoveTo('ROADSIDE', 'DISPATCHED', 'DISPATCHED')).toBe(false);
    expect(canMoveTo('ROADSIDE', 'RECEIVED', 'DELIVERED')).toBe(false);
    expect(canMoveTo('REPLACEMENT_VEHICLE', 'RECEIVED', 'IN_SERVICE')).toBe(false);
    expect(canMoveTo('MAINTENANCE', 'RECEIVED', 'RECEIVED')).toBe(false);
  });

  it('a request that is over goes nowhere: the last step of its kind, or cancelled', () => {
    expect(nextStatuses('ROADSIDE', 'COMPLETED')).toEqual([]);
    expect(nextStatuses('REPLACEMENT_VEHICLE', 'RETURNED')).toEqual([]);
    expect(nextStatuses('REPLACEMENT_VEHICLE', 'DELIVERED')).toEqual(['RETURNED', 'CANCELLED']);
    for (const type of REQUEST_TYPES) expect(nextStatuses(type, 'CANCELLED')).toEqual([]);
    expect(isOpen('ROADSIDE', 'EN_ROUTE')).toBe(true);
    expect(isOpen('ROADSIDE', 'COMPLETED')).toBe(false);
    expect(isOpen('REPLACEMENT_VEHICLE', 'DELIVERED')).toBe(true);
    expect(isOpen('REPLACEMENT_VEHICLE', 'RETURNED')).toBe(false);
    expect(isOpen('MAINTENANCE', 'CANCELLED')).toBe(false);
  });

  it('the customer can withdraw a request only while it is received', () => {
    expect(canCustomerCancel('RECEIVED')).toBe(true);
    for (const status of REQUEST_STATUSES.filter((s) => s !== 'RECEIVED')) expect(canCustomerCancel(status)).toBe(false);
  });
});
