import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
import { AFRICAN_LOCATIONS } from '@/lib/african-locations';
import { findMatchingNeighborhood } from '@/lib/african-locations';
import { findNearestNeighborhood, hasCityCoordinates } from '@/lib/neighborhood-coordinates';
 import { getDistancesToAllNeighborhoods } from '@/lib/neighborhood-coordinates';
import YamilookLogo from '@/components/brand/YamilookLogo';
import { triggerCelebrationConfetti } from '@/lib/confetti';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { snapToGrid } from '@/lib/geo-privacy';
import { Link } from 'react-router-dom';

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
 
const steps = [
   { id: 'gender', title: 'Quem és tu?', subtitle: 'Vamos conhecer-nos' },
   { id: 'birthday', title: 'Quando nasceste?', subtitle: 'A tua história começa aqui' },
   { id: 'banda', title: 'Qual é a tua Banda?', subtitle: 'O mambo começa onde estás' },
   { id: 'welcome', title: 'Bem-vindo à Banda!', subtitle: 'Já fazes parte da família' },
   { id: 'avatar', title: 'Mostra a tua cara', subtitle: null as unknown as string },
   { id: 'bio', title: 'Conta a tua história', subtitle: 'O que te faz único?' },
   { id: 'tour', title: 'Descobre a Banda', subtitle: 'Tudo o que podes fazer' },
   { id: 'register', title: 'Cria a tua conta', subtitle: 'Último passo para entrares na banda' },
];

// Tour slides with African cultural context and illustrations
const tourSlides = [
  {
    icon: MessageCircle,
    title: null as unknown as string, // replaced dynamically via i18n
    description: 'Mensagens em tempo real, áudios, fotos e vídeos. A banda nunca para de falar.',
    image: tourChatImg,
    bgColor: 'from-sankofa/20 to-sankofa-glow/10',
  },
  {
    icon: Phone,
    title: 'Chamadas que aproximam',
    description: null as unknown as string, // replaced dynamically via i18n
    image: tourCallsImg,
    bgColor: 'from-ubuntu/20 to-ubuntu-glow/10',
  },
  {
    icon: Users,
    title: 'A tua Banda, os teus grupos',
    description: null as unknown as string, // replaced dynamically via i18n
    image: tourGroupsImg,
    bgColor: 'from-djembe/20 to-djembe-glow/10',
  },
  {
    icon: Sparkles,
    title: 'Momambos que ficam',
    description: 'Partilha os teus melhores momentos. A banda quer ver a tua vida.',
    image: tourStoriesImg,
    bgColor: 'from-primary/20 to-primary/10',
  },
];

