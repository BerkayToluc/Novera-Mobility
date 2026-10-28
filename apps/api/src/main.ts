import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { listenHost, listenPort } from './config/env.js';
import { assertRuntimeEnv, docsEnabled } from './config/runtime.js';

async function bootstrap() {
  // Stops here, with a clear message, if a production setting is missing or wrong.
  assertRuntimeEnv();

  const app = await NestFactory.create(AppModule);
  configureApp(app);

  // The endpoint list is for development; in production it is off unless ENABLE_DOCS=1.
  if (docsEnabled()) {
    const config = new DocumentBuilder()
      .setTitle('Novera Mobility API')
      .setDescription('Novera araç kiralama platformu API belgesi')
      .setVersion('0.1')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  // Lets Nest close the database connection when the host stops the process (SIGTERM).
  app.enableShutdownHooks();

  const port = listenPort();
  // HOST is optional: set it to 127.0.0.1 (or a private address) so only the web server can reach the API.
  const host = listenHost();
  if (host) await app.listen(port, host);
  else await app.listen(port);
}
void bootstrap();