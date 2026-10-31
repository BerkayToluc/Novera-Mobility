import { Inject, Injectable } from '@nestjs/common';
import type { Page } from '../admin/admin-list.js';
import { invalidTransition } from '../admin/admin.errors.js';
import { istanbulDay } from '../common/time.js';
import { isUuid } from '../common/uuid.js';
import { parseInput, validationFailed } from '../common/zod-validation.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fleetNotFound } from './fleet.errors.js';
import { parseDetails } from './requests/request-details.js';
import { canCustomerCancel, REQUEST_FLOWS, type RequestStatus, type RequestType } from './requests/request-flow.js';
import { createRequestSchema, listFleetRequestSchema } from './requests/request.schemas.js';
import { normalizeRequestNumber, requestDetail, requestView, REQUEST_DETAIL_INCLUDE, REQUEST_LIST_INCLUDE, type RequestDetail, type RequestView } from './requests/request.view.js';

export type CreatedRequest = RequestDetail & {
  // The numbers of the other requests of this kind for this car that are still open: a notice, not an obstacle (docs/FLEET.md §3.1).
  similarOpen: string[];
};

// The steps after which a request of this kind is over, so "still open" can be asked of the database.
export const finishedStatuses = (type: RequestType): RequestStatus[] => [REQUEST_FLOWS[type][REQUEST_FLOWS[type].length - 1]!, 'CANCELLED'];

// Where a list of open (`true`) or finished (`false`) requests is cut: a request is open until it reaches the last step of its kind or is
// cancelled, and the kinds end on different steps.
export function openWhere(open: boolean): Prisma.ServiceRequestWhereInput {
  const finished: Prisma.ServiceRequestWhereInput[] = (['ROADSIDE', 'REPLACEMENT_VEHICLE', 'MAINTENANCE', 'TRANSFER'] as const).map((type) => ({ type, status: { in: finishedStatuses(type) } }));
  return open ? { NOT: { OR: finished } } : { OR: finished };
}

// The service requests of the signed-in company (V2-41, docs/FLEET.md §3, §4.1, ADR-31). Every query takes the company first: a request of
// another company is never found, so it is a 404 like one that does not exist (ADR-25).
@Injectable()
export class FleetRequestsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(companyId: string, query: unknown): Promise<Page<RequestView>> {
    const input = parseInput(listFleetRequestSchema, query, 'Request list query is invalid');
    const where: Prisma.ServiceRequestWhereInput = {
      AND: [
        { companyId },
        ...(input.type ? [{ type: input.type }] : []),
        ...(input.status ? [{ status: input.status }] : []),
        ...(input.vehicle ? [{ fleetVehicleId: input.vehicle }] : []),
        ...(input.open === null ? [] : [openWhere(input.open)]),
      ],
    };
    const { field, direction } = input.sort;
    const [total, rows] = await Promise.all([
      this.prisma.serviceRequest.count({ where }),
      this.prisma.serviceRequest.findMany({
        where,
        include: REQUEST_LIST_INCLUDE,
        // The id as the last key: requests that share a moment still come in one order, so a page never repeats or skips one.
        orderBy: [{ [field]: direction }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return { items: rows.map(requestView), total, page: input.page, pageSize: input.pageSize };
  }

  async get(companyId: string, rawNumber: string): Promise<RequestDetail> {
    const number = normalizeRequestNumber(rawNumber);
    if (!number) throw fleetNotFound('Request');
    const row = await this.prisma.serviceRequest.findFirst({ where: { companyId, number }, include: REQUEST_DETAIL_INCLUDE });
    if (!row) throw fleetNotFound('Request');
    return requestDetail(row);
  }

  // A new request. The kind decides what `details` has to say; the car is the company's own, in use (anything else is the same
  // `UNKNOWN_REFERENCE`, so the answer says nothing about other companies' cars). A transfer is V2-42's.
  async create(companyId: string, userId: string, body: unknown, now: Date = new Date()): Promise<CreatedRequest> {
    const input = parseInput(createRequestSchema, body, 'Request validation failed');
    if (input.type === 'TRANSFER') throw validationFailed({ type: 'NOT_ALLOWED' }, 'This kind of request cannot be made yet');
    if (!input.fleetVehicleId) throw validationFailed({ fleetVehicleId: 'REQUIRED' }, 'The vehicle is required');
    const parsed = parseDetails(input.type, input.details, istanbulDay(now).date);
    if ('errors' in parsed) throw validationFailed(parsed.errors, 'Request details are invalid');
    const vehicle = await this.prisma.fleetVehicle.findFirst({ where: { id: input.fleetVehicleId, companyId, status: 'ACTIVE' }, select: { id: true } });
    if (!vehicle) throw validationFailed({ fleetVehicleId: 'UNKNOWN_REFERENCE' }, 'No vehicle of the company is in use with this id');

    return this.prisma.$transaction(async (tx) => {
      const [{ serial }] = await tx.$queryRaw<{ serial: bigint }[]>`SELECT nextval('"ServiceRequestNumber_seq"') AS serial`;
      const similar = await tx.serviceRequest.findMany({
        where: { companyId, fleetVehicleId: vehicle.id, type: input.type, status: { notIn: finishedStatuses(input.type) } },
        select: { number: true },
        orderBy: { createdAt: 'desc' },
      });
      const row = await tx.serviceRequest.create({
        data: {
          number: `TLP-${istanbulDay(now).date.slice(0, 4)}-${String(serial).padStart(5, '0')}`,
          companyId,
          createdById: userId,
          createdAt: now,
          type: input.type,
          fleetVehicleId: vehicle.id,
          details: parsed.value as unknown as Prisma.InputJsonValue,
          events: { create: { status: 'RECEIVED', actor: 'COMPANY', actorId: userId, at: now } },
        },
        include: REQUEST_DETAIL_INCLUDE,
      });
      return { ...requestDetail(row), similarOpen: similar.map((entry) => entry.number) };
    });
  }

  // Withdrawing a request: only one nobody has taken up yet (`RECEIVED`). The row is locked, so a cancel and Novera's first move take turns
  // and the second is refused (`409 INVALID_TRANSITION`).
  async cancel(companyId: string, userId: string, rawNumber: string, now: Date = new Date()): Promise<RequestDetail> {
    const number = normalizeRequestNumber(rawNumber);
    if (!number) throw fleetNotFound('Request');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "number" = ${number} AND "companyId" = ${companyId} FOR UPDATE`;
      const current = await tx.serviceRequest.findFirst({ where: { companyId, number }, select: { id: true, status: true } });
      if (!current) throw fleetNotFound('Request');
      if (!canCustomerCancel(current.status)) throw invalidTransition('Only a request nobody has taken up yet can be cancelled');
      const row = await tx.serviceRequest.update({
        where: { id: current.id },
        data: { status: 'CANCELLED', events: { create: { status: 'CANCELLED', actor: 'COMPANY', actorId: userId, at: now } } },
        include: REQUEST_DETAIL_INCLUDE,
      });
      return requestDetail(row);
    });
  }
}

export const isRequestId = isUuid;
