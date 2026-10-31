import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { emailTaken } from '../../auth/auth.errors.js';
import { INVITE_TOKEN_TTL_MS } from '../../auth/password-reset.service.js';
import { ResetLinkNotifier } from '../../auth/reset-link-notifier.js';
import { hashSessionToken, newSessionToken } from '../../auth/session-token.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { isUuid } from '../../common/uuid.js';
import { parseInput } from '../../common/zod-validation.js';
import { webBaseUrl } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Page } from '../admin-list.js';
import { invalidTransition, staleWrite } from '../admin.errors.js';
import { createCompanySchema, inviteUserSchema, listCompanySchema, updateCompanySchema } from './companies.schemas.js';
import { companyDetail, companyListItem, companyUser, isPending, type CompanyDetail, type CompanyListItem, type CompanyUser } from './companies.view.js';

const notFound = (): HttpException =>
  new HttpException({ code: 'NOT_FOUND', message: 'Company not found' }, HttpStatus.NOT_FOUND);

// Another company already has this name (the case and the spaces around it do not count). A 409 with the field named.
const nameTaken = (): HttpException =>
  new HttpException(
    { code: 'NAME_TAKEN', message: 'A company with this name already exists', fieldErrors: { name: 'NAME_TAKEN' } },
    HttpStatus.CONFLICT,
  );

const personNotFound = (): HttpException =>
  new HttpException({ code: 'NOT_FOUND', message: 'Person not found in this company' }, HttpStatus.NOT_FOUND);

type Pending = { id: string; email: string; locale: 'TR' | 'EN'; firstName: string };

