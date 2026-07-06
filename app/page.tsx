"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { offlineFetch } from '@/utils/offlineApi';
import { ROLES_CONFIG, RoleType, ROLES } from './config/roles';
import { ShieldCheck, Landmark, GraduationCap, FolderLock, Lock, X, Loader2, Delete } from 'lucide-react';

export default function RoleSelectionPage() {
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [schoolName, setSchoolName] = useState<string>('');
  const [fetchingSchool, setFetchingSchool] = useState<boolean>(true);
  const router = useRouter();

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

        const { data } = await offlineFetch<{ school_name?: string; name?: string } | null>(cacheKey, async () => {
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
        }, { forceRefresh: true });

        const displayName = data?.school_name ?? data?.name;
        const finalName = displayName?.trim() || 'KalanNyetaa';

        if (isMounted) {
          setSchoolName(finalName);
          persistSchoolNameCache(userId || null, finalName);
        }
      } catch (err) {
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
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
        fetchSchoolName(session?.user?.id);
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  const getRoleIcon = (role: RoleType) => {
    switch (role) {
      case ROLES.PROMOTEUR: return <ShieldCheck className="w-7 h-7 text-indigo-600" />;
      case ROLES.COMPTABLE: return <Landmark className="w-7 h-7 text-emerald-600" />;
      case ROLES.DIRECTEUR: return <GraduationCap className="w-7 h-7 text-blue-600" />;
      case ROLES.CAISSIER: return <FolderLock className="w-7 h-7 text-orange-600" />;
    }
  };

  const saveRoleSession = (role: RoleType) => {
    localStorage.setItem('userRole', role);
    document.cookie = `userRole=${role}; path=/; max-age=86400; SameSite=Lax`;
  };

  const handleRoleSelect = (role: RoleType) => {
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
      await new Promise((resolve) => setTimeout(resolve, 550));

      if (pin === config.pin) {
        saveRoleSession(selectedRole);
        router.push('/dashboard');
      } else {
        setError('Code PIN incorrect. Veuillez réessayer.');
        setPin('');
        setIsVerifying(false);
      }
    } catch (err) {
      setError('Une erreur est survenue.');
      setIsVerifying(false);
    }
  };

  // Gestion de la saisie depuis le clavier virtuel personnalisé
  const handleKeyPress = (num: string) => {
    if (isVerifying) return;
    setError('');
    if (pin.length < 6) {
      setPin((prev) => prev + num);
    }
  };

  const handleDelete = () => {
    if (isVerifying) return;
    setPin((prev) => prev.slice(0, -1));
  };

  // Permet quand même aux utilisateurs sur PC de taper sur leur vrai clavier physique
  useEffect(() => {
    const handlePhysicalKeyDown = (e: KeyboardEvent) => {
      if (!selectedRole || isVerifying) return;
      
      if (/[0-9]/.test(e.key) && pin.length < 6) {
        setPin((prev) => prev + e.key);
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter' && pin.length > 0) {
        handleVerifyPin();
      }
    };

    window.addEventListener('keydown', handlePhysicalKeyDown);
    return () => window.removeEventListener('keydown', handlePhysicalKeyDown);
  }, [pin, selectedRole, isVerifying]);

  return (
    <div id="role-selection-page" className="w-full min-h-screen bg-slate-50 flex flex-col justify-between px-4 py-12 md:py-16 font-sans">
      
      {/* Header */}
      <div className="text-center">
        {fetchingSchool && !schoolName ? (
          <div className="flex items-center justify-center h-10">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight uppercase transition-all">
              {schoolName || 'KalanNyetaa'}
            </h1>
            <p className="mt-3 text-sm sm:text-base font-semibold text-slate-600 leading-6">
              Bienvenue dans votre espace de gestion. Veuillez choisir votre rôle pour commencer.
            </p>
          </>
        )}
        <p className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">Espace de Gestion Scolaire</p>
      </div>

      {/* Zone centrale adaptative */}
      <div className="w-full max-w-2xl mx-auto space-y-6 flex-1 flex flex-col justify-center py-8">
        <p className="text-center text-sm font-semibold text-slate-400">
          Sélectionnez votre espace de travail :
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          {(Object.keys(ROLES_CONFIG) as RoleType[]).map((roleKey) => {
            const roleInfo = ROLES_CONFIG[roleKey];
            return (
              <button
                key={roleKey}
                onClick={() => handleRoleSelect(roleKey)}
                className="w-full bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md text-left flex items-center justify-between active:scale-[0.98] md:hover:scale-[1.01] transition-all duration-200 group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="p-3 bg-slate-50 rounded-xl shrink-0 group-hover:bg-slate-100 transition-colors">
                    {getRoleIcon(roleKey)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-900 text-base">{roleInfo.label}</h3>
                    <p className="text-xs text-slate-400 truncate">{roleInfo.description}</p>
                  </div>
                </div>
                {roleInfo.pin && (
                  <Lock className="w-4 h-4 text-slate-300 shrink-0 ml-2 group-hover:text-slate-400 transition-colors" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer info */}
      <div className="text-center text-xs font-medium text-slate-400 mt-4">
        {fetchingSchool ? 'Chargement...' : schoolName} - Tous droits réservés © {new Date().getFullYear()}
      </div>

      {/* MODALE DE SAISIE DE CODE PIN (Style Banque / Wave) */}
      {selectedRole && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/40 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-xl space-y-5 transform animate-slide-up transition-all">
            
            {/* Header Modale */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-600" />
                <h2 className="font-black text-slate-900 text-base">
                  Code requis : {ROLES_CONFIG[selectedRole].label}
                </h2>
              </div>
              <button 
                onClick={() => !isVerifying && setSelectedRole(null)}
                disabled={isVerifying}
                className="p-1.5 bg-slate-100 rounded-full text-slate-500 active:scale-90 hover:bg-slate-200 transition-colors disabled:opacity-30"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulaire principal */}
            <form onSubmit={handleVerifyPin} className="space-y-4">
              
              {/* Champ PIN (Protégé contre le clavier physique natif via readOnly) */}
              <div className="space-y-2">
                <input
                  type="text"
                  readOnly // 🪄 Magie : Bloque l'ouverture automatique du clavier du smartphone !
                  value={pin}
                  placeholder="••••"
                  id="school-pin-input"
                  style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
                  className="w-full text-center tracking-[1em] text-2xl font-black bg-slate-50 border border-slate-200 rounded-2xl py-3.5 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                />
                {error && (
                  <p className="text-center text-xs font-bold text-rose-500 animate-pulse">{error}</p>
                )}
              </div>

              {/* 🔢 LE CLAVIER NUMÉRIQUE VIRTUEL ANIMÉ */}
              <div className="grid grid-cols-3 gap-3 pt-2 max-w-[320px] mx-auto w-full">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeyPress(num)}
                    className="h-14 bg-slate-50 text-slate-800 text-xl font-black rounded-xl active:bg-indigo-600 active:text-white transition-all duration-100 flex items-center justify-center shadow-sm hover:bg-slate-100"
                  >
                    {num}
                  </button>
                ))}
                {/* Touche Vide / Décorative pour l'équilibre */}
                <div className="h-14"></div>
                
                {/* Touche 0 */}
                <button
                  type="button"
                  onClick={() => handleKeyPress('0')}
                  className="h-14 bg-slate-50 text-slate-800 text-xl font-black rounded-xl active:bg-indigo-600 active:text-white transition-all duration-100 flex items-center justify-center shadow-sm hover:bg-slate-100"
                >
                  0
                </button>

                {/* Touche Retour/Effacer */}
                <button
                  type="button"
                  onClick={handleDelete}
                  className="h-14 bg-slate-50 text-slate-500 rounded-xl active:bg-rose-500 active:text-white transition-all duration-100 flex items-center justify-center shadow-sm hover:bg-slate-100"
                >
                  <Delete size={20} />
                </button>
              </div>

              {/* Bouton de soumission */}
              <button
                type="submit"
                disabled={!pin || isVerifying}
                className={`w-full text-white font-bold py-4 rounded-2xl text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2.5 mt-2
                  ${isVerifying 
                    ? 'bg-slate-700 cursor-not-allowed shadow-inner animate-pulse' 
                    : 'bg-slate-900 hover:bg-slate-800 active:scale-[0.99] disabled:opacity-30 shadow-md'
                  }`}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                    <span className="normal-case tracking-normal font-medium text-slate-200">Vérification...</span>
                  </>
                ) : (
                  <span>Valider et Entrer</span>
                )}
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}