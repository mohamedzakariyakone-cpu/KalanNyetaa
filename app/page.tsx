"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { offlineFetch } from '@/utils/offlineApi';
import { ROLES_CONFIG, RoleType, ROLES } from './config/roles';
import {
  ShieldCheck,
  Landmark,
  GraduationCap,
  FolderLock,
  Lock,
  X,
  Loader2,
  Delete,
  ArrowRight,
} from 'lucide-react';

export default function RoleSelectionPage() {
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [schoolName, setSchoolName] = useState<string>('');
  const [fetchingSchool, setFetchingSchool] = useState<boolean>(true);

  // États du carrousel tactile mobile
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const hasSwipedRef = useRef<boolean>(false);

  const router = useRouter();
  const roleKeys = Object.keys(ROLES_CONFIG) as RoleType[];

  const getSchoolNameCacheKey = (userId?: string) =>
    userId ? `school_name:user:${userId}` : 'school_name:global';

  const readCachedSchoolName = (userId?: string) => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(getSchoolNameCacheKey(userId));
  };

  const persistSchoolNameCache = (userId: string | null, name: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getSchoolNameCacheKey(userId || undefined), name);
  };

  // Récupération du nom de l'école liée à l'utilisateur connecté
  useEffect(() => {
    let isMounted = true;

    async function fetchSchoolName(userId?: string) {
      if (!isMounted) return;
      setFetchingSchool(true);

      try {
        let schoolId: number | null = null;

        if (userId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('school_id')
            .eq('id', userId)
            .maybeSingle();

          schoolId = profile?.school_id ?? null;
        }

        const cacheKey = getSchoolNameCacheKey(userId);
        const cachedName = readCachedSchoolName(userId);
        if (cachedName) {
          setSchoolName(cachedName);
        }

        const { data } = await offlineFetch<{ school_name?: string; name?: string } | null>(
          cacheKey,
          async () => {
            if (schoolId) {
              const { data: schoolSettings } = await supabase
                .from('school_settings')
                .select('school_name')
                .eq('school_id', schoolId)
                .maybeSingle();

              if (schoolSettings?.school_name) {
                return { data: { school_name: schoolSettings.school_name }, error: null };
              }

              return await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle();
            }

            const { data: schoolSettings } = await supabase
              .from('school_settings')
              .select('school_name')
              .limit(1)
              .single();

            if (schoolSettings?.school_name) {
              return { data: { school_name: schoolSettings.school_name }, error: null };
            }

            return await supabase.from('schools').select('name').limit(1).single();
          },
          { forceRefresh: true }
        );

        const displayName = data?.school_name ?? data?.name;
        const finalName = displayName?.trim() || 'KalanNyetaa';

        if (isMounted) {
          setSchoolName(finalName);
          persistSchoolNameCache(userId || null, finalName);
        }
      } catch {
        if (isMounted) {
          const fallbackName = readCachedSchoolName(userId) || 'KalanNyetaa';
          setSchoolName(fallbackName);
        }
      } finally {
        if (isMounted) {
          setFetchingSchool(false);
        }
      }
    }

    async function initSchoolName() {
      const { data: { user } } = await supabase.auth.getUser();
      await fetchSchoolName(user?.id);
    }

    initSchoolName();

    const { data: authListener } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED' ||
        event === 'SIGNED_OUT'
      ) {
        fetchSchoolName(session?.user?.id);
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  const getRoleVisuals = (role: RoleType) => {
    switch (role) {
      case ROLES.PROMOTEUR:
        return {
          icon: <ShieldCheck className="w-10 h-10 md:w-11 md:h-11 text-indigo-600" strokeWidth={1.75} />,
          smallIcon: <ShieldCheck className="w-5 h-5 text-indigo-600" strokeWidth={2} />,
          ringColor: 'border-slate-200 group-hover:border-indigo-400',
          iconBg: 'bg-indigo-50 text-indigo-600',
          dotActive: 'bg-indigo-600',
          accentText: 'text-indigo-600',
        };
      case ROLES.COMPTABLE:
        return {
          icon: <Landmark className="w-10 h-10 md:w-11 md:h-11 text-emerald-600" strokeWidth={1.75} />,
          smallIcon: <Landmark className="w-5 h-5 text-emerald-600" strokeWidth={2} />,
          ringColor: 'border-slate-200 group-hover:border-emerald-400',
          iconBg: 'bg-emerald-50 text-emerald-600',
          dotActive: 'bg-emerald-600',
          accentText: 'text-emerald-600',
        };
      case ROLES.DIRECTEUR:
        return {
          icon: <GraduationCap className="w-10 h-10 md:w-11 md:h-11 text-blue-600" strokeWidth={1.75} />,
          smallIcon: <GraduationCap className="w-5 h-5 text-blue-600" strokeWidth={2} />,
          ringColor: 'border-slate-200 group-hover:border-blue-400',
          iconBg: 'bg-blue-50 text-blue-600',
          dotActive: 'bg-blue-600',
          accentText: 'text-blue-600',
        };
      case ROLES.CAISSIER:
        return {
          icon: <FolderLock className="w-10 h-10 md:w-11 md:h-11 text-amber-600" strokeWidth={1.75} />,
          smallIcon: <FolderLock className="w-5 h-5 text-amber-600" strokeWidth={2} />,
          ringColor: 'border-slate-200 group-hover:border-amber-400',
          iconBg: 'bg-amber-50 text-amber-600',
          dotActive: 'bg-amber-600',
          accentText: 'text-amber-600',
        };
    }
  };

  const saveRoleSession = (role: RoleType) => {
    localStorage.setItem('userRole', role);
    document.cookie = `userRole=${role}; path=/; max-age=86400; SameSite=Lax`;
  };

  const handleRoleSelect = (role: RoleType) => {
    if (hasSwipedRef.current) return;
    setError('');
    setPin('');
    const config = ROLES_CONFIG[role];
    if (config.pin === null) {
      saveRoleSession(role);
      router.push('/dashboard');
    } else {
      setSelectedRole(role);
    }
  };

  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedRole || !pin || isVerifying) return;

    setError('');
    setIsVerifying(true);

    try {
      const config = ROLES_CONFIG[selectedRole];
      await new Promise((resolve) => setTimeout(resolve, 450));

      if (pin === config.pin) {
        saveRoleSession(selectedRole);
        router.push('/dashboard');
      } else {
        setError('Code incorrect');
        setPin('');
        setIsVerifying(false);
      }
    } catch {
      setError('Erreur de vérification');
      setIsVerifying(false);
    }
  };

  // Gestion tactile du swipe mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    hasSwipedRef.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartXRef.current;
    const diffY = currentY - touchStartYRef.current;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 6) {
      hasSwipedRef.current = true;
      const isAtStart = activeIndex === 0 && diffX > 0;
      const isAtEnd = activeIndex === roleKeys.length - 1 && diffX < 0;
      setDragOffset(isAtStart || isAtEnd ? diffX * 0.28 : diffX);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null) return;
    const threshold = 55;

    if (dragOffset < -threshold && activeIndex < roleKeys.length - 1) {
      setActiveIndex((prev) => prev + 1);
    } else if (dragOffset > threshold && activeIndex > 0) {
      setActiveIndex((prev) => prev - 1);
    }

    setDragOffset(0);
    setIsDragging(false);
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    setTimeout(() => {
      hasSwipedRef.current = false;
    }, 60);
  };

  // Clavier virtuel PIN
  const handleKeyPress = (num: string) => {
    if (isVerifying) return;
    setError('');
    if (pin.length < 6) {
      setPin((prev) => prev + num);
    }
  };

  const handleDelete = () => {
    if (isVerifying) return;
    setError('');
    setPin((prev) => prev.slice(0, -1));
  };

  // Clavier physique PC
  useEffect(() => {
    const handlePhysicalKeyDown = (e: KeyboardEvent) => {
      if (!selectedRole) {
        if (e.key === 'ArrowRight') {
          setActiveIndex((prev) => Math.min(roleKeys.length - 1, prev + 1));
        } else if (e.key === 'ArrowLeft') {
          setActiveIndex((prev) => Math.max(0, prev - 1));
        }
        return;
      }

      if (isVerifying) return;

      if (/[0-9]/.test(e.key) && pin.length < 6) {
        setError('');
        setPin((prev) => prev + e.key);
      } else if (e.key === 'Backspace') {
        setError('');
        setPin((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter' && pin.length > 0) {
        handleVerifyPin();
      } else if (e.key === 'Escape') {
        setSelectedRole(null);
      }
    };

    window.addEventListener('keydown', handlePhysicalKeyDown);
    return () => window.removeEventListener('keydown', handlePhysicalKeyDown);
  }, [pin, selectedRole, isVerifying, roleKeys.length]);

  const activeMobileRole = roleKeys[activeIndex];
  const activeMobileVisuals = activeMobileRole ? getRoleVisuals(activeMobileRole) : null;

  return (
    <div
      id="role-selection-page"
      className="w-full min-h-dvh bg-[#F8FAFC] flex flex-col justify-between overflow-x-hidden select-none font-sans antialiased"
    >
      {/* 1. EN-TÊTE : NOM DE L'ÉCOLE + MESSAGE DE BIENVENUE */}
      <header className="w-full max-w-4xl mx-auto px-6 pt-10 md:pt-14 text-center">
        {fetchingSchool && !schoolName ? (
          <div className="flex items-center justify-center h-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight uppercase">
              {schoolName || 'KalanNyetaa'}
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              Bienvenue, sélectionnez votre profil pour accéder à votre espace.
            </p>
          </div>
        )}
      </header>

      {/* 2. ZONE DES PROFILS */}
      <main className="w-full flex-1 flex flex-col items-center justify-center py-4">
        
        {/* === VERSION MOBILE : UN SEUL GRAND CERCLE + SWIPE FLUIDE === */}
        <div
          className="md:hidden w-full flex flex-col items-center justify-center touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* py-10 garantit que l'ombre légère ne soit jamais coupée par overflow-hidden */}
          <div className="w-full overflow-hidden py-10">
            <div
              className="flex w-full will-change-transform"
              style={{
                transform: `translate3d(calc(-${activeIndex * 100}% + ${dragOffset}px), 0, 0)`,
                transition: isDragging
                  ? 'none'
                  : 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {roleKeys.map((roleKey, idx) => {
                const roleInfo = ROLES_CONFIG[roleKey];
                const visuals = getRoleVisuals(roleKey);
                const isCurrent = idx === activeIndex;

                return (
                  <div
                    key={roleKey}
                    className="w-full shrink-0 flex flex-col items-center justify-center px-6"
                  >
                    <button
                      type="button"
                      onClick={() => handleRoleSelect(roleKey)}
                      className={`w-[260px] h-[260px] sm:w-[280px] sm:h-[280px] rounded-full bg-white border border-slate-200/90 shadow-[0_6px_20px_rgba(15,23,42,0.05)] flex flex-col items-center justify-center p-7 text-center relative transition-all duration-300 active:scale-95 ${
                        isCurrent ? 'scale-100 opacity-100' : 'scale-92 opacity-50'
                      }`}
                    >
                      {/* Anneau fin interne */}
                      <div className="absolute inset-3 rounded-full border border-slate-100 pointer-events-none" />

                      {/* Cadenas discret en haut du cercle si PIN */}
                      {roleInfo.pin && (
                        <div className="absolute top-6 w-7 h-7 rounded-full bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400">
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                      )}

                      {/* Icône du rôle */}
                      <div
                        className={`w-18 h-18 rounded-full ${visuals.iconBg} flex items-center justify-center mb-4`}
                      >
                        {visuals.icon}
                      </div>

                      {/* Intitulé du rôle */}
                      <h2 className="text-lg font-black text-slate-900 tracking-tight">
                        {roleInfo.label}
                      </h2>

                      {/* Flèche d'entrée */}
                      <div className={`mt-3 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center ${visuals.accentText}`}>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Indicateurs de pagination bien séparés du cercle */}
          <div className="flex items-center justify-center gap-2.5 pt-1 pb-2">
            {roleKeys.map((roleKey, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={roleKey}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  aria-label={ROLES_CONFIG[roleKey].label}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    isSelected
                      ? `w-7 ${activeMobileVisuals?.dotActive || 'bg-slate-900'}`
                      : 'w-2 bg-slate-300'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* === VERSION PC : GRILLE 2x2 DE GRANDS CERCLES === */}
        <div className="hidden md:grid md:grid-cols-2 gap-10 lg:gap-14 max-w-2xl mx-auto place-items-center px-6 py-4">
          {roleKeys.map((roleKey) => {
            const roleInfo = ROLES_CONFIG[roleKey];
            const visuals = getRoleVisuals(roleKey);

            return (
              <button
                key={roleKey}
                type="button"
                onClick={() => handleRoleSelect(roleKey)}
                className={`w-64 h-64 lg:w-72 lg:h-72 rounded-full bg-white border ${visuals.ringColor} shadow-[0_4px_18px_rgba(15,23,42,0.04)] hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 flex flex-col items-center justify-center p-8 text-center relative group cursor-pointer`}
              >
                {/* Anneau fin interne */}
                <div className="absolute inset-3.5 rounded-full border border-slate-100 group-hover:border-slate-200/70 transition-colors pointer-events-none" />

                {/* Indicateur PIN */}
                {roleInfo.pin && (
                  <div className="absolute top-6 w-7 h-7 rounded-full bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 group-hover:text-slate-700 transition-colors">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                )}

                {/* Icône */}
                <div
                  className={`w-20 h-20 rounded-full ${visuals.iconBg} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200`}
                >
                  {visuals.icon}
                </div>

                {/* Nom du rôle */}
                <h2 className="text-lg lg:text-xl font-black text-slate-900 tracking-tight">
                  {roleInfo.label}
                </h2>
              </button>
            );
          })}
        </div>

      </main>

      {/* 3. PIED DE PAGE MINIMAL */}
      <footer className="w-full pb-6 text-center text-[11px] font-semibold text-slate-400">
        © {new Date().getFullYear()} {schoolName || 'KalanNyetaa'}
      </footer>

      {/* 4. ÉCRAN PIN PLEIN ÉCRAN IMMERSIF */}
      {selectedRole && (
        <div className="fixed inset-0 z-50 w-screen h-dvh bg-white flex flex-col justify-between px-6 py-6 sm:py-10 overflow-hidden">
          
          {/* Barre supérieure : Profil actif & bouton fermer */}
          <div className="w-full max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-full ${getRoleVisuals(selectedRole).iconBg} flex items-center justify-center`}
              >
                {getRoleVisuals(selectedRole).smallIcon}
              </div>
              <span className="font-black text-slate-900 text-lg tracking-tight">
                {ROLES_CONFIG[selectedRole].label}
              </span>
            </div>

            <button
              type="button"
              onClick={() => !isVerifying && setSelectedRole(null)}
              disabled={isVerifying}
              aria-label="Fermer"
              className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center active:scale-90 transition disabled:opacity-30 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Centre : Indicateurs visuels PIN + Pavé numérique tactile */}
          <form
            onSubmit={handleVerifyPin}
            className="w-full max-w-xs mx-auto flex-1 flex flex-col items-center justify-center gap-8 sm:gap-10"
          >
            {/* Pastilles PIN */}
            <div className="flex flex-col items-center gap-3">
              <input
                type="password"
                readOnly
                value={pin}
                id="school-pin-input"
                aria-label="Code PIN"
                className="sr-only"
              />

              <div className="flex items-center justify-center gap-4 h-8">
                {Array.from({ length: Math.max(4, pin.length) }).map((_, idx) => {
                  const isFilled = idx < pin.length;
                  return (
                    <span
                      key={idx}
                      className={`rounded-full transition-all duration-200 ${
                        isFilled
                          ? error
                            ? 'w-4 h-4 bg-rose-500 scale-110'
                            : 'w-4 h-4 bg-slate-900 scale-110'
                          : 'w-3.5 h-3.5 bg-slate-200'
                      }`}
                    />
                  );
                })}
              </div>

              <div className="h-5 flex items-center justify-center">
                {error && (
                  <span className="text-xs font-bold text-rose-600">
                    {error}
                  </span>
                )}
              </div>
            </div>

            {/* Pavé numérique circulaire */}
            <div className="grid grid-cols-3 gap-4 sm:gap-5 place-items-center w-full">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(num)}
                  disabled={isVerifying}
                  className="w-[72px] h-[72px] sm:w-[78px] sm:h-[78px] rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/70 text-slate-900 text-2xl font-black flex items-center justify-center active:bg-slate-900 active:text-white active:scale-90 transition-all duration-150 disabled:opacity-40 cursor-pointer"
                >
                  {num}
                </button>
              ))}

              {/* Bouton tout effacer */}
              <div className="w-[72px] h-[72px] sm:w-[78px] sm:h-[78px] flex items-center justify-center">
                {pin.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isVerifying) {
                        setError('');
                        setPin('');
                      }
                    }}
                    className="text-xs font-extrabold text-slate-400 hover:text-slate-800 active:scale-90 transition px-3 py-2"
                  >
                    C
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                disabled={isVerifying}
                className="w-[72px] h-[72px] sm:w-[78px] sm:h-[78px] rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/70 text-slate-900 text-2xl font-black flex items-center justify-center active:bg-slate-900 active:text-white active:scale-90 transition-all duration-150 disabled:opacity-40 cursor-pointer"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isVerifying || pin.length === 0}
                aria-label="Effacer"
                className="w-[72px] h-[72px] sm:w-[78px] sm:h-[78px] rounded-full bg-transparent hover:bg-slate-100 text-slate-600 flex items-center justify-center active:bg-rose-500 active:text-white active:scale-90 transition-all duration-150 disabled:opacity-25 cursor-pointer"
              >
                <Delete className="w-6 h-6" />
              </button>
            </div>

            {/* Bouton de validation */}
            <button
              type="submit"
              disabled={!pin || isVerifying}
              className="w-full h-14 rounded-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 text-white disabled:text-slate-300 font-extrabold text-sm tracking-wide flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-sm disabled:shadow-none cursor-pointer"
            >
              {isVerifying ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              ) : (
                <>
                  <span>Valider</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Espace bas équilibré */}
          <div className="h-2" />
        </div>
      )}
    </div>
  );
}