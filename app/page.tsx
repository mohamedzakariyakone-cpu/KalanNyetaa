"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { offlineFetch } from '@/utils/offlineApi';
import { ROLES_CONFIG, RoleType, ROLES } from './config/roles';
import { ShieldCheck, Landmark, GraduationCap, FolderLock, Lock, X, Loader2 } from 'lucide-react';

export default function RoleSelectionPage() {
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [schoolName, setSchoolName] = useState<string>('');
  const [fetchingSchool, setFetchingSchool] = useState<boolean>(true);
  const router = useRouter();

  // Récupération dynamique du nom de l'école depuis la table "school"
  useEffect(() => {
    async function fetchSchoolName() {
      try {
        const { data, error } = await offlineFetch<{ name: string } | null>('school_name', async () => {
          return await supabase
            .from('schools')
            .select('name')
            .limit(1)
            .single();
        });

        if (data && data.name) {
          setSchoolName(data.name);
        } else {
          setSchoolName('KalanNyetaa');
        }
      } catch (err) {
        console.error("Erreur de récupération du nom de l'école :", err);
        setSchoolName('KalanNyetaa');
      } finally {
        setFetchingSchool(false);
      }
    }

    fetchSchoolName();
  }, []);

  // Association des icônes pour un superbe rendu mobile et PC
  const getRoleIcon = (role: RoleType) => {
    switch (role) {
      case ROLES.PROMOTEUR: return <ShieldCheck className="w-7 h-7 text-indigo-600" />;
      case ROLES.COMPTABLE: return <Landmark className="w-7 h-7 text-emerald-600" />;
      case ROLES.DIRECTEUR: return <GraduationCap className="w-7 h-7 text-blue-600" />;
      case ROLES.CAISSIER: return <FolderLock className="w-7 h-7 text-orange-600" />;
    }
  };

  // Helper pour stocker le rôle à la fois en local et dans les cookies pour le proxy
  const saveRoleSession = (role: RoleType) => {
    localStorage.setItem('userRole', role);
    // Crée un cookie lisible par le serveur (valable 24 heures)
    document.cookie = `userRole=${role}; path=/; max-age=86400; SameSite=Lax`;
  };

  const handleRoleSelect = (role: RoleType) => {
    setError('');
    setPin('');
    const config = ROLES_CONFIG[role];
    
    if (config.pin === null) {
      // Pas de PIN -> Enregistrement local + cookie et accès direct
      saveRoleSession(role);
      router.push('/dashboard');
    } else {
      // Demande de PIN -> Ouverture de la modale
      setSelectedRole(role);
    }
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    // Bloque le rechargement natif de la page à 100%
    e.preventDefault();
    if (!selectedRole || !pin) return;

    const config = ROLES_CONFIG[selectedRole];
    if (pin === config.pin) {
      // PIN correct -> Enregistrement local + cookie et accès direct
      saveRoleSession(selectedRole);
      router.push('/dashboard');
    } else {
      setError('Code PIN incorrect. Veuillez réessayer.');
      setPin('');
    }
  };

  return (
    <div id="role-selection-page" className="w-full min-h-screen bg-slate-50 flex flex-col justify-between px-4 py-8 font-sans">
      
      {/* Header */}
      <div className="text-center mt-6">
        {fetchingSchool ? (
          <div className="flex items-center justify-center h-9">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase transition-all">
            {schoolName}
          </h1>
        )}
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Espace de Gestion</p>
      </div>

      {/* Zone centrale adaptative (Responsive PC / Mobile) */}
      <div className="w-full max-w-2xl mx-auto space-y-4 my-auto py-6">
        <p className="text-center text-sm font-semibold text-slate-400 mb-2">
          Sélectionnez votre espace de travail :
        </p>

        {/* Grid intelligente : 1 colonne sur mobile, 2 colonnes sur PC de bureau */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      <div className="text-center text-xs font-medium text-slate-400">
        {fetchingSchool ? 'Chargement...' : schoolName} - Tous droits réservés © {new Date().getFullYear()}
      </div>

      {/* MODALE DE SAISIE DE CODE PIN */}
      {selectedRole && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/40 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-xl space-y-6 transform animate-slide-up transition-all">
            
            {/* Header Modale */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-600" />
                <h2 className="font-black text-slate-900 text-lg">
                  Code requis : {ROLES_CONFIG[selectedRole].label}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedRole(null)}
                className="p-1.5 bg-slate-100 rounded-full text-slate-500 active:scale-90 hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulaire de saisie */}
            <form onSubmit={handleVerifyPin} noValidate autoComplete="off" className="space-y-4">
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                Veuillez entrer le code secret pour déverrouiller l'accès de cet espace scolaire.
              </p>

              <div className="space-y-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  autoFocus
                  autoComplete="one-time-code"
                  name={`school-pin-security-${selectedRole}`}
                  id="school-pin-input"
                  style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
                  className="w-full text-center tracking-[1em] text-2xl font-black bg-slate-50 border border-slate-200 rounded-2xl py-4 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                />
                {error && (
                  <p className="text-center text-xs font-bold text-rose-500 animate-pulse">{error}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={!pin}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold py-4 rounded-2xl text-sm uppercase tracking-wider active:scale-[0.99] transition-all"
              >
                Valider et Entrer
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}