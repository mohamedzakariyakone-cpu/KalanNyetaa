"use client"

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase'; // Assurez-vous que ce chemin est correct
import { useRouter } from 'next/navigation';
import { LogIn, ShieldCheck, Loader2, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [school, setSchool] = useState<any>(null);

  // Récupérer les données de l'école pour affichage
  useEffect(() => {
    async function fetchSchool() {
      try {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('*')
          .limit(1)
          .maybeSingle();
        
        if (schoolData) {
          setSchool(schoolData);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération de l\'école:', error);
      }
    }
    fetchSchool();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Authentification avec Supabase
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        throw new Error("Email ou mot de passe incorrect.");
      }

      if (!data.user) {
        throw new Error("Utilisateur introuvable.");
      }

      // 2. Récupération du rôle dans la table 'profiles'
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error("Erreur lors de la récupération du profil:", profileError.message);
      }

      // 3. Gestion de la redirection
      const params = new URLSearchParams(window.location.search);
      const redirectParam = params.get('redirect');

      if (profile?.role === 'super_admin') {
        // Redirection absolue pour le Super Admin
        router.push('/super_admin');
      } else if (redirectParam && redirectParam !== '/login') {
        // Redirection vers la page tentée avant le login (vérification du slash absolu)
        const cleanRedirect = redirectParam.startsWith('/') ? redirectParam : `/${redirectParam}`;
        router.push(cleanRedirect);
      } else {
        // ✅ CORRECTION : Ajout du slash absolu obligatoire '/' pour éviter la route relative cassée
        // Ajuste en '/school/dashboard' si ton tableau de bord est dans le sous-dossier school
        router.push('/dashboard'); 
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de la connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center py-12 px-6 lg:px-8 transition-colors">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          {school?.logo_url ? (
            <img src={school.logo_url} alt="Logo" className="h-16 w-16 rounded-[2rem] object-cover shadow-2xl ring-8 ring-white dark:ring-slate-800" />
          ) : (
            <div className="h-16 w-16 bg-blue-600 dark:bg-green-700 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-green-200 dark:shadow-green-900/30 ring-8 ring-white dark:ring-slate-800">
              <span className="font-black text-3xl text-white italic">KN</span>
            </div>
          )}
        </div>
        
        <h2 className="text-center text-3xl font-black tracking-tighter text-slate-900 dark:text-slate-50 italic">
           KalanNyetaa
        </h2>
        <p className="mt-2 text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Gestion Scolaire Intégrée
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[440px]">
        <div className="bg-white dark:bg-slate-800 py-10 px-8 shadow-2xl shadow-slate-200/50 dark:shadow-slate-900/50 rounded-[3rem] border border-slate-100 dark:border-slate-700 transition-colors">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 p-4 rounded-2xl text-xs font-black uppercase text-center border border-rose-100 dark:border-rose-800 animate-pulse">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 ml-2 mb-2 tracking-widest">
                Adresse Email
              </label>
              <input
                type="email"
                required
                className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-transparent rounded-2xl focus:border-green-500 focus:bg-white dark:focus:bg-slate-600 outline-none font-bold text-slate-900 dark:text-slate-50 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-400"
                placeholder="nom@ecole.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 ml-2 mb-2 tracking-widest">
                Mot de passe
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-transparent rounded-2xl focus:border-green-500 focus:bg-white dark:focus:bg-slate-600 outline-none font-bold text-slate-900 dark:text-slate-50 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-400"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[42px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-green-600 dark:text-green-500 focus:ring-green-500 dark:focus:ring-green-600 transition-all cursor-pointer" 
                />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Se souvenir de moi</span>
              </div>
              <button type="button" className="text-xs font-bold text-green-600 dark:text-green-500 hover:text-green-700 dark:hover:text-green-400 hover:underline transition-colors">
                Oublié ?
              </button>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-3 py-5 px-4 bg-slate-900 dark:bg-green-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-green-600 dark:hover:bg-green-700 transition-all shadow-xl active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <LogIn size={18} />
                    Accéder au portail
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700 text-center">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center justify-center gap-2">
              <ShieldCheck size={14} className="text-green-500 dark:text-green-400" />
              Protection des données Multi-Tenant
            </p>
          </div>
        </div>
        
        <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500 font-bold italic">
          'Propulsé par KalanNyetaa Technologies'
        </p>
      </div>
    </div>
  );
}