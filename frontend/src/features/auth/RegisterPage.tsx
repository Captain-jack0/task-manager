import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { extractErrorMessage } from '@/api/client';
import { useAuthStore } from './authStore';
import { credentialsSchema, type CredentialsForm } from './schemas';
import { useRegister } from './useAuth';

export function RegisterPage() {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CredentialsForm>({ resolver: zodResolver(credentialsSchema) });

  if (token) return <Navigate to="/tasks" replace />;

  const onSubmit = (values: CredentialsForm) => {
    registerMutation.mutate(values, {
      onSuccess: () => {
        toast.success('Account created');
        navigate('/tasks');
      },
      onError: (err) => toast.error(extractErrorMessage(err, 'Registration failed')),
    });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="mb-6 flex items-center gap-2 px-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-900 dark:bg-white" />
        <span className="font-semibold tracking-tight">Tasks</span>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold tracking-tight">Create account</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Free, no credit card required.
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
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" isLoading={registerMutation.isPending}>
            Create account
          </Button>
        </form>
        <p className="mt-4 text-center text-sm">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-slate-900 underline underline-offset-2 dark:text-white">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
