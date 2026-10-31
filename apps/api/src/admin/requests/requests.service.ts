import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { type Page } from '../admin-list.js';
import { invalidTransition } from '../admin.errors.js';
import { parseInput, validationFailed } from '../../common/zod-validation.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { openWhere } from '../../fleet/fleet-requests.service.js';
import { canMoveTo, type RequestStatus, type RequestType } from '../../fleet/requests/request-flow.js';
import { listAdminRequestSchema, setRequestStatusSchema } from '../../fleet/requests/request.schemas.js';
import { normalizeRequestNumber, requestDetail, requestView, REQUEST_DETAIL_INCLUDE, REQUEST_LIST_INCLUDE, type RequestDetail, type RequestView } from '../../fleet/requests/request.view.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const notFound = (): HttpException => new HttpException({ code: 'NOT_FOUND', message: 'Request not found' }, HttpStatus.NOT_FOUND);

// The service requests of all the companies, for the administration to carry out (V2-41, docs/ADMIN.md §3.19, ADR-31): look at them, move one
// along its steps, write down who is on it. Nothing is deleted. The rule for the steps is in fleet/requests/request-flow.ts.
@Injectable()
export class AdminRequestsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: unknown): Promise<Page<RequestView>> {
    const input = parseInput(listAdminRequestSchema, query, 'Request list query is invalid');
    const where: Prisma.ServiceRequestWhereInput = {
      AND: [
        ...(input.company ? [{ companyId: input.company }] : []),
        ...(input.type ? [{ type: input.type }] : []),
        ...(input.status ? [{ status: input.status }] : []),
        ...(input.vehicle ? [{ fleetVehicleId: input.vehicle }] : []),
        ...(input.open === null ? [] : [openWhere(input.open)]),
        // A part of the number, of the plate or of the company's name; case does not matter.
        ...(input.q
          ? [
              {
                OR: [
                  { number: { contains: input.q, mode: 'insensitive' as const } },
                  { vehicle: { is: { plate: { contains: input.q, mode: 'insensitive' as const } } } },
                  { company: { is: { name: { contains: input.q, mode: 'insensitive' as const } } } },
                ],
              },
            ]
          : []),
      ],
    };
    const { field, direction } = input.sort;
    const [total, rows] = await Promise.all([
      this.prisma.serviceRequest.count({ where }),
      this.prisma.serviceRequest.findMany({ where, include: REQUEST_LIST_INCLUDE, orderBy: [{ [field]: direction }, { id: 'asc' }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    ]);
    return { items: rows.map(requestView), total, page: input.page, pageSize: input.pageSize };
  }

  async get(rawNumber: string): Promise<RequestDetail> {
    const number = normalizeRequestNumber(rawNumber);
    if (!number) throw notFound();
    const row = await this.prisma.serviceRequest.findUnique({ where: { number }, include: REQUEST_DETAIL_INCLUDE });
    if (!row) throw notFound();
    return requestDetail(row);
  }

  // Moving a request to a later step of its kind, or cancelling it (`409 INVALID_TRANSITION` for anything else, the same step included). The
  // row is locked, so two moves take turns and the second is judged against where the first left the request. The step goes into the timeline
  // with the note; `assignee` (free text) is set, changed or, empty, cleared in the same step.
  async setStatus(rawNumber: string, adminId: string, body: unknown, now: Date = new Date()): Promise<RequestDetail> {
    const number = normalizeRequestNumber(rawNumber);
    if (!number) throw notFound();
    const input = parseInput(setRequestStatusSchema, body, 'Request status validation failed');

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "number" = ${number} FOR UPDATE`;
      const current = await tx.serviceRequest.findUnique({ where: { number }, select: { id: true, type: true, status: true, assignee: true } });
      if (!current) throw notFound();
      if (!canMoveTo(current.type as RequestType, current.status as RequestStatus, input.status)) {
        throw invalidTransition(`A ${current.type} request that is ${current.status} cannot become ${input.status}`);
      }
      // A transfer needs a driver to be met and finished, so the step that assigns one (and every step after it) needs the driver written down,
      // by this move or an earlier one (V2-42). Cancelling needs none.
      const driver = input.assignee !== undefined ? input.assignee : current.assignee;
      if (current.type === 'TRANSFER' && (input.status === 'DRIVER_ASSIGNED' || input.status === 'MET' || input.status === 'COMPLETED') && !driver) {
        throw validationFailed({ assignee: 'REQUIRED' }, 'The driver has to be written down for this step');
      }
      const row = await tx.serviceRequest.update({
        where: { id: current.id },
        data: {
          status: input.status,
          ...(input.assignee !== undefined ? { assignee: input.assignee } : {}),
          events: { create: { status: input.status, note: input.note, actor: 'NOVERA', actorId: adminId, at: now } },
        },
        include: REQUEST_DETAIL_INCLUDE,
      });
      return requestDetail(row);
    });
  }
}
