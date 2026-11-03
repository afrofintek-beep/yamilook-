import { EntryLanguageSelector } from '@/components/auth/EntryLanguageSelector';
import { communityReturn } from '@/features/academia/community-links';
import { ResidenceForm } from '@/components/residence/ResidenceForm';
import { submitResidence, validResidencePlan, type ResidencePlan } from '@/lib/residence';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  User,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Users,
  MessageCircle,
  Phone,
  Heart,
  Calendar,
   MapPin,
   RefreshCw,
   Check,
   Eye,
   EyeOff,
   Loader2,
   Mail,
   Lock,
   AtSign,
   X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { captureReferralCode, getReferralCode, clearReferralCode } from '@/lib/referral';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import YamilookLogo from '@/components/brand/YamilookLogo';
import { triggerCelebrationConfetti } from '@/lib/confetti';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { Link } from 'react-router-dom';
import { loadOnboardingDraft, saveOnboardingDraft, clearOnboardingDraft } from '@/lib/onboarding-draft';

 // Import onboarding illustrations
 import welcomeBandaImg from '@/assets/onboarding/welcome-banda.jpg';
 import bandaCommunityImg from '@/assets/onboarding/banda-community.jpg';
 import profilePhotoImg from '@/assets/onboarding/profile-photo.jpg';
 import locationPinImg from '@/assets/onboarding/location-pin.jpg';
 import birthdayCakeImg from '@/assets/onboarding/birthday-cake.jpg';
 import bioStoryImg from '@/assets/onboarding/bio-story.jpg';
 import genderIdentityImg from '@/assets/onboarding/gender-identity.jpg';
 import tourChatImg from '@/assets/onboarding/tour-chat.jpg';
 import tourCallsImg from '@/assets/onboarding/tour-calls.jpg';
 import tourGroupsImg from '@/assets/onboarding/tour-groups.jpg';
 import tourStoriesImg from '@/assets/onboarding/tour-stories.jpg';

const steps = ['gender', 'birthday', 'banda', 'welcome', 'avatar', 'bio', 'tour', 'register'].map(id => ({ id }));

// Tour slides with African cultural context and illustrations
const tourSlides = [
  {
    icon: MessageCircle,
    image: tourChatImg,
    bgColor: 'from-sankofa/20 to-sankofa-glow/10',
  },
  {
    icon: Phone,
    image: tourCallsImg,
    bgColor: 'from-ubuntu/20 to-ubuntu-glow/10',
  },
  {
    icon: Users,
    image: tourGroupsImg,
    bgColor: 'from-djembe/20 to-djembe-glow/10',
  },
  {
    icon: Sparkles,
    image: tourStoriesImg,
    bgColor: 'from-primary/20 to-primary/10',
  },
];

