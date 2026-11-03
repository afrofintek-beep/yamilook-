import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { triggerSuccessConfetti } from '@/lib/confetti';

type ResetPasswordFormData = { password: string; confirmPassword: string };

export default function ResetPassword() {
  const { t } = useTranslation();
  const resetPasswordSchema = z.object({
    password: z.string().min(8, t('publicAuth.passwordMin', { count: 8 })),
    confirmPassword: z.string(),
  }).refine(data => data.password === data.confirmPassword, {
    message: t('publicAuth.passwordMismatch'), path: ['confirmPassword'],
  });
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  const password = form.watch('password');

  const passwordRequirements = [
    { key: 'minLength', test: password.length >= 8, label: t('auth.passwordRequirements.minLength') },
    { key: 'uppercase', test: /[A-Z]/.test(password), label: t('auth.passwordRequirements.uppercase') },
    { key: 'lowercase', test: /[a-z]/.test(password), label: t('auth.passwordRequirements.lowercase') },
    { key: 'number', test: /[0-9]/.test(password), label: t('auth.passwordRequirements.number') },
  ];

  useEffect(() => {
    // Check if we have an access token in the URL (from email link)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (type !== 'recovery' && !accessToken) {
      // No valid recovery session, redirect to forgot password
      toast.error(t('auth.invalidResetLink'));
      navigate('/forgot-password');
    }
  }, [navigate, t]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast.error(t('publicAuth.retry'));
      } else {
        triggerSuccessConfetti();
        setIsSuccess(true);
        toast.success(t('auth.passwordUpdated'));
        
        // Redirect to login after a delay
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (error) {
      toast.error(t('publicAuth.retry'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthLayout
        title={t('auth.passwordUpdated')}
        subtitle={t('auth.redirectingToLogin')}
      >
        <motion.div
          className="flex flex-col items-center text-center space-y-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </motion.div>
          
          <p className="text-muted-foreground">
            {t('auth.canNowLogin')}
          </p>
        </motion.div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.createNewPassword')}
      subtitle={t('auth.createNewPasswordSubtitle')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Input
                          {...field}
                          type={showPassword ? 'text' : 'password'}
                          placeholder={t('auth.newPassword')}
                          className="pl-10 pr-10"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          {/* Password Requirements */}
          {password && (
            <motion.div
              className="grid grid-cols-2 gap-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
            >
              {passwordRequirements.map((req) => (
                <div
                  key={req.key}
                  className={cn(
                    'flex items-center gap-2 text-xs transition-colors',
                    req.test ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                  )}
                >
                  <Check className={cn('w-3 h-3', req.test ? 'opacity-100' : 'opacity-30')} />
                  {req.label}
                </div>
              ))}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Input
                          {...field}
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder={t('auth.confirmPassword')}
                          className="pl-10 pr-10"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Button
              type="submit"
              className="w-full h-12 text-base font-medium"
              disabled={isLoading || !form.formState.isValid}
            >
              {isLoading ? t('auth.updating') : t('auth.updatePassword')}
            </Button>
          </motion.div>
        </form>
      </Form>
    </AuthLayout>
  );
}
