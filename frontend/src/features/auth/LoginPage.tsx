import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { extractErrorMessage } from '@/api/client';
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
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="mb-6 flex items-center gap-2 px-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-900 dark:bg-white" />
        <span className="font-semibold tracking-tight">Tasks</span>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your tasks across devices.
        </p>
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
      </div>
    </div>
  );
}
