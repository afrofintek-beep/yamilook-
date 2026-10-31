import { getYamilookPublicUrl } from '@/lib/public-site';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
    mode: 'onChange',
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: getYamilookPublicUrl('/reset-password'),
      });

      if (error) {
        toast.error(error.message);
      } else {
        setSentEmail(data.email);
        setEmailSent(true);
        toast.success(t('auth.resetEmailSent'));
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <AuthLayout
        title={t('auth.checkYourEmail')}
        subtitle={t('auth.resetEmailSentTo')}
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
            {t('auth.sentTo')} <span className="font-medium text-foreground">{sentEmail}</span>
          </p>
          
          <p className="text-sm text-muted-foreground">
            {t('auth.checkSpam')}
          </p>

          <div className="flex flex-col gap-3 w-full pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setEmailSent(false);
                form.reset();
              }}
            >
              {t('auth.tryDifferentEmail')}
            </Button>
            
            <Link to="/login" className="w-full">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('auth.backToLogin')}
              </Button>
            </Link>
          </div>
        </motion.div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.resetPassword')}
      subtitle={t('auth.resetPasswordSubtitle')}
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
              name="email"
              render={({ field }) => (
                <FormItem>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder={t('auth.email')}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </FormControl>
                    </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Button
              type="submit"
              className="w-full h-12 text-base font-medium"
              disabled={isLoading || !form.formState.isValid}
            >
              {isLoading ? t('auth.sending') : t('auth.sendResetLink')}
            </Button>
          </motion.div>

          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('auth.backToLogin')}
            </Link>
          </motion.div>
        </form>
      </Form>
    </AuthLayout>
  );
}
