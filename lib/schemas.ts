import { z } from 'zod';

export const PrinterBody = z.object({
  name: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(60),
  adapter: z.enum(['simulated', 'octoprint', 'moonraker']),
  baseUrl: z.string().trim().url().max(200).nullable().optional().or(z.literal('')),
  apiKey: z.string().max(200).optional(),
  materials: z.array(z.enum(['PLA', 'PETG', 'ABS', 'ASA', 'TPU'])).min(1),
  bedMm: z.tuple([z.number().min(50).max(1000), z.number().min(50).max(1000), z.number().min(50).max(1000)]),
  throughputGPerMin: z.number().min(0.05).max(5).default(0.35),
});
