import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const ConfigSchema = z.object({
  YEOROT_API_URL: z.string().url('YEOROT_API_URL must be a valid URL'),
  YEOROT_API_KEY: z
    .string()
    .min(1, 'YEOROT_API_KEY is required')
    .refine((v) => v.startsWith('yrk_'), { message: 'YEOROT_API_KEY must start with yrk_' }),
  TZ: z.string().optional().default('Asia/Seoul'),
  YEOROT_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(10000),
});

const parsed = ConfigSchema.safeParse(process.env);

if (!parsed.success) {
  const messages = parsed.error.errors.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n');
  process.stderr.write(`[yeorot-mcp] 환경변수 검증 실패:\n${messages}\n`);
  process.exit(1);
}

export const config = parsed.data;
