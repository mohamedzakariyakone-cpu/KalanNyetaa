'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; 
import { LayoutDashboard, School, Users, GraduationCap, Wallet, Settings, LogOut, NotebookTabs, ChartLine, MoreHorizontal } from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { useState, useEffect, useRef } from 'react';
import YearSelector from '@/components/YearSelector';

type SidebarProps = { onClose?: () => void };

const Sidebar = ({ onClose }: SidebarProps) => {
  const pathname = usePathname(); 
  const router = useRouter();
  const [school, setSchool] = useState<any>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);
  
  // État pour ouvrir/fermer le menu "Plus" sur mobile
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu "Plus" si on clique à l'extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Éléments de menu d'origine
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

  // Découpage pour le mobile
  const visibleMobileItems = menuItems.slice(0, 4);
  const hiddenMobileItems = menuItems.slice(4);

  // Fonction de déconnexion
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      onClose?.();
      setShowMoreMenu(false);
      router.push('/login');
      router.refresh();
    } catch (error: any) {
      console.error('Erreur déconnexion:', error.message);
      alert('Erreur lors de la déconnexion');
    }
  };

  if (pathname === '/login') return null;

  return (
    <>
      {/* 1. VERSION MOBILE (Stylisée avec bordures renforcées et animations poussées) */}
      <div ref={menuRef} className="md:hidden fixed bottom-0 left-0 right-0 z-50 transition-all duration-300" role="navigation" aria-label="Mobile Navigation">
        
        {/* LE MENU DÉROULANT "PLUS" (Animation d'entrée "Pop", flou d'arrière-plan, bordure bleue) */}
        {showMoreMenu && (
          <div className="absolute bottom-[5.5rem] right-4 left-4 bg-white/95 backdrop-blur-2xl rounded-3xl p-5 shadow-[0_15px_60px_rgba(23,99,255,0.2)] border-2 border-blue-100 flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto animate-pop-in duration-300">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-3 mb-2 italic">Autres fonctionnalités</p>
            {hiddenMobileItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-98
                    ${isActive ? 'bg-[#1763FF] text-white shadow-lg shadow-blue-500/20' : 'text-gray-600 hover:bg-blue-50/70'}`}
                  onClick={() => setShowMoreMenu(false)}
                >
                  <item.icon size={19} className={isActive ? 'text-white' : 'text-gray-400'} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
            
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-red-500 hover:bg-red-50/80 text-sm font-bold border-t border-gray-100/60 mt-2.5 pt-3.5 active:scale-98 transition-transform"
            >
              <LogOut size={19} />
              <span>Déconnexion</span>
            </button>
          </div>
        )}

        {/* LA BARRE PRINCIPALE (Bordure supérieure bleue prononcée, ombre portée intense, animations d'icônes) */}
        <div className="bg-white/95 backdrop-blur-xl rounded-t-[2.2rem] shadow-[0_-10px_40px_rgba(23,99,255,0.12),0_-1px_0px_rgba(0,0,0,0.03)] border-t-2 border-t-blue-100/80 p-3 pb-6 px-6 flex justify-between items-center transition-transform">
          {visibleMobileItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href} 
                className="flex flex-col items-center gap-1.5 min-w-[62px] relative group active:scale-95 transition-transform duration-150"
                onClick={() => setShowMoreMenu(false)}
              >
                <div className={`p-2 rounded-2xl transition-all ${isActive ? 'bg-blue-100/70 text-[#1763FF] shadow-inner animate-bounce-short' : 'text-gray-400'}`}>
                  <item.icon 
                    size={23} 
                    className="transition-transform duration-200 group-active:scale-95" 
                  />
                </div>
                <span className={`text-[10.5px] tracking-tight transition-colors duration-200 ${isActive ? 'text-[#1763FF] font-black' : 'text-gray-500 font-medium'}`}>
                  {item.name.split(' ')[0]}
                </span>
                
                {isActive && (
                  <span className="absolute bottom-[-6px] w-1.5 h-1.5 bg-[#1763FF] rounded-full animate-pulse-slow" />
                )}
              </Link>
            );
          })}

          <button 
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="flex flex-col items-center gap-1.5 min-w-[62px] focus:outline-none active:scale-95 transition-transform duration-150 group"
          >
            <div className={`p-2 rounded-2xl transition-all ${showMoreMenu || hiddenMobileItems.some(item => pathname === item.href) ? 'bg-blue-100/70 text-[#1763FF] shadow-inner' : 'text-gray-400'}`}>
              <MoreHorizontal 
                size={23} 
                className={`transition-transform duration-300 ${showMoreMenu ? 'rotate-90' : ''}`}
              />
            </div>
            <span className={`text-[10.5px] tracking-tight transition-colors duration-200 ${showMoreMenu || hiddenMobileItems.some(item => pathname === item.href) ? 'text-[#1763FF] font-black' : 'text-gray-500 font-medium'}`}>
              Plus
            </span>
          </button>
        </div>
      </div>

      {/* 2. VERSION PC (Reste identique) */}
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
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Admin</p>
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
        <div className="border-t border-gray-100 pt-4 mt-4">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 text-sm font-bold transition-all"
          >
            <LogOut size={20} />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;