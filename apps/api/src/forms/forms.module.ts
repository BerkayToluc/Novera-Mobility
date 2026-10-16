import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ContactService } from './contact.service.js';
import { FormsController } from './forms.controller.js';
import { QuotesService } from './quotes.service.js';
import { RateLimiter } from './rate-limiter.js';

@Module({
  imports: [AuthModule],
  controllers: [FormsController],
  providers: [ContactService, QuotesService, RateLimiter],
  exports: [ContactService, QuotesService],
})
export class FormsModule {}