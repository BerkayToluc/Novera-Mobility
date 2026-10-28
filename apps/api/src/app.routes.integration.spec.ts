import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

// V2-17 (ADR-32): the whole application as it is wired in production. The content endpoints are gone, so they answer
// like any unknown address (404), while the ones that stayed still answer. Runs only on a database whose name
// contains "test"; skipped without TEST_DATABASE_URL.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL adında "test" geçen bir veritabanını göstermeli.');
}
const describeDb = databaseUrl ? describe : describe.skip;

describeDb('the routes of the whole application (gerçek PostgreSQL)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    base = await app.getUrl();
  });
  afterAll(async () => app.close());

  const get = (path: string) => fetch(base + path, { headers: { 'X-Forwarded-For': '10.7.0.1' } });

  it.each(['/products', '/products/akilli-kurumsal-filo', '/services', '/faq'])('GET %s is 404 now', async (path) => {
    const response = await get(path);
    expect(response.status).toBe(404);
  });

  it('what stayed still answers', async () => {
    expect((await get('/health')).status).toBe(200);
    expect((await get('/branches')).status).toBe(200);
  });
});
