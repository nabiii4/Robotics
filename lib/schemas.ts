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

export const ItemBody = z.object({
  name: z.string().trim().min(1).max(120), sku: z.string().trim().max(40).nullable().optional(), category: z.enum(['screws_hardware', 'vex_structural', 'motors_electronics', 'printed_parts']), subcategory: z.string().trim().max(60).default(''),
  unit: z.string().trim().max(12).default('pcs'), qtyOnHand: z.number().int().min(0).max(100000).default(0), minQty: z.number().int().min(0).max(100000).default(0),
  location: z.string().trim().max(60).nullable().optional(), supplier: z.string().trim().max(60).nullable().optional(), url: z.string().trim().url().max(300).nullable().optional().or(z.literal('')), notes: z.string().max(500).nullable().optional(),
});
