import { communityReturn } from '@/features/academia/community-links';
import { getYamilookPublicUrl } from '@/lib/public-site';
import { captureReferralCode, getReferralCode, clearReferralCode } from '@/lib/referral';
import { buildInvitationSignupMetadata, createRegisterSchema, hasInviteCodeInSearch, accessCodeSchema, type RegisterFormValues } from '@/lib/invitation-registration';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Mail, Lock, User, AtSign, Check, X, KeyRound } from 'lucide-react';
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
import { toast } from 'sonner';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { SocialLoginButtons } from './SocialLoginButtons';
import { triggerCelebrationConfetti } from '@/lib/confetti';


export function RegisterForm() {
  const { t } = useTranslation();
  const [isInvitationSignup] = useState(() => hasInviteCodeInSearch(window.location.search));
  const registerSchema = useMemo(() => createRegisterSchema(isInvitationSignup), [isInvitationSignup]);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const codeCheckVersion = useRef(0);
  const navigate = useNavigate();
  const returnToCommunity = communityReturn(useLocation().search);
  const communitySearch = returnToCommunity ? `?next=${encodeURIComponent(returnToCommunity)}` : "";

  const passwordRequirements = [
    { regex: /.{8,}/, label: t('auth.passwordRequirements.minLength') },
    { regex: /[A-Z]/, label: t('auth.passwordRequirements.uppercase') },
    { regex: /[a-z]/, label: t('auth.passwordRequirements.lowercase') },
    { regex: /[0-9]/, label: t('auth.passwordRequirements.number') },
  ];

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      accessCode: '',
      displayName: '',
      username: '',
      email: '',
      password: '',
    },
    mode: 'onChange',
  });

  const isEmailValid = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const password = form.watch('password');

  const checkAccessCode = async (code: string) => {
    const version = ++codeCheckVersion.current;
    setCodeValid(null);
    if (!accessCodeSchema.safeParse(code).success) {
      setCheckingCode(false);
      return;
    }
    setCheckingCode(true);
    try {
      const { data, error } = await supabase.rpc('validate_mvp_access_code', { p_code: code.trim().toUpperCase() });
      if (version !== codeCheckVersion.current) return;
      const result = data as { valid?: boolean } | null;
      setCodeValid(error ? null : result?.valid === true);
    } catch {
      if (version === codeCheckVersion.current) setCodeValid(null);
    } finally {
      if (version === codeCheckVersion.current) setCheckingCode(false);
    }
  };

  useEffect(() => {
    captureReferralCode();
    const code = getReferralCode();
    if (code) {
      form.setValue('accessCode', code, { shouldValidate: true });
      void checkAccessCode(code);
    }
    // Read the invitation once when this form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkUsernameAvailability = async (username: string) => {
    if (username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setIsCheckingUsername(true);
    const { data } = await supabase
      .from('public_profiles')
      .select('username')
      .eq('username', username.toLowerCase())
      .single();

    setUsernameAvailable(!data);
    setIsCheckingUsername(false);
  };

  const onSubmit = async (values: RegisterFormValues) => {
    if (!isInvitationSignup && usernameAvailable === false) {
      toast.error(t('auth.usernameTaken'));
      return;
    }

    setIsLoading(true);
    try {
      const { data: validation, error: validationError } = await supabase.rpc('validate_mvp_access_code', { p_code: values.accessCode.trim().toUpperCase() });
      const result = validation as { valid?: boolean; error?: string } | null;
      if (validationError || !result?.valid) {
        toast.error(validationError ? 'Não foi possível validar o convite. Tenta novamente.' : result?.error || 'Código de convite inválido ou já utilizado.');
        return;
      }
      // Use supabase directly to get the user object for code consumption
      const { data: authData, error } = await supabase.auth.signUp({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        options: {
          emailRedirectTo: getYamilookPublicUrl(`/onboarding${communitySearch}`),
          data: {
            ...buildInvitationSignupMetadata(isInvitationSignup, values.accessCode, values.displayName, values.username),
          },
        },
      });

      if (error) {
        toast.error(error.message.includes('MVP_ONLY')
          ? t('auth.mvpOnlyToast', 'A Yamilook está em fase MVP (só por convite). A data de lançamento será anunciada brevemente.')
          : error.message);
        return;
      }

      // New individual invitations are consumed atomically by the auth.users trigger.
      // Legacy MVP candidate codes keep their existing client-side consumption path.
      const userId = authData?.user?.id;
      if (userId && !isInvitationSignup) {
        await supabase.rpc('consume_mvp_access_code', {
          p_code: values.accessCode.trim().toUpperCase(),
          p_user_id: userId,
        });
      }

      triggerCelebrationConfetti();
      clearReferralCode();
      if (!authData.session) {
        toast.success('Conta criada. Confirma o teu email antes de entrar.');
        navigate(`/login${communitySearch}`);
        return;
      }
      if (isInvitationSignup && userId) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ onboarding_completed: true, app_tour_completed: true })
          .eq('id', userId);
        if (profileError) {
          toast.error('A conta foi criada, mas o perfil não ficou concluído. Entra novamente para continuar.');
          navigate(`/login${communitySearch}`);
          return;
        }
      }
      toast.success(t('auth.accountCreated'));
      navigate(isInvitationSignup ? (returnToCommunity || '/muxi') : `/onboarding${communitySearch}`);
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <motion.form 
        onSubmit={form.handleSubmit(onSubmit, (errors) => {
          const firstError = Object.values(errors)[0];
          toast.error(firstError?.message || 'Verifica os campos assinalados acima.');
        })}
        className="space-y-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        {/* Aviso de fase MVP */}
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
          🚀 {isInvitationSignup ? 'Convite individual: usa o email que recebeu este link. O perfil pode ser completado depois.' : t('auth.mvpBanner', 'A Yamilook está em fase de lançamento fechado (MVP): a inscrição requer um código de convite de um membro. A data de lançamento pública será anunciada brevemente.')}
        </div>

        {isInvitationSignup ? (
          <div className="rounded-xl border border-primary/20 bg-secondary/40 px-4 py-3 text-sm text-center" role="note">
            O convite é individual e de utilização única. Introduz o email ao qual foi enviado.
            {codeValid === false && <p className="mt-2 text-destructive">Este convite é inválido ou já foi utilizado. Pede um novo convite.</p>}
          </div>
        ) : (
          <>
        {/* Access Code — first field */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
        >
          <FormField
            control={form.control}
            name="accessCode"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t('auth.accessCodeLabel', 'Código de convite ou de acesso MVP *')}</FormLabel>
                  <div className={fieldState.error ? "animate-shake" : ""}>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="XXXX-XXXX"
                          autoCapitalize="characters"
                          autoCorrect="off"
                          spellCheck={false}
                          className={cn(
                            "pl-10 pr-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary font-mono tracking-widest uppercase",
                            codeValid === true && "ring-2 ring-green-500",
                            codeValid === false && "ring-2 ring-destructive",
                            fieldState.error && "ring-2 ring-destructive"
                          )}
                          disabled={isLoading}
                          onChange={(e) => {
                            field.onChange(e);
                            checkAccessCode(e.target.value);
                          }}
                        />
                      </FormControl>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {checkingCode ? (
                          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                        ) : codeValid === true ? (
                          <Check className="w-5 h-5 text-green-500" />
                        ) : codeValid === false ? (
                          <X className="w-5 h-5 text-destructive" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                {codeValid === false && (
                  <p className="text-sm text-destructive">Código inválido ou já utilizado</p>
                )}
                {codeValid === true && (
                  <p className="text-sm text-green-600">✓ Código válido!</p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </motion.div>

          </>
        )}

        {!isInvitationSignup && <>
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <FormField
            control={form.control}
            name="displayName"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t('auth.displayName')}</FormLabel>
                  <div className={fieldState.error ? "animate-shake" : ""}>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('auth.displayNamePlaceholder')}
                          className={`pl-10 pr-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary ${fieldState.error ? 'ring-2 ring-destructive' : ''} ${!fieldState.error && field.value && field.value.length >= 2 ? 'ring-2 ring-green-500' : ''}`}
                          disabled={isLoading}
                        />
                      </FormControl>
                      {!fieldState.error && field.value && field.value.length >= 2 && (
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
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <FormField
            control={form.control}
            name="username"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t('auth.username')}</FormLabel>
                  <div className={fieldState.error ? "animate-shake" : ""}>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('auth.usernamePlaceholder')}
                          className={cn(
                            "pl-10 pr-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary",
                            usernameAvailable === true && "ring-2 ring-green-500",
                            usernameAvailable === false && "ring-2 ring-red-500",
                            fieldState.error && "ring-2 ring-destructive"
                          )}
                          disabled={isLoading}
                          onChange={(e) => {
                            field.onChange(e);
                            checkUsernameAvailability(e.target.value);
                          }}
                        />
                      </FormControl>
                      {field.value.length >= 3 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {isCheckingUsername ? (
                            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                          ) : usernameAvailable === true ? (
                            <Check className="w-5 h-5 text-green-500" />
                          ) : usernameAvailable === false ? (
                            <X className="w-5 h-5 text-red-500" />
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                <FormMessage />
                {usernameAvailable === false && (
                  <p className="text-sm text-destructive">{t('auth.usernameTaken')}</p>
                )}
              </FormItem>
            )}
          />
        </motion.div>

        </>}

        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.7 }}
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{isInvitationSignup ? 'Email do convite' : t('auth.email')}</FormLabel>
                  <div className={fieldState.error ? "animate-shake" : ""}>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="nome@exemplo.com"
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
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.8 }}
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
                          className={`pl-10 pr-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary ${fieldState.error ? 'ring-2 ring-destructive' : ''}`}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                {password && (
                  <div className="mt-3 space-y-2">
                    {passwordRequirements.map((req, i) => {
                      const isMet = req.regex.test(password);
                      return (
                        <div
                          key={i}
                          className={cn(
                            'flex items-center gap-2 text-sm transition-colors',
                            isMet ? 'text-green-600' : 'text-muted-foreground'
                          )}
                        >
                          {isMet ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-current" />
                          )}
                          {req.label}
                        </div>
                      );
                    })}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.9 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            type="submit"
            className="w-full h-12 rounded-xl bg-gradient-primary hover:opacity-90 transition-all text-white font-semibold shadow-md hover:shadow-lg mt-6"
            disabled={isLoading || (!isInvitationSignup && (isCheckingUsername || usernameAvailable === false))}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {t('auth.creatingAccount')}
              </>
            ) : (
              t('auth.createAccount')
            )}
          </Button>
        </motion.div>

        {!isInvitationSignup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.0 }}
        >
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-card text-muted-foreground">
                {t('auth.continueWith')}
              </span>
            </div>
          </div>

          {!isInvitationSignup && <SocialLoginButtons isLoading={isLoading} />}

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              {t('auth.login')}
            </Link>
          </p>
        </motion.div>
        )}
      </motion.form>
    </Form>
  );
}