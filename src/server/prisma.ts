import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { DATABASE_URL, NODE_ENV } from '@config.env';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Use DATABASE_URL from centralized config
const databaseUrl = DATABASE_URL;

// Create a pg Pool; most managed Postgres providers (like Aiven) require SSL
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

const adapter = new PrismaPg(pool);

export const prisma =
  global.prisma ??
  new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  });

if (NODE_ENV !== 'production') {
  global.prisma = prisma;
}
