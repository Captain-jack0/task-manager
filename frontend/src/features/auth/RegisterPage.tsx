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
    <AuthShell title="Create account" subtitle="Free, no credit card required.">
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
    </AuthShell>
  );
}
