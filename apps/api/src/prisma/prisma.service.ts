import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { databaseUrl } from '../config/env.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = databaseUrl();
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    // A hosted database may suspend when idle (Neon does after 5 minutes) and cut the connections. Idle
    // connections are closed first, here, and a wake-up from sleep gets time to answer.
    super({
      adapter: new PrismaPg({ connectionString, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 15_000 }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