export default function Onboarding() {
  const { user, profile, updateProfile, signUp, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Track whether the user just completed onboarding in this session
  const justCompletedRef = useRef(false);

  // The onboarding wizard is the pre-signup flow. If the user is already
  // Capturar código de convite (?ref=) logo à entrada
  useEffect(() => {
    captureReferralCode();
  }, []);

  // authenticated, send them to the app. If their profile is incomplete,
  // mark it complete in the background so they don't get bounced back here.
  useEffect(() => {
    if (!user || justCompletedRef.current) return;

    if (profile?.onboarding_completed) {
      navigate('/profile', { replace: true });
      return;
    }

    if (profile && !profile.onboarding_completed) {
      (async () => {
        await supabase
          .from('profiles')
          .update({ onboarding_completed: true, app_tour_completed: true })
          .eq('id', user.id);
        await refreshProfile();
        navigate('/muxi', { replace: true });
      })();
    }
  }, [user, profile, navigate, refreshProfile]);

  // If user is already authenticated (e.g. came back), skip to appropriate step
  const isAuthenticated = !!user;

  const friends = t('social.friends');
  // Inject i18n into tour slides that need dynamic text
  const localizedTourSlides = useMemo(() => {
    const vars = { friends, closeFriendsGroup: t('social.closeFriendsGroup') };
    return tourSlides.map((slide, i) => {
      if (i === 0) return { ...slide, title: t('onboarding.tourChatTitle', vars) };
      if (i === 1) return { ...slide, description: t('onboarding.tourCallsDesc', vars) };
      if (i === 2) return { ...slide, description: t('onboarding.tourGroupsDesc', vars) };
      return slide;
    });
  }, [t, friends]);

  // Localized step subtitle for avatar
  const localizedSteps = useMemo(() =>
    steps.map(s => s.id === 'avatar' ? { ...s, subtitle: t('onboarding.avatarSubtitle', { friends }) } : s), [t, friends]
  );

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
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [geoNeighborhoodNotFound, setGeoNeighborhoodNotFound] = useState(false);
  const [detectedNeighborhoodName, setDetectedNeighborhoodName] = useState<string | null>(null);
  const [autoDetectionTriggered, setAutoDetectionTriggered] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [detectedDistance, setDetectedDistance] = useState<number | null>(null);
  const [gpsReadings, setGpsReadings] = useState<
    Array<{
      lat: number;
      lng: number;
      neighborhood: string;
      distance: number;
      top5: Array<{ name: string; distance: number }>;
    }>
  >([]);
  const [isDoingMultipleReadings, setIsDoingMultipleReadings] = useState(false);
  const [currentReadingIndex, setCurrentReadingIndex] = useState(0);

  // Detection logic
  const SEARCH_RADIUS_KM = 2; // eligible neighborhoods
  const DISTANCE_LIMIT_KM = 2; // if farther than this from a center, do extra readings
  const AMBIGUITY_MARGIN_KM = 0.35; // if top-2 are too close, use geocoding name when possible
  const ADDITIONAL_READINGS = 4;

  const reverseGeocodeAndMatchNeighborhood = async (lat: number, lng: number) => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=pt`,
      { headers: { 'User-Agent': 'Yamilook/1.0' } }
    );
    const data = await response.json();

    const possibleNames = [
      data.address?.suburb,
      data.address?.neighbourhood,
      data.address?.quarter,
      data.address?.residential,
      data.address?.city_district,
      data.address?.district,
    ].filter(Boolean);

    const detectedName = (possibleNames[0] as string | undefined) || null;

    for (const name of possibleNames as string[]) {
      const match = findMatchingNeighborhood(selectedCountry, selectedCity, name);
      if (match) return { matchedNeighborhood: match, detectedName };
    }

    return { matchedNeighborhood: null as string | null, detectedName };
  };

  // Handle getting GPS location and try to match with known neighborhoods
  const handleGetLocation = useCallback(async (forCustomNeighborhood = false, forceNewReading = false, isAutoDetect = false) => {
    if (!navigator.geolocation) {
      if (!isAutoDetect) toast.error('O teu dispositivo não permite gerar o endereço AFROLOC automaticamente');
      return;
    }

    // For auto-detection, only proceed if permission already granted
    if (isAutoDetect) {
      try {
        if (navigator.permissions) {
          const perm = await navigator.permissions.query({ name: 'geolocation' });
          if (perm.state !== 'granted') {
            return; // Silently skip auto-detection
          }
        }
      } catch { return; }
    }

    // User explicitly clicked the GPS button — always request permission

    setIsGettingLocation(true);
    setGeoNeighborhoodNotFound(false);
    setDetectedNeighborhoodName(null);
    
    if (forceNewReading) {
      setGpsReadings([]);
      setCurrentReadingIndex(0);
      setLocationConfirmed(false);
    }
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const _cell = snapToGrid(position.coords.latitude, position.coords.longitude);
      const coords = {
        lat: _cell.lat,
        lng: _cell.lng,
      };
      setGeoLocation(coords);
      
      // Try to get neighborhood name from reverse geocoding
      if (selectedCountry && selectedCity) {
        try {
           // First, try to find neighborhood by coordinates (within search radius)
          let matchedNeighborhood: string | null = null;
          let detectedName: string | null = null;
          
          if (hasCityCoordinates(selectedCountry, selectedCity)) {
             // Debug: Log distances to all neighborhoods
             const allDistances = getDistancesToAllNeighborhoods(
               coords.lat,
               coords.lng,
               selectedCountry,
               selectedCity
             );
             console.log('📍 GPS Coordinates:', coords.lat, coords.lng);
             console.log('📏 Distances to all neighborhoods (sorted):');
             allDistances.slice(0, 10).forEach((n, i) => {
               console.log(`   ${i + 1}. ${n.name}: ${n.distance.toFixed(2)}km`);
             });
             
            const nearestResult = findNearestNeighborhood(
              coords.lat,
              coords.lng,
              selectedCountry,
              selectedCity,
                SEARCH_RADIUS_KM
            );
            
            if (nearestResult) {
              matchedNeighborhood = nearestResult.neighborhood;
               let distance = nearestResult.distance;
               setDetectedDistance(distance);
               console.log(`Found neighborhood within ${distance.toFixed(2)}km: ${matchedNeighborhood}`);

               // If far from center OR ambiguous between 2 closest options, try to prefer the name
               // coming from reverse-geocoding (when it matches our known neighborhoods).
               const top2 = allDistances.slice(0, 2);
               const isAmbiguous =
                 top2.length === 2 && Math.abs(top2[0].distance - top2[1].distance) <= AMBIGUITY_MARGIN_KM;
               const farFromCenter = distance > DISTANCE_LIMIT_KM;

               if (!forCustomNeighborhood && (farFromCenter || isAmbiguous)) {
                 try {
                   const geo = await reverseGeocodeAndMatchNeighborhood(coords.lat, coords.lng);
                   if (geo.matchedNeighborhood) {
                     const geoMatchDistance = allDistances.find(d => d.name === geo.matchedNeighborhood)?.distance;

                     if (
                       typeof geoMatchDistance === 'number' &&
                       geoMatchDistance <= SEARCH_RADIUS_KM &&
                       (Math.abs(geoMatchDistance - distance) <= AMBIGUITY_MARGIN_KM || farFromCenter)
                     ) {
                       console.log(
                         `[GPS Debug] Overriding by geocoding match: ${geo.matchedNeighborhood} (${geoMatchDistance.toFixed(
                           2
                         )}km) instead of ${matchedNeighborhood} (${distance.toFixed(2)}km)`
                       );
                       matchedNeighborhood = geo.matchedNeighborhood;
                       distance = geoMatchDistance;
                       setDetectedDistance(distance);
                     }
                   }
                 } catch (e) {
                   console.warn('[GPS Debug] Reverse geocoding check failed:', e);
                 }
               }
              
              // If distance exceeds limit, do additional readings
               if (distance > DISTANCE_LIMIT_KM && !forCustomNeighborhood) {
                 console.log(
                   `[GPS Debug] Distance ${distance.toFixed(2)}km > ${DISTANCE_LIMIT_KM}km. Starting ${ADDITIONAL_READINGS} additional readings...`
                 );
                
                const firstReading = {
                  lat: coords.lat,
                  lng: coords.lng,
                  neighborhood: matchedNeighborhood,
                  distance,
                  top5: allDistances.slice(0, 5)
                };
                
                setGpsReadings([firstReading]);
                await doAdditionalReadings(firstReading);
                return; // Exit early, doAdditionalReadings handles the rest
              } else {
                // Distance within limit, store single reading
                setGpsReadings([{
                  lat: coords.lat,
                  lng: coords.lng,
                  neighborhood: matchedNeighborhood,
                  distance,
                  top5: allDistances.slice(0, 5)
                }]);
              }
            }
          }
          
          // If no coordinate match, fallback to reverse geocoding name matching
          if (!matchedNeighborhood) {
             const geo = await reverseGeocodeAndMatchNeighborhood(coords.lat, coords.lng);
             detectedName = geo.detectedName;
             matchedNeighborhood = geo.matchedNeighborhood;
          }
          
          if (matchedNeighborhood && !forCustomNeighborhood) {
            // Auto-select the matched neighborhood
            setSelectedNeighborhood(matchedNeighborhood);
            setDetectedNeighborhoodName(matchedNeighborhood);
            setGeoNeighborhoodNotFound(false);
             setLocationConfirmed(false); // Require explicit confirmation
             toast.success(`Bairro detetado: ${matchedNeighborhood}. Confirma o teu endereço AFROLOC.`);
          } else {
            // No match found - auto-select "Outro" option
            setGeoNeighborhoodNotFound(true);
            setDetectedNeighborhoodName(detectedName);
            if (!forCustomNeighborhood) {
              // Auto-select "Outro" and pre-fill with detected name
              setSelectedNeighborhood('__other__');
            }
            if (detectedName) {
              setCustomNeighborhood(detectedName);
            }
            toast.success(detectedName 
              ? `Bairro "${detectedName}" não está na lista. Podes confirmar ou editar.`
              : 'Endereço AFROLOC gerado. Indica o nome do teu bairro.'
            );
          }
        } catch (geoError) {
          console.warn('Reverse geocoding failed:', geoError);
          // If reverse geocoding fails, still allow location validation for "Outro"
          if (forCustomNeighborhood) {
            toast.success('Endereço AFROLOC validado!');
          } else {
            setGeoNeighborhoodNotFound(true);
            setSelectedNeighborhood('__other__');
            toast.info('Endereço AFROLOC gerado. Seleciona o teu bairro manualmente.');
          }
        }
      } else {
        toast.success('Endereço AFROLOC gerado!');
      }
    } catch (error) {
      const code = (error as GeolocationPositionError | null)?.code;
      if (code === 1) {
        toast.error('Acesso negado. Ativa nas definições para gerar o teu endereço AFROLOC.');
      } else if (code === 2) {
        toast.error('Não foi possível gerar o teu endereço AFROLOC. Verifica a tua ligação.');
      } else {
        toast.error('Tempo esgotado ao gerar o teu endereço AFROLOC. Tenta novamente.');
      }
    } finally {
      setIsGettingLocation(false);
    }
  }, [selectedCountry, selectedCity]);

  // Function to do additional GPS readings
  const doAdditionalReadings = async (
    firstReading: {
      lat: number;
      lng: number;
      neighborhood: string;
      distance: number;
      top5: Array<{ name: string; distance: number }>;
    }
  ) => {
    setIsDoingMultipleReadings(true);
    const readings = [firstReading];
    
    for (let i = 0; i < ADDITIONAL_READINGS; i++) {
      setCurrentReadingIndex(i + 2);
      
      try {
        // Small delay between readings for better GPS accuracy
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        });
        
        const _cell = snapToGrid(position.coords.latitude, position.coords.longitude);
        const lat = _cell.lat;
        const lng = _cell.lng;

        // Get all distances for this reading
        const allDistances = getDistancesToAllNeighborhoods(lat, lng, selectedCountry, selectedCity);
        const top5 = allDistances.slice(0, 5);
        
        const nearestResult = findNearestNeighborhood(
          lat,
          lng,
          selectedCountry,
          selectedCity,
          SEARCH_RADIUS_KM
        );
        
        if (nearestResult) {
          readings.push({
            lat,
            lng,
            neighborhood: nearestResult.neighborhood,
            distance: nearestResult.distance,
            top5
          });
          
          console.log(`[GPS Debug] Reading ${i + 2}:`);
          top5.forEach((n, idx) => {
            console.log(`   ${idx + 1}. ${n.name}: ${n.distance.toFixed(2)}km`);
          });
        }
      } catch (error) {
        console.log(`[GPS Debug] Reading ${i + 2} failed:`, error);
      }
    }
    
    // Find the best reading (smallest distance)
    const bestReading = readings.reduce((best, current) => 
      current.distance < best.distance ? current : best
    );
    
    console.log(`[GPS Debug] Best reading: ${bestReading.neighborhood} at ${bestReading.distance.toFixed(2)}km`);
    
    setGpsReadings(readings);
    setSelectedNeighborhood(bestReading.neighborhood);
    setDetectedNeighborhoodName(bestReading.neighborhood);
    setDetectedDistance(bestReading.distance);
    setGeoLocation({ 
      lat: bestReading.lat, 
      lng: bestReading.lng
    });
    setIsDoingMultipleReadings(false);
    setIsGettingLocation(false);
    setLocationConfirmed(false);
    
    toast.success(`Bairro detetado: ${bestReading.neighborhood}. Confirma o teu endereço AFROLOC.`);
  };

  // Auto-trigger GPS detection when city is selected
  useEffect(() => {
    if (selectedCity && !autoDetectionTriggered && !selectedNeighborhood) {
      setAutoDetectionTriggered(true);
      handleGetLocation(false, false, true); // auto-detect: silent if no permission
    }
  }, [selectedCity, autoDetectionTriggered, selectedNeighborhood, handleGetLocation]);

  // Reset auto-detection flag when city changes
  useEffect(() => {
    setAutoDetectionTriggered(false);
    setGeoNeighborhoodNotFound(false);
    setGeoLocation(null);
    setDetectedNeighborhoodName(null);
     setLocationConfirmed(false);
     setDetectedDistance(null);
     setGpsReadings([]);
     setIsDoingMultipleReadings(false);
     setCurrentReadingIndex(0);
  }, [selectedCity]);

   // Reset confirmation when neighborhood changes manually
   useEffect(() => {
     setLocationConfirmed(false);
   }, [selectedNeighborhood]);

   const handleConfirmLocation = () => {
     if (geoLocation && selectedNeighborhood && selectedNeighborhood !== '__other__') {
       setLocationConfirmed(true);
       toast.success('Endereço AFROLOC confirmado!');
     }
   };

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
  const months = [
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];

  // Get cities and neighborhoods based on selection
  const selectedCountryData = AFRICAN_LOCATIONS.find(loc => loc.countryCode === selectedCountry);
  const availableCities = selectedCountryData?.cities || [];
  const selectedCityData = availableCities.find(city => city.name === selectedCity);
  const availableNeighborhoods = selectedCityData?.neighborhoods || [];

  const handleBandaSave = () => {
    if (selectedCity) {
      if (selectedNeighborhood === '__other__') {
        if (!geoLocation) {
          toast.error('Gera o teu endereço AFROLOC para continuar');
          return;
        }
      }
    }
    nextStep();
  };

  // Get personalized greeting based on gender
  const getGreeting = () => {
    if (selectedGender === 'female') {
      return 'Bem-vinda';
    }
    return 'Bem-vindo';
  };

  // Store avatar file locally (upload after registration)
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarFile(file);
    // Create local preview URL
    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);
    toast.success('Foto selecionada!');
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
      // Reset GPS state when leaving the 'banda' step
      const currentStepId = steps[currentStep].id;
      if (currentStepId === 'banda') {
        setGeoLocation(null);
        setGpsReadings([]);
        setLocationConfirmed(false);
        setDetectedDistance(null);
        setAutoDetectionTriggered(false);
        setGeoNeighborhoodNotFound(false);
        setDetectedNeighborhoodName(null);
        setIsDoingMultipleReadings(false);
        setCurrentReadingIndex(0);
      }
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
      .from('profiles')
      .select('username')
      .eq('username', usernameVal.toLowerCase())
      .single();
    setUsernameAvailable(!data);
    setIsCheckingUsername(false);
  };

  // Password validation
  const passwordRequirements = [
    { regex: /.{8,}/, label: 'Mínimo 8 caracteres' },
    { regex: /[A-Z]/, label: 'Uma letra maiúscula' },
    { regex: /[a-z]/, label: 'Uma letra minúscula' },
    { regex: /[0-9]/, label: 'Um número' },
  ];

  const isPasswordValid = passwordRequirements.every(req => req.regex.test(password));
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isRegisterFormValid = displayName.length >= 2 && username.length >= 3 && isEmailValid && isPasswordValid && usernameAvailable !== false;

  // Final registration: create account + save all onboarding data
  const handleRegister = async () => {
    if (!isRegisterFormValid) return;

    const code = accessCode.trim().toUpperCase();
    if (!code) {
      toast.error('Introduz o código de convite de um membro para concluir o registo.');
      return;
    }
    setIsRegistering(true);
    try {
      const { data: validation, error: validationError } = await supabase.rpc('validate_mvp_access_code', { p_code: code });
      const result = validation as { valid?: boolean; error?: string } | null;
      if (validationError || !result?.valid) {
        toast.error(validationError ? 'Não foi possível validar o convite. Tenta novamente.' : result?.error || 'Código de convite inválido.');
        return;
      }
      const { error } = await signUp(email, password, {
        display_name: displayName,
        username: username.toLowerCase(),
        access_code: code,
      });

      if (error) {
        toast.error(error.message);
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
        toast.error('Conta criada! Verifica o teu email para confirmar.');
        setIsRegistering(false);
        navigate('/login');
        return;
      }

      const userId = session.user.id;

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

      // Persist the captured GPS so the AFROLOC code can be generated from the
      // real location (the DB trigger encodes it into CC-ZU-G10-X-Y). Without
      // coordinates the code stays null — declared city/banda is not enough.
      if (geoLocation) {
        profileUpdate.latitude = geoLocation.lat;
        profileUpdate.longitude = geoLocation.lng;
      }

      if (finalAvatarUrl) {
        profileUpdate.avatar_url = finalAvatarUrl;
      }

      if (bio.trim()) {
        profileUpdate.bio = bio.trim();
      }

      // Save all onboarding data at once
      const { error: updateError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId);

      if (updateError) {
        logger.error('Error saving onboarding profile', 'onboarding', updateError);
        toast.error('Erro ao guardar perfil. Tenta novamente.');
        setIsRegistering(false);
        return;
      }

      // Phase 0: turn the chosen neighborhood into a real banda membership
      // (find-or-create the banda + activate it in user_bandas).
      const bandaName = selectedNeighborhood === '__other__'
        ? customNeighborhood.trim()
        : selectedNeighborhood;
      if (bandaName && selectedCity) {
        const { error: bandaErr } = await supabase.rpc('join_banda_by_location', {
          p_name: bandaName,
          p_city: selectedCity,
          p_country: selectedCountry || 'Angola',
        });
        if (bandaErr) logger.error('Error assigning banda', 'onboarding', bandaErr);
      }

      justCompletedRef.current = true;

      // Refresh AuthContext profile so ProtectedRoute sees onboarding_completed=true
      await refreshProfile();

      triggerCelebrationConfetti();
      toast.success('Bem-vindo à Banda! 🎉');
      navigate('/profile', { replace: true });
    } catch (error) {
      toast.error('Erro ao criar conta. Tenta novamente.');
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
                alt="Identidade" 
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
              <h2 className="text-2xl font-bold mb-2 text-foreground">
                Como te identificas?
              </h2>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm">
                Na banda, todos são bem-vindos. Isto personaliza a tua experiência.
              </p>
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
                <span>Masculino</span>
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
                <span>Feminino</span>
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
                <span>Prefiro não dizer</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-6">
              * Campo obrigatório
            </p>
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
                alt="Aniversário" 
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
              <h2 className="text-2xl font-bold mb-2 text-foreground">
                Quando nasceste?
              </h2>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm">
                A banda quer celebrar contigo!
              </p>
            </motion.div>
            
            <div className="flex gap-2 max-w-xs mx-auto mb-6">
              <Select value={birthDay} onValueChange={setBirthDay}>
                <SelectTrigger className="flex-1 h-14 rounded-2xl border-2 text-base">
                  <SelectValue placeholder="Dia" />
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
                  <SelectValue placeholder="Mês" />
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
                  <SelectValue placeholder="Ano" />
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
                <ChevronLeft className="w-5 h-5 mr-2" />
                Voltar
              </Button>
              <Button
                onClick={handleBirthdaySave}
                disabled={!birthDay || !birthMonth || !birthYear}
                className="h-14 px-8 rounded-2xl bg-gradient-primary hover:opacity-90 text-white font-semibold shadow-lg shadow-primary/30"
              >
                Continuar
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-6 text-center">
              * Campo obrigatório
            </p>
          </motion.div>
        );

      case 'banda':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center"
          >
            <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-djembe to-djembe-glow flex items-center justify-center shadow-glow mb-6">
              <MapPin className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Qual é a tua Banda?</h2>
            <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
              Conecta-te com pessoas da tua zona e comunidade.
            </p>
            
            <div className="flex flex-col gap-3 max-w-xs mx-auto mb-6">
              <Select value={selectedCountry} onValueChange={(val) => {
                setSelectedCountry(val);
                setSelectedCity('');
                setSelectedNeighborhood('');
              }}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="País" />
                </SelectTrigger>
                <SelectContent>
                  {AFRICAN_LOCATIONS.map((loc) => (
                    <SelectItem key={loc.countryCode} value={loc.countryCode}>
                      {loc.country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedCity} onValueChange={(val) => {
                setSelectedCity(val);
                setSelectedNeighborhood('');
                setCustomNeighborhood('');
              }}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Cidade" />
                </SelectTrigger>
                <SelectContent>
                  {availableCities.map((city) => (
                    <SelectItem key={city.name} value={city.name}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {(availableNeighborhoods.length > 0 || selectedCity) && (
                <>
                  {/* Show loading state while detecting */}
                  {isGettingLocation && !selectedNeighborhood && (
                    <div className="h-12 rounded-xl border border-border flex items-center justify-center gap-2 text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      A detectar o teu bairro...
                    </div>
                  )}
                  
                  {/* Show neighborhood selector after detection or if manually needed */}
                  {(!isGettingLocation || selectedNeighborhood) && (
                    <Select value={selectedNeighborhood} onValueChange={(val) => {
                      setSelectedNeighborhood(val);
                      if (val !== '__other__') {
                        setCustomNeighborhood('');
                      }
                    }}>
                      <SelectTrigger className={`h-12 rounded-xl ${selectedNeighborhood && selectedNeighborhood !== '__other__' ? 'border-green-500' : ''}`}>
                        <SelectValue placeholder="Bairro" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableNeighborhoods.map((neighborhood) => (
                          <SelectItem key={neighborhood} value={neighborhood}>
                            {neighborhood}
                          </SelectItem>
                        ))}
                        {/* Only show "Outro" option if GPS detected a location not in our list */}
                        {geoNeighborhoodNotFound && (
                          <SelectItem value="__other__" className="text-primary font-medium">
                            Outro (especificar)
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {/* Show detected neighborhood confirmation */}
                   {selectedNeighborhood && selectedNeighborhood !== '__other__' && (
                     <div className="space-y-3 p-4 rounded-xl bg-secondary/30 border border-border">
                       {!geoLocation ? (
                         <>
                           <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                             <MapPin className="w-4 h-4" />
                             <span>Confirma o teu endereço AFROLOC para continuar</span>
                           </div>
                           <Button
                             type="button"
                             onClick={() => handleGetLocation(false)}
                             disabled={isGettingLocation}
                             className="w-full h-12 rounded-xl bg-gradient-primary hover:opacity-90 text-white"
                           >
                             {isGettingLocation ? (
                               <>
                                 <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                 A gerar o teu endereço AFROLOC...
                               </>
                             ) : (
                               <>
                                 <MapPin className="w-4 h-4 mr-2" />
                                 Gerar o meu endereço AFROLOC
                               </>
                             )}
                           </Button>
                         </>
                       ) : (
                         <>
                       <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                         <MapPin className="w-4 h-4" />
                         <span>
                           Endereço AFROLOC gerado em <strong>{selectedNeighborhood}</strong>
                         </span>
                       </div>
                       
                       {!locationConfirmed ? (
                         <Button
                           type="button"
                           onClick={handleConfirmLocation}
                           className="w-full h-12 rounded-xl bg-gradient-primary hover:opacity-90 text-white"
                         >
                           ✓ Confirmar este endereço AFROLOC
                         </Button>
                       ) : (
                         <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
                           <MapPin className="w-4 h-4" />
                           Endereço AFROLOC confirmado ✓
                         </div>
                       )}
                         
                         {/* Button to re-read GPS location */}
                        {isDoingMultipleReadings ? (
                          <div className="w-full p-3 bg-muted/50 rounded-xl">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              <span>Leitura {currentReadingIndex} de {ADDITIONAL_READINGS + 1}...</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              A refinar o endereço AFROLOC para maior precisão
                            </p>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleGetLocation(false, true)}
                            disabled={isGettingLocation}
                            className="w-full h-10 rounded-xl text-sm"
                          >
                            {isGettingLocation ? (
                              <>
                                <div className="w-3 h-3 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                A gerar...
                              </>
                            ) : (
                              <>
                                <MapPin className="w-3 h-3 mr-2" />
                                Gerar de novo
                              </>
                            )}
                          </Button>
                        )}
                        
                        {/* Show readings summary if multiple readings were done */}
                        {gpsReadings.length >= 1 && !isDoingMultipleReadings && (
                          <div className="w-full p-3 bg-muted/30 rounded-lg space-y-3">
                            <p className="text-xs text-muted-foreground mb-1">
                              {gpsReadings.length} leitura{gpsReadings.length > 1 ? 's' : ''} realizada{gpsReadings.length > 1 ? 's' : ''}:
                            </p>
                            {gpsReadings.map((reading, idx) => (
                              <div key={idx} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                <p className="text-xs font-medium text-foreground mb-1">
                                  Leitura {idx + 1}:
                                </p>
                                <div className="grid grid-cols-1 gap-0.5">
                                  {reading.top5.map((hood, hIdx) => (
                                    <div
                                      key={hIdx}
                                      className={`text-xs px-2 py-1 rounded flex justify-between ${
                                        hood.name === selectedNeighborhood
                                          ? 'bg-primary/20 text-primary font-medium'
                                          : 'text-muted-foreground'
                                      }`}
                                    >
                                      <span>{hIdx + 1}. {hood.name}</span>
                                      <span>{hood.distance.toFixed(2)}km</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                         </>
                       )}
                    </div>
                  )}
                </>
              )}

              {/* Custom neighborhood input with GPS validation */}
              {selectedNeighborhood === '__other__' && (
                <div className="space-y-3 p-4 rounded-xl bg-secondary/30 border border-border">
                  <Input
                    value={customNeighborhood}
                    onChange={(e) => setCustomNeighborhood(e.target.value)}
                    placeholder="Nome do teu bairro"
                    className="h-12 rounded-xl"
                  />
                  
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant={geoLocation ? "outline" : "default"}
                      onClick={() => handleGetLocation(true)}
                      disabled={isGettingLocation}
                      className={`flex-1 h-12 rounded-xl ${geoLocation ? 'border-green-500 text-green-600' : ''}`}
                    >
                      {isGettingLocation ? (
                        <>
                          <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          A obter...
                        </>
                      ) : geoLocation ? (
                        <>
                          <MapPin className="w-4 h-4 mr-2" />
                          Endereço AFROLOC validado ✓
                        </>
                      ) : (
                        <>
                          <MapPin className="w-4 h-4 mr-2" />
                          Gerar o meu endereço AFROLOC
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {!geoLocation && (
                    <p className="text-xs text-muted-foreground text-center">
                      É necessário gerar o teu endereço AFROLOC para usar um bairro personalizado
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={prevStep}
                className="h-12 px-6 rounded-xl"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                Voltar
              </Button>
              <Button
                onClick={handleBandaSave}
                  disabled={!selectedCity || !selectedNeighborhood || !geoLocation || !locationConfirmed || (selectedNeighborhood === '__other__' && !customNeighborhood.trim())}
                className="h-12 px-6 rounded-xl bg-gradient-primary hover:opacity-90 text-white"
              >
                Continuar
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <p className="text-xs text-destructive/70 mt-4 text-center">
               * País, cidade, bairro e confirmação do endereço AFROLOC são obrigatórios
            </p>
          </motion.div>
        );

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
                alt="Bem-vindo à Banda" 
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
                <span className="text-gradient-primary">{getGreeting()}</span>, {profile?.display_name || 'Kamba'}!
              </h2>
              <p className="text-lg text-muted-foreground mb-2">
                Já fazes parte da banda.
              </p>
              <p className="text-sm text-muted-foreground/80 mb-6 max-w-sm mx-auto">
                Vamos preparar o teu perfil para que os teus {t('social.friends')} te encontrem.
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
                alt="Comunidade" 
                className="w-full h-32 object-cover"
              />
            </motion.div>

            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={prevStep}
                className="h-14 px-6 rounded-2xl border-2"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                Voltar
              </Button>
              <Button
                onClick={nextStep}
                className="h-14 px-8 rounded-2xl bg-gradient-primary hover:opacity-90 text-white font-semibold shadow-lg shadow-primary/30"
              >
                Bora lá!
                <ChevronRight className="w-5 h-5 ml-2" />
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
                alt="Foto de perfil" 
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
              <h2 className="text-2xl font-bold mb-2 text-foreground">
                Mostra a tua cara
              </h2>
              <p className="text-muted-foreground mb-6 text-sm">
                Os teus {t('social.friends')} querem reconhecer-te na banda
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
                <RefreshCw className="w-4 h-4 animate-spin" />
                A carregar foto...
              </motion.div>
            )}

            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={prevStep}
                className="h-14 px-6 rounded-2xl border-2"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                Voltar
              </Button>
              <Button
                onClick={nextStep}
                disabled={!avatarUrl}
                className="h-14 px-8 rounded-2xl bg-gradient-primary hover:opacity-90 text-white font-semibold shadow-lg shadow-primary/30"
              >
                Continuar
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-6 text-center">
              * Campo obrigatório
            </p>
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
                alt="A tua história" 
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
              <h2 className="text-2xl font-bold mb-2 text-foreground">
                Conta a tua história
              </h2>
              <p className="text-muted-foreground mb-6 text-sm">
                O que te faz único? Os {t('social.friends')} querem conhecer-te.
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
                placeholder="Adoro kuduro, matabicho e boas conversas na banda..."
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
                <ChevronLeft className="w-5 h-5 mr-2" />
                Voltar
              </Button>
              <Button
                onClick={handleBioSave}
                className="h-14 px-8 rounded-2xl bg-gradient-primary hover:opacity-90 text-white font-semibold shadow-lg shadow-primary/30"
              >
                {bio.trim() ? 'Continuar' : 'Saltar'}
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-6 text-center">
              Este campo é opcional
            </p>
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
                        {tourSlide + 1} de {localizedTourSlides.length}
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
                  <ChevronLeft className="w-5 h-5 mr-2" />
                  Voltar
                </Button>
                <Button
                  onClick={() => setTourSlide(tourSlide + 1)}
                  className="h-14 px-8 rounded-2xl bg-gradient-primary hover:opacity-90 text-white font-semibold shadow-lg shadow-primary/30"
                >
                  Próximo
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-3 justify-center">
                <Button
                  variant="ghost"
                  onClick={() => setTourSlide(tourSlide - 1)}
                  className="h-14 px-6 rounded-2xl"
                >
                  <ChevronLeft className="w-5 h-5 mr-2" />
                  Voltar
                </Button>
                <Button
                  onClick={nextStep}
                  className="h-14 px-8 rounded-2xl bg-gradient-to-r from-ubuntu to-djembe hover:opacity-90 text-white font-semibold shadow-xl shadow-ubuntu/40"
                >
                  Continuar
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            )}
          </motion.div>
        );

      case 'register':
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
              <h2 className="text-2xl font-bold mb-2 text-foreground">
                Cria a tua conta
              </h2>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Último passo! Regista-te para entrar na banda.
              </p>
            </motion.div>

            <div className="space-y-4 max-w-xs mx-auto">
              <div>
                <label htmlFor="onboarding-invite" className="text-sm font-medium text-foreground mb-1.5 block">Código de convite</label>
                <Input
                  id="onboarding-invite"
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
                  placeholder="Código de um membro ou de acesso MVP"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-describedby="onboarding-invite-help"
                />
                <p id="onboarding-invite-help" className="text-xs text-muted-foreground mt-2">
                  A inscrição é por convite. Se abriste um link de convite, o código aparece aqui. Caso contrário, pede o código ao membro que te convidou.
                </p>
              </div>
              {/* Display Name */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="O teu nome"
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
                <label className="text-sm font-medium text-foreground mb-1.5 block">Username</label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      checkUsernameAvailability(e.target.value);
                    }}
                    placeholder="o_teu_username"
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
                  <p className="text-sm text-destructive mt-1">Username já está em uso</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
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
                <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
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
                <ChevronLeft className="w-5 h-5 mr-2" />
                Voltar
              </Button>
              <Button
                onClick={handleRegister}
                disabled={!isRegisterFormValid || !accessCode.trim() || isRegistering}
                className="h-14 px-8 rounded-2xl bg-gradient-to-r from-ubuntu to-djembe hover:opacity-90 text-white font-semibold shadow-xl shadow-ubuntu/40"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    A criar conta...
                  </>
                ) : (
                  <>
                    Entrar na Banda
                    <Sparkles className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Ao criar conta, aceitas os{' '}
              <Link to="/terms" className="underline hover:text-foreground">Termos de Serviço</Link>{' '}
              e a{' '}
              <Link to="/privacy" className="underline hover:text-foreground">Política de Privacidade</Link>
            </p>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Já tens conta?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Entrar
              </Link>
            </p>
          </motion.div>
        );

      default:
        return null;
    }
  };

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
          className="absolute left-3 top-8 rounded-full"
          onClick={() => currentStep === 0 ? navigate('/welcome') : prevStep()}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="bg-background">
          <YamilookLogo size="md" showTagline={false} animate={false} />
        </div>
        <p className="mt-2 text-sm font-medium text-primary/80 tracking-wide">
          O mambo começa na banda.
        </p>
        <div className="mt-3 px-4 py-1.5 rounded-full bg-secondary/50 text-xs font-medium text-muted-foreground">
          Passo {currentStep + 1} de {steps.length}
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
