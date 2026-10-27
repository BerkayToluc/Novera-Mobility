import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ContactService } from './contact.service.js';
import { FormsController } from './forms.controller.js';
import { QuotesService } from './quotes.service.js';

@Module({
  imports: [AuthModule],
  controllers: [FormsController],
  providers: [ContactService, QuotesService],
  exports: [ContactService, QuotesService],
})
export class FormsModule {}