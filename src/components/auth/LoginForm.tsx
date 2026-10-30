import { communityReturn } from '@/features/academia/community-links';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Mail, Lock, Check, FlaskConical, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { SocialLoginButtons } from './SocialLoginButtons';
import { triggerSuccessConfetti } from '@/lib/confetti';

const loginSchema = z.object({
  email: z.string().email('Por favor insere um email válido'),
  password: z.string().min(6, 'A palavra-passe deve ter pelo menos 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const DEV_TEST_ACCOUNTS = [
  { email: 'maria@yamilook.test', password: 'TestUser123!', name: 'Maria' },
  { email: 'joao@yamilook.test', password: 'TestUser123!', name: 'João' },
  { email: 'ana@yamilook.test', password: 'TestUser123!', name: 'Ana' },
  { email: 'pedro@yamilook.test', password: 'TestUser123!', name: 'Pedro' },
];

export function LoginForm() {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDevAccounts, setShowDevAccounts] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const returnToCommunity = communityReturn(useLocation().search);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onChange',
  });

  const fillTestCredentials = (email: string, password: string) => {
    form.setValue('email', email, { shouldValidate: true });
    form.setValue('password', password, { shouldValidate: true });
    setShowDevAccounts(false);
  };

  const isEmailValid = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isPasswordValid = (password: string) => {
    return password.length >= 6;
  };

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      const { error } = await signIn(values.email, values.password);
      if (error) {
        // Handle specific error messages
        if (error.message.includes('Invalid login credentials')) {
          toast.error(t('auth.invalidCredentials') || 'Email ou palavra-passe incorretos');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Por favor tenta novamente');
        } else {
          toast.error(error.message);
        }
      } else {
        triggerSuccessConfetti();
        toast.success(t('auth.welcomeBackMsg'));
        navigate(returnToCommunity || '/feed');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(t('errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <motion.form 
        onSubmit={form.handleSubmit(onSubmit)} 
        className="space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ 
            opacity: 1, 
            x: 0,
            ...(form.formState.errors.email && { x: [0, -4, 4, -4, 4, 0] })
          }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t('auth.email')}</FormLabel>
                  <div className={fieldState.error ? "animate-shake" : ""}>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="nome@yamilook.com"
                          className={`pl-10 pr-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary ${fieldState.error ? 'ring-2 ring-destructive' : ''} ${!fieldState.error && field.value && isEmailValid(field.value) ? 'ring-2 ring-green-500' : ''}`}
                          disabled={isLoading}
                        />
                      </FormControl>
                      {!fieldState.error && field.value && isEmailValid(field.value) && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500 transition-all duration-300" />
                      )}
                    </div>
                  </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ 
            opacity: 1, 
            x: 0,
            ...(form.formState.errors.password && { x: [0, -4, 4, -4, 4, 0] })
          }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t('auth.password')}</FormLabel>
                  <div className={fieldState.error ? "animate-shake" : ""}>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <FormControl>
                        <Input
                          {...field}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          className={`pl-10 pr-16 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary ${fieldState.error ? 'ring-2 ring-destructive' : ''} ${!fieldState.error && field.value && isPasswordValid(field.value) ? 'ring-2 ring-green-500' : ''}`}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {!fieldState.error && field.value && isPasswordValid(field.value) && (
                          <Check className="w-5 h-5 text-green-500 transition-all duration-300" />
                        )}
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1 min-w-[24px] min-h-[24px] flex items-center justify-center"
                          aria-label={showPassword ? t('auth.hidePassword') || 'Hide password' : t('auth.showPassword') || 'Show password'}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </motion.div>

        <motion.div
          className="flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.7 }}
        >
          <Link
            to="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            {t('auth.forgotPassword')}
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            type="submit"
            className="w-full h-12 rounded-xl bg-gradient-primary hover:opacity-90 transition-all text-white font-semibold shadow-md hover:shadow-lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {t('auth.signingIn')}
              </>
            ) : (
            'Entrar no YamiLook'
            )}
          </Button>
        </motion.div>

        {/* Dev Quick Login - Only visible in development */}
        {import.meta.env.DEV && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.85 }}
            className="relative"
          >
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowDevAccounts(!showDevAccounts)}
              className="w-full h-10 rounded-xl border border-dashed border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-sm font-medium gap-2"
            >
              <FlaskConical className="w-4 h-4" />
              Login Rápido (Dev)
              <ChevronDown className={`w-4 h-4 transition-transform ${showDevAccounts ? 'rotate-180' : ''}`} />
            </Button>
            
            {showDevAccounts && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden"
              >
                {DEV_TEST_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => fillTestCredentials(account.email, account.password)}
                    className="w-full px-4 py-3 text-left hover:bg-secondary/50 transition-colors border-b border-border last:border-b-0 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-sm">{account.name}</p>
                      <p className="text-xs text-muted-foreground">{account.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                      Preencher
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.9 }}
        >
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-card text-muted-foreground">
                Ou entra com
              </span>
            </div>
          </div>

          <SocialLoginButtons isLoading={isLoading} />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-card text-muted-foreground">
                Novo no YamiLook?
              </span>
            </div>
          </div>

          <Link to={returnToCommunity ? `/register?next=${encodeURIComponent(returnToCommunity)}` : "/register"}>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl border-2 hover:bg-secondary/50 font-semibold transition-all hover:shadow-md"
              >
                {t('auth.createAccount')}
              </Button>
            </motion.div>
          </Link>
        </motion.div>
      </motion.form>
    </Form>
  );
}