import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { HOLD_MINUTES, MAX_ACTIVE_HOLDS_PER_CLIENT } from './holds.service.js';
import { daysAhead, slotAtLeast, slotBefore } from '../reservations/dates.testing.js';
import { holdsFixture, DAY, END, MINUTE, START, bodyOf, catchHttp, describeDb } from './holds.service.testing.js';

describeDb('POST /holds araç tutma (gerçek PostgreSQL)', () => {
  const fx = holdsFixture();
  const { scenario, holdInput, book } = fx;

  describe('başarılı tutma', () => {
    it('araç 15 dakika tutulur ve yanıt sözleşmeye uyar', async () => {
      const s = await scenario();
      const result = await fx.holds.create(holdInput(s), `client-${randomUUID()}`);
      expect(Object.keys(result).sort()).toEqual(['expiresAt', 'id', 'vehicleId']);
      expect(result.vehicleId).toBe(s.vehicleId);
      const remaining = new Date(result.expiresAt).getTime() - Date.now();
      expect(remaining).toBeGreaterThan((HOLD_MINUTES - 1) * MINUTE);
      expect(remaining).toBeLessThanOrEqual(HOLD_MINUTES * MINUTE);
    });

    it('tutulan araç müsaitlik aramasında görünmez', async () => {
      const s = await scenario();
      const query = {
        pickupBranchId: s.branchId,
        returnBranchId: s.branchId,
        startAt: START.toISOString(),
        endAt: END.toISOString(),
      };
      expect(await fx.catalog.getAvailableVehicles(query)).toHaveLength(1);
      await fx.holds.create(holdInput(s), `client-${randomUUID()}`);
      expect(await fx.catalog.getAvailableVehicles(query)).toHaveLength(0);
    });

    it('aynı istemci aynı aracı aynı aralıkta yeniden isterse aynı tutma döner', async () => {
      const s = await scenario();
      const client = `client-${randomUUID()}`;
      const first = await fx.holds.create(holdInput(s), client);
      const second = await fx.holds.create(holdInput(s), client);
      expect(second.id).toBe(first.id);
      expect(second.expiresAt).toBe(first.expiresAt);
      expect(await fx.prisma.hold.count({ where: { vehicleId: s.vehicleId } })).toBe(1);
    });

    it('süresi dolan tutma aracı başkasına açar', async () => {
      const s = await scenario();
      const first = await fx.holds.create(holdInput(s), `client-${randomUUID()}`);
      await fx.prisma.hold.update({
        where: { id: first.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const second = await fx.holds.create(holdInput(s), `client-${randomUUID()}`);
      expect(second.id).not.toBe(first.id);
    });

    it('bitişik aralık (biri diğerinin bittiği anda başlar) çakışma sayılmaz', async () => {
      const s = await scenario();
      await fx.holds.create(holdInput(s, START, END), `client-${randomUUID()}`);
      const next = await fx.holds.create(holdInput(s, END, new Date(END.getTime() + DAY)), `client-${randomUUID()}`);
      expect(next.vehicleId).toBe(s.vehicleId);
    });
  });

  describe('tutmayı bırakma (DELETE /holds/{id})', () => {
    const queryOf = (s: { branchId: string }) => ({
      pickupBranchId: s.branchId,
      returnBranchId: s.branchId,
      startAt: START.toISOString(),
      endAt: END.toISOString(),
    });

    it('tutmayı açan istemci bırakır: araç hemen yeniden müsait olur', async () => {
      const s = await scenario();
      const client = `client-${randomUUID()}`;
      const hold = await fx.holds.create(holdInput(s), client);
      expect(await fx.catalog.getAvailableVehicles(queryOf(s))).toHaveLength(0);

      await fx.holds.release(hold.id, client);

      expect(await fx.prisma.hold.count({ where: { id: hold.id } })).toBe(0);
      expect(await fx.catalog.getAvailableVehicles(queryOf(s))).toHaveLength(1);
    });

    it('bırakılan aracı başka bir istemci hemen tutabilir', async () => {
      const s = await scenario();
      const client = `client-${randomUUID()}`;
      const hold = await fx.holds.create(holdInput(s), client);
      await fx.holds.release(hold.id, client);
      const next = await fx.holds.create(holdInput(s), `client-${randomUUID()}`);
      expect(next.vehicleId).toBe(s.vehicleId);
    });

    it('başkasının tutmasını bırakamaz: sessizce hiçbir şey olmaz, tutma yerinde kalır', async () => {
      const s = await scenario();
      const hold = await fx.holds.create(holdInput(s), `client-${randomUUID()}`);
      await expect(fx.holds.release(hold.id, `client-${randomUUID()}`)).resolves.toBeUndefined();
      expect(await fx.prisma.hold.count({ where: { id: hold.id } })).toBe(1);
    });

    it('olmayan, geçersiz biçimli ya da zaten bırakılmış tutmada da hata vermez', async () => {
      const s = await scenario();
      const client = `client-${randomUUID()}`;
      const hold = await fx.holds.create(holdInput(s), client);
      await fx.holds.release(hold.id, client);
      await expect(fx.holds.release(hold.id, client)).resolves.toBeUndefined();
      await expect(fx.holds.release(randomUUID(), client)).resolves.toBeUndefined();
      await expect(fx.holds.release('bu-bir-uuid-degil', client)).resolves.toBeUndefined();
    });

    it('bırakmak istemcinin diğer tutmalarına dokunmaz', async () => {
      const a = await scenario();
      const b = await scenario();
      const client = `client-${randomUUID()}`;
      const first = await fx.holds.create(holdInput(a), client);
      const second = await fx.holds.create(holdInput(b), client);
      await fx.holds.release(first.id, client);
      expect(await fx.prisma.hold.count({ where: { id: second.id } })).toBe(1);
    });
  });

  describe('çakışma (409 VEHICLE_UNAVAILABLE)', () => {
    it('başka istemci aynı aracı aynı aralıkta tutamaz', async () => {
      const s = await scenario();
      await fx.holds.create(holdInput(s), `client-${randomUUID()}`);
      const error = await catchHttp(fx.holds.create(holdInput(s), `client-${randomUUID()}`));
      expect(error.getStatus()).toBe(409);
      expect(bodyOf(error).code).toBe('VEHICLE_UNAVAILABLE');
    });

    it('kısmen çakışan aralık da reddedilir', async () => {
      const s = await scenario();
      await fx.holds.create(holdInput(s), `client-${randomUUID()}`);
      const error = await catchHttp(
        fx.holds.create(
          holdInput(s, new Date(START.getTime() + DAY), new Date(END.getTime() + DAY)),
          `client-${randomUUID()}`,
        ),
      );
      expect(error.getStatus()).toBe(409);
    });

    it('onaylı rezervasyonla çakışan araç tutulamaz', async () => {
      const s = await scenario();
      await book(s, new Date(START.getTime() + DAY), new Date(START.getTime() + 2 * DAY));
      const error = await catchHttp(fx.holds.create(holdInput(s), `client-${randomUUID()}`));
      expect(error.getStatus()).toBe(409);
      expect(bodyOf(error).code).toBe('VEHICLE_UNAVAILABLE');
    });

    it('rezervasyon tam başlangıç anında bitiyorsa tutulabilir', async () => {
      const s = await scenario();
      await book(s, new Date(START.getTime() - 2 * DAY), START);
      const result = await fx.holds.create(holdInput(s), `client-${randomUUID()}`);
      expect(result.vehicleId).toBe(s.vehicleId);
    });

    it('iptal edilmiş rezervasyon engel olmaz', async () => {
      const s = await scenario();
      await book(s, START, END, 'CANCELLED');
      const result = await fx.holds.create(holdInput(s), `client-${randomUUID()}`);
      expect(result.vehicleId).toBe(s.vehicleId);
    });
  });

  describe('eşzamanlılık', () => {
    it('8 istek aynı anda gelirse yalnızca biri aracı tutar', async () => {
      const s = await scenario();
      const clients = Array.from({ length: 8 }, () => `client-${randomUUID()}`);
      const results = await Promise.allSettled(clients.map((client) => fx.holds.create(holdInput(s), client)));

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(7);
      for (const r of rejected) {
        expect(r.reason).toBeInstanceOf(HttpException);
        expect((r.reason as HttpException).getStatus()).toBe(409);
      }
      expect(await fx.prisma.hold.count({ where: { vehicleId: s.vehicleId } })).toBe(1);
    });
  });

  describe('hız sınırı (429 RATE_LIMITED)', () => {
    it('aynı istemci en fazla 5 aracı aynı anda tutabilir', async () => {
      const client = `client-${randomUUID()}`;
      for (let i = 0; i < MAX_ACTIVE_HOLDS_PER_CLIENT; i += 1) {
        const s = await scenario();
        await fx.holds.create(holdInput(s), client);
      }
      const extra = await scenario();
      const error = await catchHttp(fx.holds.create(holdInput(extra), client));
      expect(error.getStatus()).toBe(429);
      expect(bodyOf(error).code).toBe('RATE_LIMITED');

      // Başka bir istemci etkilenmez.
      const other = await fx.holds.create(holdInput(extra), `client-${randomUUID()}`);
      expect(other.vehicleId).toBe(extra.vehicleId);
    });

    it('süresi dolan tutmalar sınıra sayılmaz', async () => {
      const client = `client-${randomUUID()}`;
      const first = await scenario();
      const created1 = await fx.holds.create(holdInput(first), client);
      await fx.prisma.hold.update({
        where: { id: created1.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const active = await fx.prisma.hold.count({
        where: { clientKey: client, expiresAt: { gt: new Date() } },
      });
      expect(active).toBe(0);
    });
  });

  describe('girdi doğrulaması (422 VALIDATION_FAILED)', () => {
    it('eksik alanlar REQUIRED döner', async () => {
      const error = await catchHttp(fx.holds.create({}, 'client-x'));
      expect(error.getStatus()).toBe(422);
      const fields = bodyOf(error).fieldErrors ?? {};
      for (const name of ['vehicleId', 'pickupBranchId', 'returnBranchId', 'startAt', 'endAt']) {
        expect(fields[name]).toBe('REQUIRED');
      }
    });

    it('30 dakikalık dilime oturmayan an reddedilir (NOT_IN_SLOT)', async () => {
      const s = await scenario();
      const error = await catchHttp(
        fx.holds.create(
          { ...holdInput(s), startAt: new Date(START.getTime() + 15 * MINUTE).toISOString() },
          'client-x',
        ),
      );
      expect(bodyOf(error).fieldErrors?.startAt).toBe('NOT_IN_SLOT');
    });

    it('geçmiş ya da en yakın dilimden önceki başlangıç reddedilir (IN_PAST)', async () => {
      const s = await scenario();
      for (const start of [daysAhead(-1), slotBefore(30)]) {
        const error = await catchHttp(
          fx.holds.create(holdInput(s, start, new Date(start.getTime() + DAY)), 'client-x'),
        );
        expect(error.getStatus()).toBe(422);
        expect(bodyOf(error).fieldErrors?.startAt).toBe('IN_PAST');
      }
      const earliest = slotAtLeast(30);
      await expect(
        fx.holds.create(holdInput(s, earliest, new Date(earliest.getTime() + DAY)), 'client-x'),
      ).resolves.toBeDefined();
    });

    it('bir yıldan uzak başlangıç reddedilir (OUT_OF_RANGE)', async () => {
      const s = await scenario();
      const start = daysAhead(366);
      const error = await catchHttp(fx.holds.create(holdInput(s, start, new Date(start.getTime() + DAY)), 'client-x'));
      expect(bodyOf(error).fieldErrors?.startAt).toBe('OUT_OF_RANGE');
    });

    it('bitiş başlangıçtan önceyse reddedilir (INVALID_DATE_RANGE)', async () => {
      const s = await scenario();
      const error = await catchHttp(fx.holds.create(holdInput(s, END, START), 'client-x'));
      expect(bodyOf(error).fieldErrors?.endAt).toBe('INVALID_DATE_RANGE');
    });

    it('geçersiz kimlik biçimi reddedilir (INVALID_FORMAT)', async () => {
      const s = await scenario();
      const error = await catchHttp(fx.holds.create({ ...holdInput(s), vehicleId: 'bu-bir-uuid-degil' }, 'client-x'));
      expect(bodyOf(error).fieldErrors?.vehicleId).toBe('INVALID_FORMAT');
    });

    it('araç alış bayisinde değilse reddedilir (UNKNOWN_REFERENCE)', async () => {
      const a = await scenario();
      const b = await scenario();
      const error = await catchHttp(fx.holds.create({ ...holdInput(a), vehicleId: b.vehicleId }, 'client-x'));
      expect(error.getStatus()).toBe(422);
      expect(bodyOf(error).fieldErrors?.vehicleId).toBe('UNKNOWN_REFERENCE');
    });

    it('var olmayan araç reddedilir (UNKNOWN_REFERENCE)', async () => {
      const s = await scenario();
      const error = await catchHttp(fx.holds.create({ ...holdInput(s), vehicleId: randomUUID() }, 'client-x'));
      expect(bodyOf(error).fieldErrors?.vehicleId).toBe('UNKNOWN_REFERENCE');
    });

    it('var olmayan iade bayisi reddedilir (UNKNOWN_REFERENCE)', async () => {
      const s = await scenario();
      const error = await catchHttp(fx.holds.create({ ...holdInput(s), returnBranchId: randomUUID() }, 'client-x'));
      expect(bodyOf(error).fieldErrors?.returnBranchId).toBe('UNKNOWN_REFERENCE');
    });

    it('pasif araç tutulamaz', async () => {
      const s = await scenario();
      await fx.prisma.vehicle.update({ where: { id: s.vehicleId }, data: { active: false } });
      const error = await catchHttp(fx.holds.create(holdInput(s), 'client-x'));
      expect(bodyOf(error).fieldErrors?.vehicleId).toBe('UNKNOWN_REFERENCE');
    });
  });
});
