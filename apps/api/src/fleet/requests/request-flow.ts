// The life of a service request (V2-41, SPEC §3.D, ARCHITECTURE ADR-31): each kind has its own steps, in order, and a request can be
// cancelled until it is over. Pure, so the rules are tested without a database and the sample mode of the web uses the same table.

export const REQUEST_TYPES = ['ROADSIDE', 'REPLACEMENT_VEHICLE', 'MAINTENANCE', 'TRANSFER'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_STATUSES = ['RECEIVED', 'DISPATCHED', 'EN_ROUTE', 'APPROVED', 'DELIVERED', 'RETURNED', 'SCHEDULED', 'IN_SERVICE', 'DRIVER_ASSIGNED', 'MET', 'COMPLETED', 'CANCELLED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

// The steps of each kind, first to last. The last one ends the request; "cancelled" is outside the line, reachable from any step but the last.
export const REQUEST_FLOWS: Record<RequestType, readonly RequestStatus[]> = {
  ROADSIDE: ['RECEIVED', 'DISPATCHED', 'EN_ROUTE', 'COMPLETED'],
  REPLACEMENT_VEHICLE: ['RECEIVED', 'APPROVED', 'DELIVERED', 'RETURNED'],
  MAINTENANCE: ['RECEIVED', 'SCHEDULED', 'IN_SERVICE', 'COMPLETED'],
  TRANSFER: ['RECEIVED', 'DRIVER_ASSIGNED', 'MET', 'COMPLETED'],
};

// Every status a request of this kind can have.
export const statusesOf = (type: RequestType): RequestStatus[] => [...REQUEST_FLOWS[type], 'CANCELLED'];

// Over: the last step of its kind, or cancelled. An open request is any other.
export function isFinished(type: RequestType, status: RequestStatus): boolean {
  const flow = REQUEST_FLOWS[type];
  return status === 'CANCELLED' || status === flow[flow.length - 1];
}
export const isOpen = (type: RequestType, status: RequestStatus): boolean => !isFinished(type, status);

// Where Novera can move a request from where it is: any later step of its kind (a step may be skipped when the work was done in one go),
// or cancelled; never back, never sideways to another kind's step, never out of a finished request, never to the same step.
export function nextStatuses(type: RequestType, status: RequestStatus): RequestStatus[] {
  if (isFinished(type, status)) return [];
  const flow = REQUEST_FLOWS[type];
  const at = flow.indexOf(status);
  return at < 0 ? [] : [...flow.slice(at + 1), 'CANCELLED'];
}

export const canMoveTo = (type: RequestType, from: RequestStatus, to: RequestStatus): boolean => nextStatuses(type, from).includes(to);

// The customer can only withdraw a request nobody has taken up yet.
export const canCustomerCancel = (status: RequestStatus): boolean => status === 'RECEIVED';