// The companies of the administration (V2-33, ADMIN.md §3.3) and the invitation of people to them. A corporate account is opened
// only here: the company is made, then a person is invited, who sets their own password from the link in the e-mail.
@Injectable()
export class CompaniesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ResetLinkNotifier) private readonly notifier: ResetLinkNotifier,
  ) {}

  async list(query: unknown): Promise<Page<CompanyListItem>> {
    const input = parseInput(listCompanySchema, query, 'Company list query is invalid');
    const where: Prisma.CompanyWhereInput = input.q
      ? {
          OR: [
            { name: { contains: input.q, mode: 'insensitive' } },
            { taxOffice: { contains: input.q, mode: 'insensitive' } },
            { city: { contains: input.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const { field, direction } = input.sort;
    const orderBy: Prisma.CompanyOrderByWithRelationInput[] = [
      field === 'users' ? { users: { _count: direction } } : { [field]: direction },
      { id: 'asc' },
    ];
    const [total, rows] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        orderBy,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: { _count: { select: { users: true } } },
      }),
    ]);
    // Who is still waiting, for the whole page in one query.
    const waiting = await this.prisma.user.groupBy({
      by: ['companyId'],
      where: { companyId: { in: rows.map((row) => row.id) }, passwordHash: null, googleSub: null },
      _count: { _all: true },
    });
    const pendingBy = new Map(waiting.map((group) => [group.companyId, group._count._all]));
    return {
      items: rows.map((row) => companyListItem(row, row._count.users, pendingBy.get(row.id) ?? 0)),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async get(id: string, now: Date = new Date()): Promise<CompanyDetail> {
    if (!isUuid(id)) throw notFound();
    const row = await this.prisma.company.findUnique({ where: { id } });
    if (!row) throw notFound();
    return companyDetail(row, await this.usersOf(this.prisma, id, now));
  }

  async create(body: unknown, now: Date = new Date()): Promise<CompanyDetail> {
    const input = parseInput(createCompanySchema, body, 'Company validation failed');
    await this.requireFreeName(this.prisma, input.name);
    try {
      const row = await this.prisma.company.create({
        data: {
          name: input.name,
          taxOffice: input.taxOffice,
          city: input.city,
          phone: input.phone,
          salesContact: input.salesContact ?? undefined,
        },
      });
      return companyDetail(row, await this.usersOf(this.prisma, row.id, now));
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
  }

  // The row is locked first: two edits take turns, and the second sees the new version and is refused.
  async update(id: string, body: unknown, now: Date = new Date()): Promise<CompanyDetail> {
    if (!isUuid(id)) throw notFound();
    const input = parseInput(updateCompanySchema, body, 'Company validation failed');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${id} FOR UPDATE`;
        const current = await tx.company.findUnique({ where: { id } });
        if (!current) throw notFound();
        if (current.updatedAt.getTime() !== input.updatedAt.getTime()) throw staleWrite();
        if (input.name !== undefined && input.name.toLowerCase() !== current.name.toLowerCase()) await this.requireFreeName(tx, input.name);

        const row = await tx.company.update({
          where: { id },
          data: {
            name: input.name,
            taxOffice: input.taxOffice,
            city: input.city,
            phone: input.phone,
            // A sales contact that is sent empty is taken away (the column is emptied, not set to a JSON null).
            salesContact: input.salesContact === undefined ? undefined : (input.salesContact ?? Prisma.DbNull),
          },
        });
        return companyDetail(row, await this.usersOf(tx, id, now));
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
  }

  // Inviting a person: an account with no password, tied to the company, and a link that lets them set one. The account and the
  // link are made together, so there is never a person without a way in (or a link without a person). An e-mail address that
  // already has an account is `409 EMAIL_TAKEN`: a person is in one company, and an existing account is never taken over.
  async invite(companyId: string, body: unknown, now: Date = new Date()): Promise<CompanyUser> {
    if (!isUuid(companyId)) throw notFound();
    const input = parseInput(inviteUserSchema, body, 'Invitation validation failed');
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });
    if (!company) throw notFound();
    if (await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) throw emailTaken();

    const token = newSessionToken();
    const expiresAt = new Date(now.getTime() + INVITE_TOKEN_TTL_MS);
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash: null,
          firstName: input.firstName,
          lastName: input.lastName,
          accountType: 'CORPORATE',
          contactTitle: input.title,
          companyId: company.id,
          locale: input.locale,
          passwordResetTokens: { create: { tokenHash: hashSessionToken(token), kind: 'INVITE', expiresAt } },
        },
      });
    } catch (error) {
      // Two invitations of the same address at once: the database lets one through.
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }

    this.send({ id: user.id, email: user.email, locale: user.locale, firstName: user.firstName }, company.name, token);
    return companyUser(user, expiresAt, now);
  }

  // A new link for a person who has not used the invitation: the old link stops working at once, whether it had run out or not.
  // A person who already has a password is not invited again (`409 INVALID_TRANSITION`): a reset is their own to ask for.
  async resend(companyId: string, userId: string, now: Date = new Date()): Promise<CompanyUser> {
    if (!isUuid(companyId) || !isUuid(userId)) throw personNotFound();
    const token = newSessionToken();
    const expiresAt = new Date(now.getTime() + INVITE_TOKEN_TTL_MS);

    const { user, companyName } = await this.prisma.$transaction(async (tx) => {
      // The person is locked, so two presses of the button take turns and the last link is the only live one.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const found = await tx.user.findFirst({ where: { id: userId, companyId }, include: { company: { select: { name: true } } } });
      if (!found || !found.company) throw personNotFound();
      if (!isPending(found)) throw invalidTransition('The person has already set a password; a reset link is theirs to ask for');
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.passwordResetToken.create({ data: { tokenHash: hashSessionToken(token), kind: 'INVITE', expiresAt, userId } });
      return { user: found, companyName: found.company.name };
    });

    this.send({ id: user.id, email: user.email, locale: user.locale, firstName: user.firstName }, companyName, token);
    return companyUser(user, expiresAt, now);
  }

  // The e-mail goes after the account and the link are stored. It is not awaited: sending can take seconds, and the notifier never
  // throws (a failed delivery is logged), so the administrator can send the invitation again from the screen.
  private send(person: Pending, company: string, token: string): void {
    const link = `${webBaseUrl()}/${person.locale.toLowerCase()}/sifre-sifirla/yeni?token=${encodeURIComponent(token)}&tur=davet`;
    void this.notifier.send(person.email, link, person.locale, { company, name: person.firstName }).catch(() => undefined);
  }

  private async requireFreeName(db: Pick<PrismaService, 'company'>, name: string): Promise<void> {
    const same = await db.company.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
    if (same) throw nameTaken();
  }

  // The people of a company, newest invitation first, each with the state of their invitation.
  private async usersOf(db: Pick<PrismaService, 'user' | 'passwordResetToken'>, companyId: string, now: Date): Promise<CompanyUser[]> {
    const users = await db.user.findMany({ where: { companyId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
    const waiting = users.filter(isPending).map((user) => user.id);
    const links = waiting.length
      ? await db.passwordResetToken.findMany({ where: { userId: { in: waiting }, kind: 'INVITE', usedAt: null }, orderBy: { createdAt: 'desc' } })
      : [];
    // The newest link of each person is the one that counts.
    const lastBy = new Map<string, Date>();
    for (const link of links) if (!lastBy.has(link.userId)) lastBy.set(link.userId, link.expiresAt);
    return users.map((user) => companyUser(user, lastBy.get(user.id) ?? null, now));
  }
}
