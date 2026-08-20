import { z } from 'zod';

export const googleCallbackQuerySchema = z.object({
  query: z.object({
    code: z.string().min(1, 'Authorization code is required'),
    state: z.string().optional(),
  }),
});

export type GoogleCallbackQuery = z.infer<typeof googleCallbackQuerySchema>['query'];
