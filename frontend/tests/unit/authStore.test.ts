import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/features/auth/authStore';

const sampleUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'a@b.com',
  created_at: '2026-01-01T00:00:00Z',
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('starts unauthenticated', () => {
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('setSession persists token + user', () => {
    useAuthStore.getState().setSession('jwt-xyz', sampleUser);
    expect(useAuthStore.getState().token).toBe('jwt-xyz');
    expect(useAuthStore.getState().user?.email).toBe('a@b.com');
  });

  it('logout clears state', () => {
    useAuthStore.getState().setSession('jwt-xyz', sampleUser);
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
