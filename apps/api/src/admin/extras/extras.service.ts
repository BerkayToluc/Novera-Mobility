import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { parseInput } from '../../common/zod-validation.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { staleWrite } from '../admin.errors.js';
import { SLUG } from '../vehicle-models/vehicle-models.schemas.js';
import { updateExtraSchema } from './extras.schemas.js';
import { extraAdminView, type ExtraView } from './extras.view.js';

const notFound = (): HttpException =>
  new HttpException({ code: 'NOT_FOUND', message: 'Extra service not found' }, HttpStatus.NOT_FOUND);

// The extra services of the administration (V2-30, ADMIN.md §3.1): their names and prices can be changed. The price of a booking
// that was made is stored on it (`ReservationExtra.unitPrice`), so a change only reaches the quotes and bookings after it.
@Injectable()
export class ExtrasService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // A handful of rows, so no paging: the cheapest first, the way the site lists them.
  async list(): Promise<ExtraView[]> {
    const rows = await this.prisma.extra.findMany({ orderBy: [{ price: 'asc' }, { slug: 'asc' }] });
    return rows.map(extraAdminView);
  }

  async get(rawSlug: string): Promise<ExtraView> {
    const slug = this.slugOf(rawSlug);
    const row = await this.prisma.extra.findUnique({ where: { slug } });
    if (!row) throw notFound();
    return extraAdminView(row);
  }

  // The row is locked first: two edits take turns, and the second sees the new version and is refused.
  async update(rawSlug: string, body: unknown): Promise<ExtraView> {
    const slug = this.slugOf(rawSlug);
    const input = parseInput(updateExtraSchema, body, 'Extra service validation failed');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Extra" WHERE "slug" = ${slug} FOR UPDATE`;
      const current = await tx.extra.findUnique({ where: { slug } });
      if (!current) throw notFound();
      if (current.updatedAt.getTime() !== input.updatedAt.getTime()) throw staleWrite();
      const row = await tx.extra.update({
        where: { slug },
        data: { nameTr: input.name?.tr, nameEn: input.name?.en, price: input.price },
      });
      return extraAdminView(row);
    });
  }

  // An address in the path, as it is stored: lower case. Something that cannot be an address is an extra that does not exist.
  private slugOf(raw: string): string {
    const slug = raw.toLowerCase();
    if (!SLUG.test(slug)) throw notFound();
    return slug;
  }
}
