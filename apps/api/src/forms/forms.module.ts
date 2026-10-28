import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ContactService } from './contact.service.js';
import { FormsController } from './forms.controller.js';
import { QuotesService } from './quotes.service.js';
import { RetentionTask } from './retention.task.js';

@Module({
  imports: [AuthModule],
  controllers: [FormsController],
  providers: [ContactService, QuotesService, RetentionTask],
  exports: [ContactService, QuotesService],
})
export class FormsModule {}
