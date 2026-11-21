"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  School,
  Users,
  GraduationCap,
  Wallet,
  Settings,
  LogOut,
  NotebookTabs,
  ChartLine,
  Layers,
  Clock,
  Calendar,
  Bell,
  Plus,
  LockKeyhole,
} from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { useState, useEffect, useMemo } from 'react';
import YearSelector from '@/components/YearSelector';
import { ROLES_CONFIG, RoleType } from '@/app/config/roles';

type SidebarProps = { onClose?: () => void };

const Sidebar = ({ onClose }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [school, setSchool] = useState<any>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const [userRole, setUserRole] = useState<RoleType | null>(null);

  // État pour ouvrir/fermer le tiroir mobile
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Charger le rôle utilisateur depuis le cookie ou localStorage au montage client
  useEffect(() => {
    const getRole = () => {
      if (typeof window !== 'undefined') {
        const match = document.cookie.match(new RegExp('(^| )userRole=([^;]+)'));
        if (match) return match[2] as RoleType;
        return localStorage.getItem('userRole') as RoleType | null;
      }
      return null;
    };
    setUserRole(getRole());
  }, [pathname]);

  // Fermer le tiroir lors d'un changement de route
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

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

  // Liste complète de tous les éléments de menu possibles
  const allMenuItems = useMemo(
    () => [
      { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Classes', href: '/classes', icon: School },
      { name: 'Élèves', href: '/students', icon: Users },
      { name: 'Professeurs', href: '/teachers', icon: GraduationCap },
      { name: 'Comptabilité', href: '/finance', icon: Wallet },
      { name: 'Recouvrement', href: '/recouvrement', icon: Layers },
      { name: 'Bulletins', href: '/bulletins', icon: NotebookTabs },
      { name: 'Performance', href: '/performance', icon: ChartLine },
      { name: 'Rapport Promoteur', href: '/rapport-promoteur', icon: NotebookTabs },
      { name: 'Absences & Retards', href: '/attendance', icon: Clock },
      { name: 'Emplois du Temps', href: '/timetables', icon: Calendar },
      { name: 'Annonces', href: '/announcements', icon: Bell },
      { name: 'Paramètres', href: '/admin/settings', icon: Settings },
      { name: 'Quitter', href: '/', icon: LogOut },
    ],
    []
  );

  // Filtrage dynamique des éléments de menu basés sur config/roles.ts
  const allowedPages = userRole ? ROLES_CONFIG[userRole]?.allowedPages || [] : [];
  const menuItems = useMemo(
    () =>
      allMenuItems.filter((item) =>
        allowedPages.some(
          (allowedPath) => item.href === allowedPath || item.href.startsWith(`${allowedPath}/`)
        )
      ),
    [allMenuItems, allowedPages]
  );

  // Éléments du tiroir mobile (sans doublonner "Quitter" qui a son bouton dédié en bas)
  const drawerItems = useMemo(
    () => menuItems.filter((item) => item.href !== '/'),
    [menuItems]
  );

  // 2 éléments fixes à gauche sur mobile
  const leftItems = useMemo(() => drawerItems.slice(0, 2), [drawerItems]);

  // 2 éléments à droite sur mobile
  const rightItems = useMemo(() => drawerItems.slice(2, 4), [drawerItems]);

  // 🛡️ SÉCURITÉ ABSOLUE : Si on est sur le sélecteur de rôle ou le login, on ne monte rien du tout.
  if (pathname === '/' || pathname === '/login') return null;

  // Fonction de déconnexion
  const handleLogout = async () => {
    try {
      document.cookie = "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
      localStorage.removeItem('userRole');

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      onClose?.();
      setIsMenuOpen(false);
      router.push('/login');
      router.refresh();
    } catch (error: any) {
      console.error('Erreur déconnexion:', error.message);
      alert('Erreur lors de la déconnexion');
    }
  };

  // Quitter vers la page de sélection de rôle sans déconnecter la session
  const handleQuit = () => {
    document.cookie = "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    localStorage.removeItem('userRole');
    onClose?.();
    setIsMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  return (
    <>
      {/* 1. VERSION MOBILE (BARRE FIXE + BOUTON CENTRAL + TIROIR) */}
      <div className="md:hidden" role="navigation" aria-label="Mobile Navigation">
        {/* BARRE FIXE BAS */}
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md border-t border-slate-100 rounded-t-[2.2rem] shadow-[0_-10px_30px_rgba(0,0,0,0.04)] z-[90] flex items-center justify-between px-4 pb-2">
          {/* Gauche (2 liens fixes) */}
          <div className="flex flex-1 justify-around items-center">
            {leftItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex flex-col items-center justify-center gap-1 w-14 h-14 active:scale-90 transition-transform duration-150 ${
                    isActive ? 'text-blue-600' : 'text-slate-400'
                  }`}
                >
                  <item.icon size={22} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                  <span
                    className={`text-[10px] font-medium truncate max-w-[65px] ${
                      isActive ? 'text-blue-600 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {item.name.split(' ')[0]}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Bouton central surélevé */}
          <div className="relative w-16 h-16 flex items-center justify-center shrink-0 -translate-y-4">
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 active:scale-95 border-4 border-white cursor-pointer ${
                isMenuOpen
                  ? 'bg-rose-500 rotate-45 shadow-rose-300'
                  : 'bg-[#2B3A67] shadow-slate-400'
              }`}
            >
              <Plus size={28} className="transition-transform duration-200" />
            </button>
          </div>

          {/* Droite (2 liens suivants) */}
          <div className="flex flex-1 justify-around items-center">
            {rightItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex flex-col items-center justify-center gap-1 w-14 h-14 active:scale-90 transition-transform duration-150 ${
                    isActive ? 'text-blue-600' : 'text-slate-400'
                  }`}
                >
                  <item.icon size={22} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                  <span
                    className={`text-[10px] font-medium truncate max-w-[65px] ${
                      isActive ? 'text-blue-600 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {item.name.split(' ')[0]}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* FOND FLOU */}
        <div
          className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[85] transition-opacity duration-300 ${
            isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsMenuOpen(false)}
        />

        {/* TIROIR MOBILE */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-[88] bg-white rounded-t-[2.5rem] border-t border-slate-100 shadow-2xl p-6 pb-28 max-h-[75vh] overflow-y-auto transition-transform duration-500 ease-[cubic-bezier(0.32,0.94,0.6,1)] ${
            isMenuOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-5" />

          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold shrink-0">
              <School size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-800 truncate">
                {school?.name || 'KalanNyetaa'}
              </p>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                Toutes les sections
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {drawerItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border transition-all active:scale-[0.98] ${
                    isActive
                      ? 'bg-blue-600 border-blue-600 text-white font-bold shadow-lg'
                      : 'bg-slate-50/50 border-slate-100 text-slate-600'
                  }`}
                >
                  <item.icon size={19} className={isActive ? 'text-white' : 'text-slate-400'} />
                  <span className="text-[11px] font-bold tracking-tight text-center truncate w-full">
                    {item.name}
                  </span>
                </Link>
              );
            })}

            {/* Bouton de changement de profil (Quitter) */}
            <button
              type="button"
              onClick={handleQuit}
              className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 col-span-2 active:scale-[0.98] transition-transform cursor-pointer"
            >
              <LockKeyhole size={19} />
              <span className="text-[11px] font-black uppercase tracking-wider">Quitter</span>
            </button>

            {/* Bouton de déconnexion */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 col-span-2 mt-2 active:scale-[0.98] transition-transform cursor-pointer"
            >
              <LogOut size={19} />
              <span className="text-[11px] font-black uppercase tracking-wider">Déconnexion</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. VERSION PC */}
      <div className="hidden md:flex w-72 h-screen bg-gradient-to-b from-blue-50/50 to-white text-gray-800 fixed left-0 top-0 p-8 flex-col border-r border-blue-100 z-50 rounded-r-[1.5rem] overflow-y-auto" role="navigation" aria-label="Sidebar">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3 px-1">
            {loadingSchool ? (
              <div className="h-10 w-10 bg-gray-200 rounded-xl animate-pulse"></div>
            ) : school?.logo_url ? (
              <img src={school.logo_url} alt="Logo" className="h-10 w-10 rounded-xl object-cover shadow-lg" />
            ) : (
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
                  <>Kalan<span className="text-[#1763FF]">Nyetaa</span></>
                )}
              </h1>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                {userRole ? ROLES_CONFIG[userRole]?.label : 'Admin'}
              </p>
            </div>
          </div>
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
                    ? 'bg-[#1763FF] text-white shadow-md shadow-blue-500/20' 
                    : 'text-gray-600 hover:bg-blue-50 hover:text-[#1763FF]'
                  }`}
              >
                <item.icon size={20} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-[#1763FF]'} />
                <span>{item.name}</span>
                
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full"></div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* SECTION BAS */}
        <div className="border-t border-gray-100 pt-4 mt-4 space-y-2">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 text-sm font-bold transition-all"
          >
            <LogOut size={20} />
            <span>Déconnexion</span>
          </button>
          
          <button 
            onClick={handleQuit}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-orange-500 hover:bg-orange-50 text-sm font-bold transition-all"
          >
            <LogOut size={20} />
            <span>Quitter</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;