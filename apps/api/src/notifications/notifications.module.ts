import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller.js';
import { MailService } from './mail.service.js';
import { NotificationsService } from './notifications.service.js';
import { RemindersService } from './reminders.service.js';
import { RemindersTask } from './reminders.task.js';

// The e-mails about bookings and requests (V2-44, ADR-32). The modules that make a booking, cancel one or move a request import it and call the
// `NotificationsService`; the reminders run from here.
@Module({
  controllers: [JobsController],
  providers: [MailService, NotificationsService, RemindersService, RemindersTask],
  exports: [NotificationsService, MailService],
})
export class NotificationsModule {}
