import { z } from 'zod';
import { consent, email, integer, optionalText, phone, requiredText } from '../common/zod-fields.js';

// POST /contact and POST /quotes (ADR-20, openapi.yaml). The `website` trap field is read before these
// run (isSpam), so it is not part of the schemas; like any unknown field it is dropped.
export const contactSchema = z.object({
  name: requiredText(120),
  email: email(),
  phone: phone(),
  subject: requiredText(160),
  message: requiredText(4000),
  consent: consent(),
});

export const quoteSchema = z.object({
  companyName: requiredText(160),
  contactName: optionalText(120),
  phone: phone(),
  email: email(),
  vehicleCount: integer(1, 10000),
  durationMonths: integer(1, 120),
  vehicleType: requiredText(200),
  deliveryCities: optionalText(240),
  notes: optionalText(2000),
  productSlug: optionalText(80),
  consent: consent(),
});

export type ContactInput = z.output<typeof contactSchema>;
export type QuoteInput = z.output<typeof quoteSchema>;
