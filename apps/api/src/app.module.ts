import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { HoldsModule } from './holds/holds.module.js';
import { FormsModule } from './forms/forms.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ReservationsModule } from './reservations/reservations.module.js';
import { RateLimitModule } from './common/rate-limit.module.js';
import { AdminModule } from './admin/admin.module.js';
import { FleetModule } from './fleet/fleet.module.js';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    HoldsModule,
    CatalogModule,
    FormsModule,
    AuthModule,
    ReservationsModule,
    RateLimitModule,
    // After the rate limit: its guard runs first, so a request to /admin is counted before it is turned away.
    AdminModule,
    FleetModule,
  ],
})
export class AppModule {}
