'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; 
import { LayoutDashboard, School, Users, GraduationCap, Wallet, Settings, LogOut, NotebookTabs, X, ChartLine } from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { useState, useEffect } from 'react';
import YearSelector from '@/components/YearSelector';

type SidebarProps = { mobile?: boolean; floating?: boolean; onClose?: () => void };

const Sidebar = ({ mobile = false, floating = false, onClose }: SidebarProps) => {
  const pathname = usePathname(); 
  const router = useRouter();
  const [school, setSchool] = useState<any>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);

  // Récupérer les données de l'école
  useEffect(() => {
    async function fetchSchool() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('school_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.school_id) {
          const { data: schoolData } = await supabase
            .from('schools')
            .select('*')
            .eq('id', profile.school_id)
            .maybeSingle();
          
          if (schoolData) {
            setSchool(schoolData);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération de l\'école:', error);
      } finally {
        setLoadingSchool(false);
      }
    }
    fetchSchool();
  }, []);

  const menuItems = [
    { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Classes', href: '/classes', icon: School },
    { name: 'Élèves', href: '/students', icon: Users },
    { name: 'Professeurs', href: '/teachers', icon: GraduationCap },
    { name: 'Comptabilité', href: '/finance', icon: Wallet },
    { name: 'Bulletins', href: '/bulletins', icon: NotebookTabs },
    { name: 'Performance', href: '/performance', icon: ChartLine },
    { name: 'Paramètres', href: '/admin/settings', icon: Settings }
  ];

  // Fonction de déconnexion
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Ferme la sidebar si on est sur mobile avant de rediriger
      onClose?.();
      
      // Redirection forcée vers la page de login
      router.push('/login');
      router.refresh(); // Rafraîchit pour réinitialiser le middleware/state
    } catch (error: any) {
      console.error('Erreur déconnexion:', error.message);
      alert('Erreur lors de la déconnexion');
    }
  };

  let base = '';
  if (floating) {
    base = 'fixed left-1/2 bottom-6 transform -translate-x-1/2 w-[92vw] max-w-[360px] bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 p-4 rounded-3xl shadow-2xl dark:shadow-slate-950/50 z-50 overflow-hidden transition-colors';
  } else if (mobile) {
    base = 'fixed inset-y-0 left-0 w-[85vw] max-w-[320px] bg-gradient-to-b from-blue-50/60 dark:from-slate-800/90 to-white dark:to-slate-900 text-gray-800 dark:text-slate-100 p-5 flex flex-col border-r border-blue-100 dark:border-slate-700 shadow-2xl dark:shadow-slate-950/50 z-50 transform transition-all overflow-y-auto';
  } else {
    base = 'hidden md:flex w-72 h-screen bg-gradient-to-b from-blue-50/50 dark:from-slate-800/50 to-white dark:to-slate-900 text-gray-800 dark:text-slate-100 fixed left-0 top-0 p-8 flex flex-col border-r border-blue-100 dark:border-slate-700 z-50 rounded-r-[1.5rem] overflow-y-auto transition-colors';
  }

  return (
    <div className={base} role="navigation" aria-label="Sidebar">
      {/* HEADER */}
      <div className={`flex items-center justify-between ${mobile ? 'mb-6' : 'mb-12'}`}>
        <div className="flex items-center gap-3 px-1">
          {loadingSchool ? (
            <div className="h-10 w-10 bg-gray-200 rounded-xl animate-pulse"></div>
          ) : school?.logo_url ? (
            <img src={school.logo_url} alt="Logo" className="h-10 w-10 rounded-xl object-cover shadow-lg" />
          ) : (
            /* Logo par défaut : dégradé #1763FF → #00246B */
            <div className="h-10 w-10 bg-gradient-to-br from-[#1763FF] to-[#00246B] rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="font-black text-xl text-white">K</span>
            </div>
          )}
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-900 leading-tight">
              {loadingSchool ? (
                <span className="text-gray-300">Chargement...</span>
              ) : school?.name ? (
                <>{school.name}</>
              ) : (
                /* Texte KalanNyetaa avec sa touche de couleur */
                <>Kalan<span className="text-[#1763FF]">Nyetaa</span></>
              )}
            </h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Admin</p>
          </div>
        </div>

        {mobile && onClose && (
          <button onClick={onClose} className="p-2 rounded-xl bg-gray-100 text-slate-600">
            <X size={18} />
          </button>
        )}
      </div>

      {/* SÉLECTEUR D'ANNÉE SCOLAIRE */}
      <div className="mb-6 px-1">
        <YearSelector />
      </div>
      
      {/* NAVIGATION */}
      <nav className="space-y-1.5 flex-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm
                ${isActive 
                  ? 'bg-[#1763FF] dark:bg-green-600 text-white shadow-md shadow-blue-500/20 dark:shadow-green-900/30' 
                  : 'text-gray-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-[#1763FF] dark:hover:text-green-400'
                }`}
              onClick={() => onClose?.()}
            >
              <item.icon size={20} className={isActive ? 'text-white' : 'text-gray-400 dark:text-slate-500 group-hover:text-[#1763FF] dark:group-hover:text-green-400'} />
              <span>{item.name}</span>
              
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full"></div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* SECTION BAS : Bouton de déconnexion */}
      <div className="border-t border-gray-100 dark:border-slate-700 pt-4 mt-4">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-bold transition-all"
        >
          <LogOut size={20} />
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;