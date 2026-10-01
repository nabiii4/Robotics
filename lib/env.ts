import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.string().default('development'),
  APP_URL: z.string().default(''),
  APP_ENCRYPTION_KEY: z.string().default(''),
  DATABASE_URL: z.string().default('file:./data/fdrhs.db'),
  DATABASE_AUTH_TOKEN: z.string().default(''),
  UPLOAD_DIR: z.string().default('./data/uploads'),
  AZURE_OPENAI_ENDPOINT: z.string().default(''),
  AZURE_OPENAI_API_KEY: z.string().default(''),
  AZURE_OPENAI_DEPLOYMENT: z.string().default(''),
  AZURE_OPENAI_FALLBACK_DEPLOYMENT: z.string().default(''),
  AZURE_OPENAI_API_VERSION: z.string().default('2025-01-01-preview'),
  AZURE_OPENAI_BACKUP_ENDPOINT: z.string().default(''),
  AZURE_OPENAI_BACKUP_API_KEY: z.string().default(''),
  AZURE_OPENAI_BACKUP_DEPLOYMENT: z.string().default(''),
  AZURE_OPENAI_EMBEDDING_MODEL: z.string().default(''),
  AZURE_OPENAI_EMBEDDING_API_VERSION: z.string().default('2024-10-21'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-5-nano'),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  OPENAI_EMBEDDING_MODEL: z.string().default(''),
  AI_MAX_REQUESTS_PER_HOUR: z.coerce.number().default(40),
  AI_MAX_REQUESTS_PER_DAY: z.coerce.number().default(200),
  AI_GLOBAL_DAILY_CAP: z.coerce.number().default(3000),
  AI_MOCK: z.string().default('auto'),
  GXX_PATH: z.string().default('g++'),
  TEAM_JOIN_CODE: z.string().default(''),
  ADMIN_USERNAME: z.string().default('coach'),
  ADMIN_INITIAL_PASSWORD: z.string().default(''),
  SEED_SCENARIO: z.string().default('B'),
});

export type EnvT = z.infer<typeof Env>;
let cached: EnvT | null = null;
/** Server-only environment (never import from client components). */
export function env(): EnvT {
  if (!cached) {
    cached = Env.parse(process.env);
    // Turso's Vercel integration names its variables TURSO_*
    if (!process.env.DATABASE_URL?.trim()) cached.DATABASE_URL = process.env.TURSO_DATABASE_URL?.trim() || 'file:./data/fdrhs.db';
    cached.DATABASE_URL = cached.DATABASE_URL.trim();
    if (!cached.DATABASE_AUTH_TOKEN && process.env.TURSO_AUTH_TOKEN) cached.DATABASE_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
    // hosting platforms publish the public URL themselves; fall back to it when APP_URL isn't set
    if (!cached.APP_URL) {
      const railway = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '';
      const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '';
      cached.APP_URL = process.env.RENDER_EXTERNAL_URL || railway || vercel || 'http://localhost:3000';
    }
  }
  return cached;
}
