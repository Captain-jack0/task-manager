import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { extractErrorMessage } from '@/api/client';
import { useAuthStore } from '@/features/auth/authStore';
import { useChangePassword, useUpdateProfile } from '@/features/auth/useAuth';

const CARD =
  'rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900';

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [name, setName] = useState(user?.full_name ?? '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const passwordError =
    next && next.length < 8
      ? 'At least 8 characters'
      : confirm && confirm !== next
        ? 'Passwords do not match'
        : undefined;

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(
      { full_name: name.trim() || null },
      {
        onSuccess: () => toast.success('Profile saved'),
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not save profile')),
      },
    );
  };

  const savePassword = (e: FormEvent) => {
    e.preventDefault();
    if (!current || !next || passwordError) return;
    changePassword.mutate(
      { current_password: current, new_password: next },
      {
        onSuccess: () => {
          toast.success('Password changed');
          setCurrent('');
          setNext('');
          setConfirm('');
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not change password')),
      },
    );
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Your profile and sign-in details.</p>
      </div>

      <form className={CARD} onSubmit={saveProfile} noValidate>
        <h2 className="text-base font-semibold tracking-tight">Profile</h2>
        <div className="mt-4 flex flex-col gap-4">
          <Input
            label="Full name"
            name="full_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            autoComplete="name"
            maxLength={120}
            hint="Shown instead of your email across the app."
          />
          <Input label="Email" name="email" value={user?.email ?? ''} disabled hint="Used to sign in; cannot be changed here." />
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" isLoading={updateProfile.isPending}>
            Save
          </Button>
        </div>
      </form>

      <form className={CARD} onSubmit={savePassword} noValidate>
        <h2 className="text-base font-semibold tracking-tight">Password</h2>
        <div className="mt-4 flex flex-col gap-4">
          <Input
            label="Current password"
            name="current_password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <Input
            label="New password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <Input
            label="Confirm new password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={passwordError}
          />
        </div>
        <div className="mt-5 flex justify-end">
          <Button
            type="submit"
            isLoading={changePassword.isPending}
            disabled={!current || !next || !confirm || Boolean(passwordError)}
          >
            Change password
          </Button>
        </div>
      </form>
    </div>
  );
}
