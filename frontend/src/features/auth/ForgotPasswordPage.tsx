import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { extractErrorMessage } from '@/api/client';
import { AuthShell } from './AuthShell';
import { emailSchema, type EmailForm } from './schemas';
import { useForgotPassword } from './useAuth';

export function ForgotPasswordPage() {
  const mutation = useForgotPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });

  const onSubmit = (values: EmailForm) => {
    mutation.mutate(values.email, {
      onError: (err) => toast.error(extractErrorMessage(err, 'Could not send reset link')),
    });
  };

  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we'll send you a link.">
      {mutation.isSuccess ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          If that email is registered, a reset link is on its way. It expires in 30 minutes —
          check your spam folder if it doesn&apos;t show up.
        </p>
      ) : (
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" isLoading={mutation.isPending}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="font-medium text-slate-900 underline underline-offset-2 dark:text-white">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
