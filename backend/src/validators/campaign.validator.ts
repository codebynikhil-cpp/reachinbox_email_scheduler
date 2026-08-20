import { z } from 'zod';

export const createCampaignSchema = z.object({
  body: z.object({
    subject: z.string().trim().min(1, 'Subject is required'),
    body: z.string().trim().min(1, 'Body is required'),
    recipients: z
      .array(z.string().trim().email('Invalid email address'))
      .min(1, 'At least one recipient is required')
      .transform((emails) => {
        // Remove duplicate emails (case-insensitive)
        const unique = new Map<string, string>();
        for (const email of emails) {
          const lower = email.toLowerCase();
          if (!unique.has(lower)) {
            unique.set(lower, email);
          }
        }
        return Array.from(unique.values());
      }),
    startTime: z
      .string()
      .datetime({ message: 'startTime must be a valid ISO-8601 string' })
      .or(z.date()),
    delayMs: z.coerce
      .number()
      .int()
      .positive('delayMs must be a positive integer')
      .default(2000),
    hourlyLimit: z.coerce
      .number()
      .int()
      .positive('hourlyLimit must be a positive integer')
      .default(100),
  }),
});

export const paginationQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    campaignId: z.string().uuid().optional(),
  }),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>['body'];
export type PaginationQuery = z.infer<typeof paginationQuerySchema>['query'];
