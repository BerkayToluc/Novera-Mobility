import type { Prisma } from '../../generated/prisma/client.js';
import { isOpen, nextStatuses, canCustomerCancel, type RequestStatus, type RequestType } from './request-flow.js';

// What a service request looks like on the screens, for the customer (`/fleet/requests`) and for the administrator (`/admin/requests`) alike
// (V2-41, docs/FLEET.md §4). Nobody's name is in it: the timeline says whether the company or Novera did a thing, which is all either side
// needs.
export const REQUEST_LIST_INCLUDE = {
  company: { select: { id: true, name: true } },
  vehicle: { select: { id: true, plate: true, vehicleModel: { select: { brand: true, model: true } } } },
} satisfies Prisma.ServiceRequestInclude;

export const REQUEST_DETAIL_INCLUDE = {
  ...REQUEST_LIST_INCLUDE,
  events: { orderBy: [{ at: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.ServiceRequestInclude;

export type RequestListRow = Prisma.ServiceRequestGetPayload<{ include: typeof REQUEST_LIST_INCLUDE }>;
export type RequestDetailRow = Prisma.ServiceRequestGetPayload<{ include: typeof REQUEST_DETAIL_INCLUDE }>;

export type RequestEventView = { status: RequestStatus; note: string | null; at: string; by: 'COMPANY' | 'NOVERA' };

export type RequestView = {
  id: string;
  number: string;
  company: { id: string; name: string };
  type: RequestType;
  status: RequestStatus;
  // Not over yet. Worked out from the kind and the step, never stored.
  open: boolean;
  vehicle: { id: string; plate: string; model: string } | null;
  details: unknown;
  // What Novera wrote down about who is on it (a tow truck, a workshop, a driver); null until something is.
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RequestDetail = RequestView & {
  events: RequestEventView[];
  // The customer can withdraw the request (only while it is `RECEIVED`), and where Novera can move it.
  canCancel: boolean;
  nextStatuses: RequestStatus[];
};

export function requestView(row: RequestListRow): RequestView {
  const type = row.type as RequestType;
  const status = row.status as RequestStatus;
  return {
    id: row.id,
    number: row.number,
    company: row.company,
    type,
    status,
    open: isOpen(type, status),
    vehicle: row.vehicle ? { id: row.vehicle.id, plate: row.vehicle.plate, model: `${row.vehicle.vehicleModel.brand} ${row.vehicle.vehicleModel.model}` } : null,
    details: row.details,
    assignee: row.assignee,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function requestDetail(row: RequestDetailRow): RequestDetail {
  const view = requestView(row);
  return {
    ...view,
    events: row.events.map((event) => ({ status: event.status as RequestStatus, note: event.note, at: event.at.toISOString(), by: event.actor })),
    canCancel: canCustomerCancel(view.status),
    nextStatuses: nextStatuses(view.type, view.status),
  };
}

// A number in the path, as it is stored: capitals. Something that cannot be a number is a request that does not exist.
export const REQUEST_NUMBER = /^TLP-\d{4}-\d{5,}$/;
export const normalizeRequestNumber = (raw: string): string | null => {
  const number = raw.trim().toUpperCase();
  return REQUEST_NUMBER.test(number) ? number : null;
};
