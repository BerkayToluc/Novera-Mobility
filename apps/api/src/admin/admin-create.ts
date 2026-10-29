// `pnpm admin:create --email <address> --name "First Last"`    opens an administrator account, or gives the role to one
// `pnpm admin:create --email <address> --revoke`                takes the role away and closes the sessions
// The password is asked for in the terminal, hidden, and is never an argument, a file or an environment variable, so it
// is not in the shell history. See docs/ADMIN.md §2. Run it from apps/api, with DATABASE_URL set for that one command.
import 'dotenv/config';
import { parseArgs } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AdminAccountError, assertAdminPassword, grantAdmin, revokeAdmin } from './admin-account.js';

const USAGE = `Usage:
  pnpm admin:create --email <address> --name "First Last"
  pnpm admin:create --email <address> --revoke`;

// Reads a line without echoing it. Refuses when there is no terminal: a password that arrives through a pipe is a
// password that was in a file or a command line.
async function askHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new AdminAccountError('The password is asked for in a terminal; run this from an interactive shell.');
  }
  process.stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let value = '';
    const stdin = process.stdin;
    const finish = (): void => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      process.stdout.write('\n');
    };
    const onData = (chunk: Buffer): void => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\r' || char === '\n') {
          finish();
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          finish();
          reject(new AdminAccountError('Cancelled.'));
          return;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, name: { type: 'string' }, revoke: { type: 'boolean', default: false } },
    strict: true,
  });
  if (!values.email) throw new AdminAccountError(`--email is required.\n${USAGE}`);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new AdminAccountError('DATABASE_URL is not set.');
  // Says where it is about to write without printing the address (it holds the password).
  const host = new URL(connectionString).hostname;
  const where = host === 'localhost' || host === '127.0.0.1' ? 'a LOCAL database' : 'a REMOTE database';
  console.log(`Using ${where}.`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const db = prisma as unknown as PrismaService;
  try {
    if (values.revoke) {
      await revokeAdmin(db, values.email);
      console.log('Done. The role is taken away and every open session of the account is closed.');
      return;
    }
    const password = await askHidden('Password (hidden, at least 12 characters): ');
    assertAdminPassword(password);
    if ((await askHidden('Again: ')) !== password) throw new AdminAccountError('The two passwords are not the same.');
    const { created } = await grantAdmin(db, { email: values.email, name: values.name, password });
    console.log(created ? 'Done. The administrator account is open.' : 'Done. The account is an administrator now; its password is the one you typed and its open sessions are closed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Only messages that cannot hold a secret are printed: our own, and the argument parser's (it names a flag). Of
  // anything else, such as a database error that could carry the connection string, only the kind is shown.
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  if (error instanceof AdminAccountError) console.error(error.message);
  else if (typeof code === 'string' && code.startsWith('ERR_PARSE_ARGS')) console.error(`${(error as Error).message}\n${USAGE}`);
  else console.error(`It failed (${error instanceof Error ? error.name : 'unknown error'}${typeof code === 'string' ? `, ${code}` : ''}); the message is left out on purpose.`);
  process.exit(1);
});
