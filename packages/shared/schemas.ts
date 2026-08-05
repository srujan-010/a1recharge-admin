import { z } from 'zod';

export const LoginSchema = z.object({
  mobile: z.string().min(10).max(10),
  password: z.string().min(6),
});
