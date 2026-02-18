import { z } from 'zod';
import { insertDailyWordSchema, dailyWords } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  dailyWords: {
    list: {
      method: 'GET' as const,
      path: '/api/daily-words' as const,
      responses: {
        200: z.array(z.custom<typeof dailyWords.$inferSelect>()),
      },
    },
    getLatest: {
      method: 'GET' as const,
      path: '/api/daily-words/latest' as const,
      responses: {
        200: z.custom<typeof dailyWords.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/daily-words' as const,
      input: insertDailyWordSchema,
      responses: {
        201: z.custom<typeof dailyWords.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/daily-words/:id' as const,
      input: insertDailyWordSchema.partial(),
      responses: {
        200: z.custom<typeof dailyWords.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/daily-words/:id' as const,
      responses: {
        204: z.void(),
      },
    },
    getToday: {
      method: 'GET' as const,
      path: '/api/daily-words/today' as const,
      responses: {
        200: z.custom<typeof dailyWords.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
