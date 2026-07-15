import { z } from 'zod';

export const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().max(10_000).optional().or(z.literal('')),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high']),
  due_date: z.string().optional().or(z.literal('')),
  energy_level: z.enum(['low', 'medium', 'high']).optional().or(z.literal('')),
  estimated_minutes: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100_000),
      { message: 'Enter minutes between 1 and 100000' },
    ),
  tag_ids: z.array(z.string()).default([]),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;
