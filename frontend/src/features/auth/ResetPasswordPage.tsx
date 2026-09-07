import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { extractErrorMessage } from '@/api/client';
import { AuthShell } from './AuthShell';
import { newPasswordSchema, type NewPasswordForm } from './schemas';
import { useResetPassword } from './useAuth';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const mutation = useResetPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordForm>({ resolver: zodResolver(newPasswordSchema) });

  const onSubmit = (values: NewPasswordForm) => {
    mutation.mutate(
      { token, password: values.password },
      {
        onSuccess: () => {
          toast.success('Password updated');
          navigate('/tasks');
        },
        onError: (err) => toast.error(extractErrorMessage(err, 'Could not reset password')),
      },
    );
  };

  return (
    <AuthShell title="Choose a new password" subtitle="At least 8 characters.">
      {token ? (
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" isLoading={mutation.isPending}>
            Update password
          </Button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          This link is missing its token. Request a new one below.
        </p>
      )}
      <p className="mt-4 text-center text-sm">
        <Link
          to="/forgot-password"
          className="font-medium text-slate-900 underline underline-offset-2 dark:text-white"
        >
          Request a new link
        </Link>
      </p>
    </AuthShell>
  );
}
