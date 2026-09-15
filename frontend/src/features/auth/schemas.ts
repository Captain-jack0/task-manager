import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
});

export type CredentialsForm = z.infer<typeof credentialsSchema>;

export const registerSchema = credentialsSchema.extend({
  full_name: z.string().trim().min(1, 'Your name is required').max(120, 'Name too long'),
});
export type RegisterForm = z.infer<typeof registerSchema>;

export const emailSchema = credentialsSchema.pick({ email: true });
export type EmailForm = z.infer<typeof emailSchema>;

export const newPasswordSchema = credentialsSchema.pick({ password: true });
export type NewPasswordForm = z.infer<typeof newPasswordSchema>;
