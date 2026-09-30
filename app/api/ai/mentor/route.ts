import { z } from 'zod';
import { route } from '@/lib/api';
import { runMentor } from '@/lib/ai/mentor';
import { canEditBuild } from '@/lib/services/builds';

export const runtime = 'nodejs';
export const maxDuration = 120;
const Body = z.object({
  threadId: z.string().nullish(), buildId: z.string().nullish(), message: z.string().max(4000).default(''),
  mode: z.enum(['chat', 'create']).default('chat'), chipId: z.string().max(40).optional(),
  codeContext: z.object({ fileId: z.string() }).nullish(), retryMessageId: z.string().optional(),
});
export const POST = route({ body: Body }, async ({ user, body, req }) => {
  const buildId = body.buildId && (await canEditBuild(body.buildId, user)) ? body.buildId : null;
  if (!body.message.trim() && !body.chipId) return { error: { code: 'bad_request', message: 'Type a message first.' } };
  return runMentor({ user, message: body.message, threadId: body.threadId, buildId, mode: body.mode, chipId: body.chipId, codeContext: body.codeContext, retryMessageId: body.retryMessageId, signal: req.signal });
});
