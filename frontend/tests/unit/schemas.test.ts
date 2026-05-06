import { describe, it, expect } from 'vitest';
import { credentialsSchema } from '@/features/auth/schemas';
import { taskFormSchema } from '@/features/tasks/schemas';

describe('credentialsSchema', () => {
  it('accepts valid credentials', () => {
    const result = credentialsSchema.safeParse({
      email: 'a@b.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = credentialsSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = credentialsSchema.safeParse({
      email: 'a@b.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('taskFormSchema', () => {
  it('accepts a minimal task with defaults', () => {
    const result = taskFormSchema.safeParse({
      title: 'Buy milk',
      status: 'todo',
      priority: 'medium',
      tag_ids: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = taskFormSchema.safeParse({
      title: '   ',
      status: 'todo',
      priority: 'medium',
      tag_ids: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects bogus status', () => {
    const result = taskFormSchema.safeParse({
      title: 'x',
      status: 'bogus',
      priority: 'medium',
      tag_ids: [],
    });
    expect(result.success).toBe(false);
  });
});
