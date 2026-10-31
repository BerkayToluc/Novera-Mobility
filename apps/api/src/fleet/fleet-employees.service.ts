import { Inject, Injectable } from '@nestjs/common';
import type { Page } from '../admin/admin-list.js';
import { staleWrite } from '../admin/admin.errors.js';
import { isUniqueViolation } from '../common/prisma-errors.js';
import { isUuid } from '../common/uuid.js';
import { parseInput } from '../common/zod-validation.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { employeeNoTaken, fleetNotFound } from './fleet.errors.js';
import { createEmployeeSchema, listEmployeeSchema, updateEmployeeSchema } from './fleet.schemas.js';
import { employeeView, EMPLOYEE_INCLUDE, type EmployeeView } from './fleet.view.js';

// The people of the signed-in company who can have a car (V2-35, docs/FLEET.md §4.1). Nobody is deleted: a person who leaves is made
// inactive, and the assignment they had is ended. Every query takes the company and filters by it first (ADR-25).
@Injectable()
export class FleetEmployeesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(companyId: string, query: unknown): Promise<Page<EmployeeView>> {
    const input = parseInput(listEmployeeSchema, query, 'Employee list query is invalid');
    const words = (input.q ?? '').split(/\s+/).filter(Boolean).slice(0, 4);
    const where: Prisma.CompanyEmployeeWhereInput = {
      companyId,
      ...(input.active === null ? {} : { active: input.active }),
      ...(words.length
        ? {
            AND: words.map((word) => ({
              OR: [
                { firstName: { contains: word, mode: 'insensitive' as const } },
                { lastName: { contains: word, mode: 'insensitive' as const } },
                { department: { contains: word, mode: 'insensitive' as const } },
                { employeeNo: { contains: word, mode: 'insensitive' as const } },
              ],
            })),
          }
        : {}),
    };
    const { field, direction } = input.sort;
    const [total, rows] = await Promise.all([
      this.prisma.companyEmployee.count({ where }),
      this.prisma.companyEmployee.findMany({
        where,
        include: EMPLOYEE_INCLUDE,
        orderBy: [{ [field]: direction }, { firstName: 'asc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return { items: rows.map(employeeView), total, page: input.page, pageSize: input.pageSize };
  }

  // One person of the company, for the screen that edits them. Another company's person is a 404, like one that is not there.
  async get(companyId: string, id: string): Promise<EmployeeView> {
    if (!isUuid(id)) throw fleetNotFound('Employee');
    const row = await this.prisma.companyEmployee.findFirst({ where: { id, companyId }, include: EMPLOYEE_INCLUDE });
    if (!row) throw fleetNotFound('Employee');
    return employeeView(row);
  }

  async create(companyId: string, body: unknown): Promise<EmployeeView> {
    const input = parseInput(createEmployeeSchema, body, 'Employee validation failed');
    try {
      const row = await this.prisma.companyEmployee.create({ data: { companyId, ...input }, include: EMPLOYEE_INCLUDE });
      return employeeView(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw employeeNoTaken();
      throw error;
    }
  }

  // The row is locked first (with the company in the lock's condition: another company's person is not found, so not locked either),
  // so two edits take turns and the second sees the new version and is refused.
  async update(companyId: string, id: string, body: unknown, now: Date = new Date()): Promise<EmployeeView> {
    if (!isUuid(id)) throw fleetNotFound('Employee');
    const input = parseInput(updateEmployeeSchema, body, 'Employee validation failed');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "CompanyEmployee" WHERE "id" = ${id} AND "companyId" = ${companyId} FOR UPDATE`;
        const current = await tx.companyEmployee.findFirst({ where: { id, companyId }, include: EMPLOYEE_INCLUDE });
        if (!current) throw fleetNotFound('Employee');
        if (current.updatedAt.getTime() !== input.updatedAt.getTime()) throw staleWrite();

        const { updatedAt: _version, ...changes } = input;
        void _version;
        // A person who is made inactive gives the car back: the assignment they have is ended now.
        if (input.active === false && current.active) {
          await tx.vehicleAssignment.updateMany({ where: { employeeId: id, companyId, endedAt: null }, data: { endedAt: now } });
        }
        const row = await tx.companyEmployee.update({ where: { id }, data: changes, include: EMPLOYEE_INCLUDE });
        return employeeView(row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw employeeNoTaken();
      throw error;
    }
  }
}
