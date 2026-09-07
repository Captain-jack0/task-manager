import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { extractErrorMessage } from '@/api/client';
import { AuthShell } from './AuthShell';
import { useAuthStore } from './authStore';
import { credentialsSchema, type CredentialsForm } from './schemas';
import { useLogin } from './useAuth';

export function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CredentialsForm>({ resolver: zodResolver(credentialsSchema) });

  if (token) return <Navigate to="/tasks" replace />;

  const onSubmit = (values: CredentialsForm) => {
    loginMutation.mutate(values, {
      onSuccess: () => {
        toast.success('Welcome back!');
        navigate('/tasks');
      },
      onError: (err) => toast.error(extractErrorMessage(err, 'Login failed')),
    });
  };

  return (
    <AuthShell title="Sign in" subtitle="Manage your tasks across devices.">
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Link
          to="/forgot-password"
          className="-mt-2 self-end text-xs text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          Forgot password?
        </Link>
        <Button type="submit" isLoading={loginMutation.isPending}>
          Sign in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-medium text-slate-900 underline underline-offset-2 dark:text-white">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}