export default function Onboarding() {
  const { user, profile, loading: authLoading, updateProfile, signUp, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const returnToCommunity = communityReturn(useLocation().search);
  const { t, i18n } = useTranslation();

  // Track whether the user just completed onboarding in this session
  const justCompletedRef = useRef(false);

  useEffect(() => { captureReferralCode(); }, []);

  // Only the explicit completion action may finish onboarding.
  useEffect(() => {
    if (user && profile?.onboarding_completed && !justCompletedRef.current) {
      navigate(returnToCommunity || '/profile', { replace: true });
    }
  }, [user, profile?.onboarding_completed, navigate, returnToCommunity]);

  // If user is already authenticated (e.g. came back), skip to appropriate step
  const isAuthenticated = !!user;

  const localizedTourSlides = useMemo(() => tourSlides.map((slide, index) => ({
    ...slide,
    title: t(['onboardingFlow.tourChat', 'onboardingFlow.tourCalls', 'onboardingFlow.tourGroups', 'onboardingFlow.tourStories'][index]),
    description: t(['onboardingFlow.tourChatHint', 'onboardingFlow.tourCallsHint', 'onboardingFlow.tourGroupsHint', 'onboardingFlow.tourStoriesHint'][index]),
  })), [t]);

  const [currentStep, setCurrentStep] = useState(0);
  const [tourSlide, setTourSlide] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bio, setBio] = useState('');
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | 'other' | null>(null);
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('AO');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');

  // Registration fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState(() => {
    captureReferralCode();
    return getReferralCode() || '';
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [customNeighborhood, setCustomNeighborhood] = useState('');
  const [residencePlan, setResidencePlan] = useState<ResidencePlan>({method:'later'});

  const [draftReady, setDraftReady] = useState(false);
  const [draftSaved, setDraftSaved] = useState<boolean | null>(null);
  const [resumedDraft, setResumedDraft] = useState(false);
  const restoredIdentity = useRef<string | null>(null);
  const skipDraftSave = useRef(false);
  const draftIdentity = user?.email?.trim().toLowerCase() || 'guest';

  useEffect(() => {
    if (authLoading || restoredIdentity.current === draftIdentity) return;
    restoredIdentity.current = draftIdentity;
    skipDraftSave.current = true;
    captureReferralCode();
    const invite = getReferralCode() || '';
    const draft = loadOnboardingDraft(user ? { email: user.email } : { inviteCode: invite || undefined });
    const birthday = profile?.birthday?.split('-');
    setCurrentStep(draft?.currentStep ?? 0);
    setDisplayName(draft?.displayName ?? profile?.display_name ?? '');
    setUsername(draft?.username ?? profile?.username?.trim() ?? '');
    setEmail(user?.email ?? draft?.email ?? '');
    setPassword('');
    setAccessCode(draft?.inviteCode || invite);
    setSelectedGender(draft?.gender ?? profile?.gender ?? null);
    setBirthDay(draft?.birthDay ?? birthday?.[2] ?? '');
    setBirthMonth(draft?.birthMonth ?? birthday?.[1] ?? '');
    setBirthYear(draft?.birthYear ?? birthday?.[0] ?? '');
    setSelectedCountry(draft?.country ?? profile?.country_code ?? 'AO');
    setSelectedCity(draft?.city ?? profile?.city ?? '');
    setSelectedNeighborhood(draft?.neighborhood ?? profile?.neighborhood ?? '');
    setCustomNeighborhood(draft?.customNeighborhood ?? '');
    setBio(draft?.bio ?? profile?.bio ?? '');
    setUsernameAvailable(null);
    setAvatarFile(null);
    setAvatarUrl(profile?.avatar_url ?? null);
    setResidencePlan({method:draft?.residenceMethod || 'later'});
    setResumedDraft(!!draft);
    setDraftSaved(draft ? true : null);
    setDraftReady(true);
  }, [authLoading, draftIdentity, user, profile]);

  useEffect(() => {
    if (!draftReady || authLoading || justCompletedRef.current || profile?.onboarding_completed) return;
    if (skipDraftSave.current) { skipDraftSave.current = false; return; }
    setDraftSaved(saveOnboardingDraft({
      currentStep, displayName, username, email: user?.email || email, inviteCode: accessCode,
      gender: selectedGender, birthDay, birthMonth, birthYear, country: selectedCountry,
      city: selectedCity, neighborhood: selectedNeighborhood, customNeighborhood, bio, residenceMethod: residencePlan.method,
    }, user?.email));
  }, [draftReady, authLoading, currentStep, displayName, username, email, accessCode,
      selectedGender, birthDay, birthMonth, birthYear, selectedCountry, selectedCity,
      selectedNeighborhood, customNeighborhood, bio, residencePlan.method, user?.email, profile?.onboarding_completed]);

  const handleGenderSelect = (gender: 'male' | 'female' | 'other') => {
    setSelectedGender(gender);
    nextStep();
  };

  const handleBirthdaySave = () => {
    nextStep();
  };

  // Generate year options (13-100 years old)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 88 }, (_, i) => currentYear - 13 - i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: new Intl.DateTimeFormat(i18n.resolvedLanguage || i18n.language, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, index, 1))),
  }));

  // Get personalized greeting based on gender
  const getGreeting = () => t('entry.title');

  // Store avatar file locally (upload after registration)
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarFile(file);
    // Create local preview URL
    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);
    toast.success(t("onboardingFlow.photoSelected"));
  };

  const handleBioSave = () => {
    nextStep();
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Check username availability
  const checkUsernameAvailability = async (usernameVal: string) => {
    if (usernameVal.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    setIsCheckingUsername(true);
    const { data } = await supabase
      .from('public_profiles')
      .select('username')
      .eq('username', usernameVal.toLowerCase())
      .single();
    setUsernameAvailable(!data);
    setIsCheckingUsername(false);
  };

  // Password validation
  const passwordRequirements = [
    { regex: /.{8,}/, label: t("auth.minCharacters") },
    { regex: /[A-Z]/, label: t("auth.uppercase") },
    { regex: /[a-z]/, label: t("auth.lowercase") },
    { regex: /[0-9]/, label: t("auth.number") },
  ];

  const isPasswordValid = passwordRequirements.every(req => req.regex.test(password));
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isRegisterFormValid = displayName.length >= 2 && username.length >= 3 && isEmailValid && isPasswordValid && usernameAvailable !== false;

  // Final registration: create account + save all onboarding data
  const handleRegister = async () => {
    if (!isAuthenticated && !isRegisterFormValid) return;
    if (!selectedGender || !birthDay || !birthMonth || !birthYear || !selectedCity ||
        !selectedNeighborhood || (selectedNeighborhood === '__other__' && !customNeighborhood.trim())) {
      toast.error(t("onboardingFlow.missing"));
      return;
    }

    if (!validResidencePlan(residencePlan)) { toast.error(t("onboardingFlow.addressRequired")); setCurrentStep(2); return; }

    let userId = user?.id;
    const code = accessCode.trim().toUpperCase();
    if (!isAuthenticated && !code) {
      toast.error(t("onboardingFlow.inviteHint"));
      return;
    }
    setIsRegistering(true);
    try {
      if (!userId) {
        const { data: validation, error: validationError } = await supabase.rpc('validate_mvp_access_code', { p_code: code });
        const result = validation as { valid?: boolean; error?: string } | null;
        if (validationError || !result?.valid) {
          toast.error(t('onboardingFlow.invalidInvite'));
          return;
        }
        const { error } = await signUp(email, password, {
          display_name: displayName,
          username: username.toLowerCase(),
          access_code: code,
        });

        if (error) {
          toast.error(t('publicAuth.retry'));
          setIsRegistering(false);
          return;
        }

        clearReferralCode();

        // Wait for auth state to settle — poll for session up to 5 seconds
        let session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] = null;
        for (let attempt = 0; attempt < 10; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            session = data.session;
            break;
          }
        }

        if (!session?.user) {
          toast.success(t("onboardingFlow.confirmEmail"));
          setIsRegistering(false);
          navigate('/login');
          return;
        }

        userId = session.user.id;
      }

      // Upload avatar if selected
      let finalAvatarUrl: string | null = null;
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${userId}/avatar.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          finalAvatarUrl = publicUrl;
        }
      }

      // Build profile update with all onboarding data
      const profileUpdate: TablesUpdate<'profiles'> = {
        gender: selectedGender,
        onboarding_completed: true,
        app_tour_completed: true,
      };

      if (birthDay && birthMonth && birthYear) {
        profileUpdate.birthday = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`;
      }

      if (selectedCity) {
        profileUpdate.country_code = selectedCountry;
        profileUpdate.city = selectedCity;
        profileUpdate.neighborhood = selectedNeighborhood === '__other__'
          ? (customNeighborhood.trim() || 'Outro')
          : (selectedNeighborhood || null);
      }

      if (finalAvatarUrl) {
        profileUpdate.avatar_url = finalAvatarUrl;
      }

      if (bio.trim()) {
        profileUpdate.bio = bio.trim();
      }

      await submitResidence(residencePlan, selectedCountry, selectedCity,
        selectedNeighborhood === '__other__' ? customNeighborhood.trim() : selectedNeighborhood);

      // Save all onboarding data at once
      const { error: updateError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId);

      if (updateError) {
        logger.error('Error saving onboarding profile', 'onboarding', updateError);
        toast.error(t("publicAuth.retry"));
        setIsRegistering(false);
        return;
      }

      justCompletedRef.current = true;
      clearOnboardingDraft(user?.email || email);

      // Refresh AuthContext profile so ProtectedRoute sees onboarding_completed=true
      await refreshProfile();

      triggerCelebrationConfetti();
      toast.success(t("auth.accountCreated"));
      navigate(returnToCommunity || '/profile', { replace: true });
    } catch (error) {
      toast.error(t("publicAuth.retry"));
    } finally {
      setIsRegistering(false);
    }
  };

  const renderStep = () => {
    switch (steps[currentStep].id) {
      case 'gender':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center px-2"
          >
            {/* Illustration */}
            <motion.div
              className="relative w-40 h-40 mx-auto mb-6 rounded-3xl overflow-hidden shadow-2xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            >
              <img
                src={genderIdentityImg}
                alt={t("onboardingFlow.identity")}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                <Heart className="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-2xl font-bold mb-2 text-foreground">{t("onboardingFlow.identity")}</h2>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm">{t("onboardingFlow.identityHint")}</p>
            </motion.div>

            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <Button
                variant="outline"
                className={`h-16 rounded-2xl text-base font-medium transition-all border-2 ${
                  selectedGender === 'male'
                    ? 'border-ubuntu bg-ubuntu/10 text-ubuntu shadow-lg shadow-ubuntu/20'
                    : 'hover:border-ubuntu/50 hover:bg-ubuntu/5'
                }`}
                onClick={() => handleGenderSelect('male')}
              >
                <span className="text-2xl mr-3">👨🏾</span>
                <span>{t("onboardingFlow.male")}</span>
              </Button>
              <Button
                variant="outline"
                className={`h-16 rounded-2xl text-base font-medium transition-all border-2 ${
                  selectedGender === 'female'
                    ? 'border-sankofa bg-sankofa/10 text-sankofa shadow-lg shadow-sankofa/20'
                    : 'hover:border-sankofa/50 hover:bg-sankofa/5'
                }`}
                onClick={() => handleGenderSelect('female')}
              >
                <span className="text-2xl mr-3">👩🏾</span>
                <span>{t("onboardingFlow.female")}</span>
              </Button>
              <Button
                variant="outline"
                className={`h-16 rounded-2xl text-base font-medium transition-all border-2 ${
                  selectedGender === 'other'
                    ? 'border-djembe bg-djembe/10 text-djembe shadow-lg shadow-djembe/20'
                    : 'hover:border-djembe/50 hover:bg-djembe/5'
                }`}
                onClick={() => handleGenderSelect('other')}
              >
                <span className="text-2xl mr-3">✨</span>
                <span>{t("onboardingFlow.preferNotSay")}</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-6">{t("onboardingFlow.required")}</p>
          </motion.div>
        );

      case 'birthday':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center px-2"
          >
            {/* Illustration */}
            <motion.div
              className="relative w-40 h-40 mx-auto mb-6 rounded-3xl overflow-hidden shadow-2xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            >
              <img
                src={birthdayCakeImg}
                alt={t("onboardingFlow.birthday")}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                <Calendar className="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-2xl font-bold mb-2 text-foreground">{t("onboardingFlow.birthday")}</h2>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm">{t("onboardingFlow.birthdayHint")}</p>
            </motion.div>

            <div className="flex gap-2 max-w-xs mx-auto mb-6">
              <Select value={birthDay} onValueChange={setBirthDay}>
                <SelectTrigger className="flex-1 h-14 rounded-2xl border-2 text-base">
                  <SelectValue placeholder={t("onboardingFlow.day")} />
                </SelectTrigger>
                <SelectContent>
                  {days.map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={birthMonth} onValueChange={setBirthMonth}>
                <SelectTrigger className="flex-[1.5] h-14 rounded-2xl border-2 text-base">
                  <SelectValue placeholder={t("onboardingFlow.month")} />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={birthYear} onValueChange={setBirthYear}>
                <SelectTrigger className="flex-1 h-14 rounded-2xl border-2 text-base">
                  <SelectValue placeholder={t("onboardingFlow.year")} />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={prevStep}
                className="h-14 px-6 rounded-2xl border-2"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />{t("common.back")}</Button>
              <Button
                onClick={handleBirthdaySave}
                disabled={!birthDay || !birthMonth || !birthYear}
                className="h-14 px-8 rounded-2xl bg-gradient-primary hover:opacity-90 text-white font-semibold shadow-lg shadow-primary/30"
              >{t("onboardingFlow.continue")}<ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-6 text-center">{t("onboardingFlow.required")}</p>
          </motion.div>
        );

      case 'banda':
        return <ResidenceForm country={selectedCountry} city={selectedCity} neighborhood={selectedNeighborhood}
          customNeighborhood={customNeighborhood} onCountry={setSelectedCountry} onCity={setSelectedCity}
          onNeighborhood={setSelectedNeighborhood} onCustomNeighborhood={setCustomNeighborhood}
          plan={residencePlan} onPlan={setResidencePlan} onContinue={nextStep} onBack={prevStep} />;

      case 'welcome':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center px-2"
          >
            {/* Welcome Illustration */}
            <motion.div
              className="relative w-48 h-48 mx-auto mb-6 rounded-3xl overflow-hidden shadow-2xl"
              initial={{ scale: 0.8, opacity: 0, rotate: -5 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            >
              <img
                src={welcomeBandaImg}
                alt={t("entry.title")}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-3xl font-bold mb-2">
                <span className="text-gradient-primary">{getGreeting()}</span>{profile?.display_name ? `, ${profile.display_name}!` : '!'}
              </h2>
              <p className="text-lg text-muted-foreground mb-2">{t("onboardingFlow.welcomeHint")}</p>
              <p className="text-sm text-muted-foreground/80 mb-6 max-w-sm mx-auto">
                {t('onboardingFlow.profileHint')}
              </p>
            </motion.div>

            {/* Community illustration */}
            <motion.div
              className="w-full max-w-xs mx-auto mb-8 rounded-2xl overflow-hidden shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <img
                src={bandaCommunityImg}
                alt={t("entry.subtitle")}
                className="w-full h-32 object-cover"
              />
            </motion.div>

            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={prevStep}
                className="h-14 px-6 rounded-2xl border-2"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />{t("common.back")}</Button>
              <Button
                onClick={nextStep}
                className="h-14 px-8 rounded-2xl bg-gradient-primary hover:opacity-90 text-white font-semibold shadow-lg shadow-primary/30"
              >{t("onboardingFlow.continue")}<ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </motion.div>
        );

      case 'avatar':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center px-2"
          >
            {/* Illustration */}
            <motion.div
              className="relative w-40 h-40 mx-auto mb-6 rounded-3xl overflow-hidden shadow-2xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            >
              <img
                src={profilePhotoImg}
                alt={t("onboardingFlow.photo")}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                <Camera className="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-2xl font-bold mb-2 text-foreground">{t("onboardingFlow.photo")}</h2>
              <p className="text-muted-foreground mb-6 text-sm">
                {t('onboardingFlow.photoHint')}
              </p>
            </motion.div>

            <motion.div
              className="relative w-36 h-36 mx-auto mb-8"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
            >
              <Avatar className="w-36 h-36 border-4 border-primary/30 shadow-xl shadow-primary/20">
                <AvatarImage src={avatarUrl || ''} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-sankofa/20 text-5xl">
                  {profile?.display_name?.[0]?.toUpperCase() || <User className="w-12 h-12" />}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-1 right-1 w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-xl shadow-primary/40"
              >
                <Camera className="w-5 h-5 text-white" />
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </motion.div>

            {uploading && (
              <motion.div
                className="flex items-center justify-center gap-2 text-primary mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <RefreshCw className="w-4 h-4 animate-spin" />{t("onboardingFlow.photoLoading")}</motion.div>
            )}

            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={prevStep}
                className="h-14 px-6 rounded-2xl border-2"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />{t("common.back")}</Button>
              <Button
                onClick={nextStep}
                disabled={!avatarUrl}
                className="h-14 px-8 rounded-2xl bg-gradient-primary hover:opacity-90 text-white font-semibold shadow-lg shadow-primary/30"
              >{t("onboardingFlow.continue")}<ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-6 text-center">{t("onboardingFlow.required")}</p>
          </motion.div>
        );

      case 'bio':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-2"
          >
            {/* Illustration */}
            <motion.div
              className="relative w-40 h-40 mx-auto mb-6 rounded-3xl overflow-hidden shadow-2xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            >
              <img
                src={bioStoryImg}
                alt={t("onboardingFlow.bio")}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                <Sparkles className="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <h2 className="text-2xl font-bold mb-2 text-foreground">{t("onboardingFlow.bio")}</h2>
              <p className="text-muted-foreground mb-6 text-sm">
                {t('onboardingFlow.bioHint')}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t("onboardingFlow.bioPlaceholder")}
                className="min-h-[120px] rounded-2xl bg-secondary/30 border-2 focus:ring-2 focus:ring-primary focus:border-primary resize-none mb-2 text-base"
                maxLength={150}
              />
              <p className="text-sm text-muted-foreground text-right mb-6">
                {bio.length}/150
              </p>
            </motion.div>

            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={prevStep}
                className="h-14 px-6 rounded-2xl border-2"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />{t("common.back")}</Button>
              <Button
                onClick={handleBioSave}
                className="h-14 px-8 rounded-2xl bg-gradient-primary hover:opacity-90 text-white font-semibold shadow-lg shadow-primary/30"
              >
                {bio.trim() ? t("onboardingFlow.continue") : t("onboardingFlow.skip")}
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-6 text-center">{t("onboardingFlow.optional")}</p>
          </motion.div>
        );

      case 'tour':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={tourSlide}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="text-center"
              >
                {/* Tour illustration */}
                <div className={`relative w-full max-w-xs mx-auto mb-6 rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br ${localizedTourSlides[tourSlide].bgColor}`}>
                  <img
                    src={localizedTourSlides[tourSlide].image}
                    alt={localizedTourSlides[tourSlide].title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      {(() => {
                        const Icon = localizedTourSlides[tourSlide].icon;
                        return <Icon className="w-5 h-5 text-white" />;
                      })()}
                      <span className="text-white/80 text-sm font-medium">
                        {t('onboardingFlow.step', { current: tourSlide + 1, total: localizedTourSlides.length })}
                      </span>
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-bold mb-2 text-foreground">
                  {localizedTourSlides[tourSlide].title}
                </h3>
                <p className="text-muted-foreground mb-6 max-w-xs mx-auto text-sm">
                  {localizedTourSlides[tourSlide].description}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Dots */}
            <div className="flex justify-center gap-2 mb-6">
              {localizedTourSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setTourSlide(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === tourSlide
                      ? 'w-8 bg-gradient-primary'
                      : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                />
              ))}
            </div>

            {tourSlide < localizedTourSlides.length - 1 ? (
              <div className="flex gap-3 justify-center">
                <Button
                  variant="ghost"
                  onClick={() => tourSlide === 0 ? prevStep() : setTourSlide(tourSlide - 1)}
                  className="h-14 px-6 rounded-2xl"
                >
                  <ChevronLeft className="w-5 h-5 mr-2" />{t("common.back")}</Button>
                <Button
                  onClick={() => setTourSlide(tourSlide + 1)}
                  className="h-14 px-8 rounded-2xl bg-gradient-primary hover:opacity-90 text-white font-semibold shadow-lg shadow-primary/30"
                >{t("common.next")}<ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-3 justify-center">
                <Button
                  variant="ghost"
                  onClick={() => setTourSlide(tourSlide - 1)}
                  className="h-14 px-6 rounded-2xl"
                >
                  <ChevronLeft className="w-5 h-5 mr-2" />{t("common.back")}</Button>
                <Button
                  onClick={nextStep}
                  className="h-14 px-8 rounded-2xl bg-gradient-to-r from-ubuntu to-djembe hover:opacity-90 text-white font-semibold shadow-xl shadow-ubuntu/40"
                >{t("onboardingFlow.continue")}<ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            )}
          </motion.div>
        );

      case 'register':
        if (isAuthenticated) {
          return (
            <div className="space-y-5 px-4 max-w-sm mx-auto">
              <h2 className="text-2xl font-bold">{t("onboardingFlow.finish")}</h2>
              <p>{t('onboardingFlow.name')}: {profile?.display_name || user?.email}</p>
              <p>{t("onboardingFlow.finishHint")}</p>
              <Button variant="outline" onClick={prevStep} disabled={isRegistering}>{t("common.back")}</Button>
              <Button onClick={handleRegister} disabled={isRegistering}>
                {isRegistering ? t("common.saving") : t("onboardingFlow.finish")}
              </Button>
            </div>
          );
        }
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-2"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center mb-6"
            >
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-primary to-ubuntu flex items-center justify-center shadow-glow mb-4">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-foreground">{t("auth.createAccount")}</h2>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">{t("onboardingFlow.registerHint")}</p>
            </motion.div>

            <div className="space-y-4 max-w-xs mx-auto">
              <div>
                <label htmlFor="onboarding-invite" className="text-sm font-medium text-foreground mb-1.5 block">{t("onboardingFlow.invite")}</label>
                <Input
                  id="onboarding-invite"
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
                  placeholder={t("onboardingFlow.invitePlaceholder")}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-describedby="onboarding-invite-help"
                />
                <p id="onboarding-invite-help" className="text-xs text-muted-foreground mt-2">{t("onboardingFlow.inviteHint")}</p>
              </div>
              {/* Display Name */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("onboardingFlow.name")}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t("auth.displayNamePlaceholder")}
                    className={cn(
                      "pl-10 pr-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary",
                      displayName.length >= 2 && "ring-2 ring-green-500"
                    )}
                    disabled={isRegistering}
                  />
                  {displayName.length >= 2 && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                  )}
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("auth.username")}</label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      checkUsernameAvailability(e.target.value);
                    }}
                    placeholder={t("auth.usernamePlaceholder")}
                    className={cn(
                      "pl-10 pr-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary",
                      usernameAvailable === true && "ring-2 ring-green-500",
                      usernameAvailable === false && "ring-2 ring-red-500"
                    )}
                    disabled={isRegistering}
                  />
                  {username.length >= 3 && (
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
                {usernameAvailable === false && (
                  <p className="text-sm text-destructive mt-1">{t("auth.usernameTaken")}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("auth.email")}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="nome@exemplo.com"
                    className={cn(
                      "pl-10 pr-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary",
                      isEmailValid && "ring-2 ring-green-500"
                    )}
                    disabled={isRegistering}
                  />
                  {isEmailValid && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                  )}
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("auth.password")}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary"
                    disabled={isRegistering}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 space-y-1">
                    {passwordRequirements.map((req, i) => {
                      const isMet = req.regex.test(password);
                      return (
                        <div key={i} className={cn('flex items-center gap-2 text-xs transition-colors', isMet ? 'text-green-600' : 'text-muted-foreground')}>
                          {isMet ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                          {req.label}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-center mt-6">
              <Button
                variant="outline"
                onClick={prevStep}
                className="h-14 px-6 rounded-2xl border-2"
                disabled={isRegistering}
              >
                <ChevronLeft className="w-5 h-5 mr-2" />{t("common.back")}</Button>
              <Button
                onClick={handleRegister}
                disabled={!isRegisterFormValid || !accessCode.trim() || isRegistering}
                className="h-14 px-8 rounded-2xl bg-gradient-to-r from-ubuntu to-djembe hover:opacity-90 text-white font-semibold shadow-xl shadow-ubuntu/40"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />{t("auth.creatingAccount")}</>
                ) : (
                  <>{t("onboardingFlow.join")}<Sparkles className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">{t("onboardingFlow.accept")}{' '}
              <Link to="/terms" className="underline hover:text-foreground">{t("auth.termsOfService")}</Link>{' '}{t("auth.and")}{' '}
              <Link to="/privacy" className="underline hover:text-foreground">{t("auth.privacyPolicy")}</Link>
            </p>

            <p className="text-center text-sm text-muted-foreground mt-4">{t("auth.haveAccount")}{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">{t("auth.login")}</Link>
            </p>
          </motion.div>
        );

      default:
        return null;
    }
  };

  if (authLoading || !draftReady) {
    return <div role="status" className="min-h-screen flex items-center justify-center">{t("onboardingFlow.resuming")}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-hidden">
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-secondary/50">
        <motion.div
          className="h-full bg-gradient-to-r from-primary via-ubuntu to-djembe"
          initial={{ width: 0 }}
          animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Yamilook Brand Header */}
      <motion.div
        className="relative pt-8 pb-4 flex flex-col items-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="self-start ms-3 rounded-full"
          aria-label={t('common.back')}
          onClick={() => currentStep === 0 ? navigate('/welcome') : prevStep()}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <EntryLanguageSelector />
        <div className="bg-background">
          <YamilookLogo size="md" showTagline={false} animate={false} />
        </div>
        <p className="mt-2 text-sm font-medium text-primary/80 tracking-wide">{t("entry.subtitle")}</p>
        <div className="mt-3 px-4 py-1.5 rounded-full bg-secondary/50 text-xs font-medium text-muted-foreground">
          {t('onboardingFlow.step', { current: currentStep + 1, total: steps.length })}
          {draftReady && <span className="block text-xs mt-1" role="status">
            {draftSaved ? (resumedDraft ? t("onboardingFlow.resumed") : t("onboardingFlow.saved")) : draftSaved === false ? t("onboardingFlow.notSaved") : t("onboardingFlow.autosave")}
          </span>}
        </div>
      </motion.div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-4 pb-8">
        <div className="w-full max-w-md overflow-y-auto max-h-full">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
