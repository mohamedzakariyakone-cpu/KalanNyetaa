"use client";

import { useState, useEffect, cloneElement, useRef, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { offlineFetch } from '@/utils/offlineApi';
import { getLocalCache, setLocalCache } from '@/utils/offlineStorage'; // Ajout pour la revalidation directe
import { useYear } from '@/context/YearContext';
import { 
  Users, TrendingUp, Clock, 
  ArrowDownRight, 
  AlertTriangle, Calendar, UserCheck, ShieldAlert, Activity,
  Bell, DollarSign, BookOpen, ChevronDown, Lock
} from 'lucide-react';

export default function Dashboard() {
  // Récupération de l'état global de l'année scolaire
  const { selectedYearId, selectedYear, years, isLoading, isReadOnly, changeYear } = useYear();

  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    totalTeachers: 0,
    totalCollected: 0,
    totalExpected: 0,
    totalExpenses: 0,
  });

  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [criticalDebtors, setCriticalDebtors] = useState<any[]>([]);
  const [classDistribution, setClassDistribution] = useState<any[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Gestion du dropdown d'année sur mobile
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Détecter le rôle utilisateur au montage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const match = document.cookie.match(new RegExp('(^| )userRole=([^;]+)'));
      const role = match ? match[2] : localStorage.getItem('userRole');
      setUserRole(role);
    }
  }, []);

  // Condition pour masquer les montants au Directeur et au Caissier
  const shouldHideFinancials = userRole === 'directeur' || userRole === 'caissier';

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentMonth = new Date().toLocaleDateString('fr-FR', { month: 'long' });
  const formattedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  // Utilisation de useCallback pour stabiliser la fonction et éviter les re-renders infinis
 const fetchDashboardData = useCallback(async (yearId: number) => {
    // 1. TENTATIVE DE CHARGEMENT DU CACHE IMMÉDIAT (Évite le loading bloquant)
    const cachedDashboard = await getLocalCache<{
      stats: typeof stats;
      recentPayments: any[];
      criticalDebtors: any[];
      classDistribution: any[];
      recentIncidents: any[];
    }>(`dashboard_compiled_data:${yearId}`);

    if (cachedDashboard) {
      setStats(cachedDashboard.stats);
      setRecentPayments(cachedDashboard.recentPayments);
      setCriticalDebtors(cachedDashboard.criticalDebtors);
      setClassDistribution(cachedDashboard.classDistribution);
      setRecentIncidents(cachedDashboard.recentIncidents);
      setLoading(false); // On coupe immédiatement le chargement visuel
    } else {
      setLoading(true);
    }

    // 2. REQUÊTE ET REVALIDATION EN ARRIÈRE-PLAN
    try {
      // Extraction parallèle des données via offlineFetch pour maintenir tes durées de cache
      const [
        studentsRes,
        classesRes,
        teachersRes,
        paymentsRes,
        expensesRes,
        disciplineRes
      ] = await Promise.all([
        offlineFetch<any[]>(`dashboard_students:${yearId}`, async () => {
          return await supabase
            .from('students')
            .select('id, first_name, last_name, scolarite_totale, scolarite_payee, class_id')
            .eq('academic_year_id', yearId);
        }, { cacheDuration: 3600 }),

        offlineFetch<any[]>(`dashboard_classes:${yearId}`, async () => {
          return await supabase
            .from('classes')
            .select('id, name')
            .eq('academic_year_id', yearId);
        }, { cacheDuration: 3600 }),

        offlineFetch<any[]>(`dashboard_teachers:${yearId}`, async () => {
          return await supabase
            .from('teachers')
            .select('id')
            .eq('academic_year_id', yearId);
        }, { cacheDuration: 3600 }),

        offlineFetch<any[]>(`dashboard_payments:${yearId}`, async () => {
          return await supabase
            .from('payments')
            .select('id, amount, created_at, student_id')
            .eq('academic_year_id', yearId)
            .order('created_at', { ascending: false });
        }, { cacheDuration: 1800 }),

        offlineFetch<any[]>(`dashboard_expenses:${yearId}`, async () => {
          return await supabase
            .from('expenses')
            .select('amount')
            .eq('academic_year_id', yearId);
        }, { cacheDuration: 3600 }),

        offlineFetch<any[]>(`dashboard_discipline:${yearId}`, async () => {
          return await supabase
            .from('discipline')
            .select('id, reason, severity, incident_date, student_id')
            .eq('academic_year_id', yearId)
            .order('incident_date', { ascending: false })
            .range(0, 2);
        }, { cacheDuration: 1800 }).then(result => ({ data: result.data, error: result.error }))
      ]);

      if (studentsRes.error && !studentsRes.data) throw studentsRes.error;
      if (classesRes.error && !classesRes.data) throw classesRes.error;

      const students = studentsRes.data;
      const classes = classesRes.data;
      const teacherCount = teachersRes.data?.length || 0;
      const payments = paymentsRes.data;
      const expenses = expensesRes.data;
      const discipline = disciplineRes.data;

      // Traitement et formatage des structures de données
      const classMap: Record<string, string> = {};
      classes?.forEach((c: { id: string | number; name: string; }) => { classMap[c.id] = c.name; });

      const studentMap: Record<string, { fullName: string, className: string }> = {};
      students?.forEach((s: { id: string | number; first_name: any; last_name: any; class_id: string | number; }) => {
        studentMap[s.id] = {
          fullName: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Élève Sans Nom',
          className: classMap[s.class_id] || 'Sans classe'
        };
      });

      const expected = students?.reduce((acc: number, s: any) => acc + Number(s.scolarite_totale || 0), 0) || 0;
      const collected = students?.reduce((acc: number, s: any) => acc + Number(s.scolarite_payee || 0), 0) || 0;
      const totalExp = expenses?.reduce((acc: number, e: any) => acc + Number(e.amount || 0), 0) || 0;

      const debtors = (students || [])
        .map((s: any) => {
          const debt = Number(s.scolarite_totale || 0) - Number(s.scolarite_payee || 0);
          return {
            id: s.id,
            name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
            className: classMap[s.class_id] || 'N/A',
            debt: debt
          };
        })
        .filter((s: any) => s.debt > 0)
        .sort((a: any, b: any) => b.debt - a.debt)
        .slice(0, 4);

      const distribution = (classes || []).map((c: any) => {
        const count = (students || []).filter((s: any) => s.class_id === c.id).length;
        return { name: c.name, count };
      });

      const enrichedPayments = (payments || []).slice(0, 4).map((p: any) => ({
        id: p.id,
        amount: p.amount,
        created_at: p.created_at,
        studentName: studentMap[p.student_id]?.fullName || 'Élève Anonyme',
        className: studentMap[p.student_id]?.className || 'N/A'
      }));

      const enrichedIncidents = (discipline || []).map((d: any) => ({
        id: d.id,
        reason: d.reason,
        severity: d.severity,
        date: d.incident_date,
        studentName: studentMap[d.student_id]?.fullName || 'Élève'
      }));

      const finalStats = {
        totalStudents: students?.length || 0,
        totalClasses: classes?.length || 0,
        totalTeachers: teacherCount || 0,
        totalCollected: collected,
        totalExpected: expected,
        totalExpenses: totalExp
      };

      // Injection fluide des états mis à jour (sans coupure visuelle)
      setStats(finalStats);
      setRecentPayments(enrichedPayments);
      setCriticalDebtors(debtors);
      setClassDistribution(distribution);
      setRecentIncidents(enrichedIncidents);

      // Sauvegarde du dashboard compilé localement pour la prochaine ouverture instantanée
      await setLocalCache(`dashboard_compiled_data:${yearId}`, {
        stats: finalStats,
        recentPayments: enrichedPayments,
        criticalDebtors: debtors,
        classDistribution: distribution,
        recentIncidents: enrichedIncidents
      });

    } catch (error) {
      console.error('Erreur lors du rafraîchissement du dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedYearId) {
      fetchDashboardData(selectedYearId);
    }
  }, [selectedYearId, fetchDashboardData]);

  const remaining = stats.totalExpected - stats.totalCollected;
  const recoveryRate = stats.totalExpected > 0 ? Math.round((stats.totalCollected / stats.totalExpected) * 100) : 0;
  const netCaisse = stats.totalCollected - stats.totalExpenses;
  const mobileRadius = 50;
  const mobileCircumference = 2 * Math.PI * mobileRadius;
  const mobileStrokeDashoffset = mobileCircumference - (recoveryRate / 100) * mobileCircumference;

  // L'écran blanc de chargement n'apparaît que si l'application n'a absolument rien en mémoire cache (ex: premier démarrage)
  if (loading && stats.totalExpected === 0) {
    return (
      <div className="w-full min-h-[500px] flex flex-col items-center justify-center p-6 bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-50 min-h-screen font-sans">
      
      {/* ========================================================================= */}
      {/* 1. INTERFACE MOBILE (100% NATIVE APP UI/UX)                               */}
      {/* ========================================================================= */}
      <div className="block md:hidden w-full px-4 pt-6 pb-24 space-y-6">
        
        {/* En-tête Application avec sélecteur intégré */}
        <div className="flex justify-between items-center w-full">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Vue d'ensemble</h1>
              
              <div className="relative" ref={dropdownRef}>
                {isLoading ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl animate-pulse">
                    <div className="h-3.5 w-3.5 bg-slate-200 rounded"></div>
                    <div className="h-3.5 w-16 bg-slate-200 rounded"></div>
                  </div>
                ) : !selectedYear || years.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <Calendar size={14} />
                    <span>Aucune année</span>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setIsOpen(!isOpen)}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide
                        transition-all duration-200 ease-in-out shrink-0 select-none
                        ${isReadOnly 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200/60 hover:bg-amber-100/80 active:scale-95' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100/80 active:scale-95'
                        }
                      `}
                    >
                      {isReadOnly ? <Lock size={12} className="shrink-0 text-amber-600" /> : <Calendar size={12} className="shrink-0" />}
                      <span className="truncate max-w-20 sm:max-w-none">{selectedYear.label}</span>
                      <ChevronDown size={12} className={`transition-transform duration-200 opacity-60 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="absolute top-full mt-2 right-0 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 origin-top-right">
                        <div className="max-h-45 overflow-y-auto no-scrollbar">
                          {years.map((year) => (
                            <button
                              key={year.id}
                              onClick={() => {
                                changeYear(year);
                                setIsOpen(false);
                              }}
                              className={`
                                w-full flex items-center justify-between px-4 py-2 text-left text-xs font-bold uppercase tracking-wide
                                transition-colors duration-150
                                ${year.id === selectedYear.id
                                  ? 'bg-emerald-50 text-emerald-700 font-black'
                                  : 'text-slate-600 hover:bg-slate-50'
                                }
                              `}
                            >
                              <span>{year.label}</span>
                              {year.is_current && (
                                <span className="text-[9px] font-black bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-md uppercase tracking-tight">
                                  Actuelle
                                </span>
                              )}
                            </button>
                          ))}
                        </div>

                        {isReadOnly && (
                          <div className="mt-1.5 mx-1.5 p-2.5 bg-amber-50/70 border border-amber-200/40 rounded-xl">
                            <div className="flex gap-1.5">
                              <Lock size={12} className="text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-black text-amber-800 uppercase tracking-tight">Mode archive</p>
                                <p className="text-[9px] font-medium text-amber-600 leading-normal mt-0.5">
                                  Historique verrouillé. Aucune modification possible sur cette année scolaire.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <p className="text-sm font-bold text-slate-500">KalanNyetaa Structure</p>
          </div>
          <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 relative active:scale-95 transition-transform">
            <Bell className="w-6 h-6 text-slate-700" />
            <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full"></span>
          </button>
        </div>

        {/* STATISTIQUES RAPIDES 2x2 */}
        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-3">
              <Users size={24} />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Élèves</p>
              <p className="text-2xl font-black text-slate-900">{stats.totalStudents}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-3">
              <BookOpen size={24} />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Classes</p>
              <p className="text-2xl font-black text-slate-900">{stats.totalClasses}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-3">
              <UserCheck size={24} />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Enseignants</p>
              <p className="text-2xl font-black text-slate-900">{stats.totalTeachers}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 mb-3">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Période</p>
              <p className="text-lg font-black text-slate-900 truncate">{formattedMonth}</p>
            </div>
          </div>
        </div>

        {/* GRANDE CARTE FINANCIÈRE FINTECH */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col items-center w-full">
          <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-500" />
            Recouvrement Global
          </h2>
          
          <div className="relative w-36 h-36 flex items-center justify-center mb-6">
            <svg viewBox="0 0 144 144" preserveAspectRatio="xMidYMid meet" className="w-full h-full block transform origin-center -rotate-90">
              <circle cx="72" cy="72" r={mobileRadius} stroke="currentColor" strokeWidth="14" fill="transparent" className="text-slate-100" />
              <circle 
                cx="72" cy="72" r={mobileRadius} 
                stroke="currentColor" 
                strokeWidth="14" 
                fill="transparent" 
                strokeDasharray={mobileCircumference} 
                strokeDashoffset={mobileStrokeDashoffset} 
                strokeLinecap="round" 
                className="text-emerald-500 transition-all duration-1000 ease-out" 
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl leading-none font-black text-slate-900">{recoveryRate}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <div className="bg-slate-50 p-4 rounded-2xl flex flex-col justify-center">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Encaissé</p>
              <p className="text-base font-black text-emerald-600 truncate">
                {shouldHideFinancials ? '••••••' : `${new Intl.NumberFormat('fr-FR').format(stats.totalCollected)} F`}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl flex flex-col justify-center">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Objectif</p>
              <p className="text-base font-black text-slate-800 truncate">
                {shouldHideFinancials ? '••••••' : `${new Intl.NumberFormat('fr-FR').format(stats.totalExpected)} F`}
              </p>
            </div>
          </div>
        </div>

        {/* ALERTE FONDS DEHORS */}
        {remaining > 0 && (
          <div className="bg-rose-500 p-5 rounded-3xl text-white shadow-lg shadow-rose-200 flex justify-between items-center w-full">
            <div className="min-w-0">
              <p className="text-rose-100 font-bold text-xs uppercase tracking-widest mb-1">Reste à recouvrer</p>
              <h3 className="text-2xl font-black truncate">
                {shouldHideFinancials ? '••••••' : `${new Intl.NumberFormat('fr-FR').format(remaining)} FCFA`}
              </h3>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0 ml-3">
              <ArrowDownRight className="w-6 h-6 text-white" />
            </div>
          </div>
        )}

        {/* LISTES NATIVES */}
        {/* 1. Flux Financiers */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm w-full space-y-4">
          <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" /> Flux Financiers
          </h3>
          <div className="space-y-4">
            {recentPayments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-2">Aucun paiement récent.</p>
            ) : (
              recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between min-w-0 gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-sm uppercase shrink-0">
                      {p.studentName.substring(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 text-sm truncate">{p.studentName}</p>
                      <p className="text-xs text-slate-500 truncate">{p.className}</p>
                    </div>
                  </div>
                  <span className="font-black text-sm text-emerald-600 shrink-0">
                    {shouldHideFinancials ? '••••••' : `+${new Intl.NumberFormat('fr-FR').format(p.amount)}F`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. Retards Critiques */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm w-full space-y-4">
          <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" /> Retards Critiques
          </h3>
          <div className="space-y-4">
            {criticalDebtors.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-2">Aucun retard détecté.</p>
            ) : (
              criticalDebtors.map((d) => (
                <div key={d.id} className="flex items-center justify-between min-w-0 gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 font-bold text-sm uppercase shrink-0">
                      {d.name.substring(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 text-sm truncate">{d.name}</p>
                      <p className="text-xs text-slate-500 truncate">{d.className}</p>
                    </div>
                  </div>
                  <span className="font-black text-sm text-rose-600 shrink-0">
                    {shouldHideFinancials ? '••••••' : `${new Intl.NumberFormat('fr-FR').format(d.debt)}F`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Discipline */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm w-full space-y-4">
          <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600" /> Suivi Disciplinaire
          </h3>
          <div className="space-y-3">
            {recentIncidents.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-2">Rien à signaler.</p>
            ) : (
              recentIncidents.map((i) => (
                <div key={i.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5 w-full">
                  <div className="flex justify-between items-center font-bold text-sm min-w-0 gap-2">
                    <span className="text-slate-900 truncate flex-1">{i.studentName}</span>
                    <span className={`text-[10px] px-2 py-1 rounded-lg uppercase font-black shrink-0 ${
                      i.severity === 'high' || i.severity === 'Grave' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>{i.severity || 'Normal'}</span>
                  </div>
                  <p className="text-xs text-slate-500 italic leading-snug">« {i.reason} »</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ========================================================== */}
      {/* 2. INTERFACE PC / TABLETTE                                 */}
      {/* ========================================================== */}
      <div className="hidden md:block space-y-8 w-full max-w-full overflow-x-hidden px-6 py-8">
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">Vue d'Ensemble Établissement</h1>
            <p className="text-slate-500 text-xs sm:text-sm font-medium">Pilotage de la structure scolaire</p>
          </div>
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm self-start sm:self-center">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-700">Données Réelles Alignées</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Élèves Inscrits" value={stats.totalStudents} icon={<Users />} color="bg-green-600" />
          <StatCard title="Classes Actives" value={stats.totalClasses} icon={<BookOpen />} color="bg-purple-600" />
          <StatCard title="Enseignants" value={stats.totalTeachers} icon={<UserCheck />} color="bg-blue-600" />
          <StatCard title="Taux Recouvrement" value={`${recoveryRate}%`} icon={<TrendingUp />} color="bg-emerald-500" />
          <StatCard title="Mois en cours" value={formattedMonth} icon={<Clock />} color="bg-orange-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-slate-100 pb-6">
              <div className="space-y-4">
                <div>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">Total Encaissé (Scolarités)</p>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                    {shouldHideFinancials ? '••••••' : `${new Intl.NumberFormat('fr-FR').format(stats.totalCollected)}`} <span className="text-sm font-medium text-slate-400">FCFA</span>
                  </h2>
                </div>
                <div>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">Total Dépenses Enregistrées</p>
                  <h2 className="text-2xl sm:text-3xl font-black text-rose-600 tracking-tight">
                    {shouldHideFinancials ? '••••••' : `${new Intl.NumberFormat('fr-FR').format(stats.totalExpenses)}`} <span className="text-sm font-medium text-rose-300">FCFA</span>
                  </h2>
                </div>
              </div>

              <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100 flex items-center gap-4 shrink-0 w-full sm:w-auto">
                <div className="relative flex items-center justify-center">
                  <svg viewBox="0 0 80 80" preserveAspectRatio="xMidYMid meet" className="w-20 h-20 block transform origin-center -rotate-90">
                    <circle cx="40" cy="40" r="32" className="text-slate-200/60" strokeWidth="8" stroke="currentColor" fill="transparent" />
                    <circle cx="40" cy="40" r="32" className="text-emerald-500 transition-all duration-1000" strokeWidth="8" strokeDasharray={2 * Math.PI * 32} strokeDashoffset={(2 * Math.PI * 32) - (recoveryRate / 100) * (2 * Math.PI * 32)} strokeLinecap="round" stroke="currentColor" fill="transparent" />
                  </svg>
                  <span className="absolute text-sm font-black text-slate-900">{recoveryRate}%</span>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800">Recouvrement</p>
                  <p className="text-[11px] font-medium text-slate-400 mt-0.5">Objectif Annuel Global :</p>
                  <p className="text-xs font-bold text-slate-700">
                    {shouldHideFinancials ? '••••••' : `${new Intl.NumberFormat('fr-FR').format(stats.totalExpected)} F`}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Trésorerie Disponible (Net)</p>
                <p className={`text-xl font-black ${netCaisse >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {shouldHideFinancials ? '••••••' : `${new Intl.NumberFormat('fr-FR').format(netCaisse)} FCFA`}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-rose-500 p-6 sm:p-8 rounded-[2rem] text-white shadow-xl shadow-rose-200 flex flex-col justify-between">
            <div>
              <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                <ArrowDownRight className="w-6 h-6" />
              </div>
              <p className="text-rose-100 font-bold text-xs uppercase tracking-widest mb-2">Fonds Dehors (Reste)</p>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight break-words">
                {shouldHideFinancials ? '••••••' : `${new Intl.NumberFormat('fr-FR').format(remaining)}`} 
                <span className="text-sm block text-rose-200 font-medium mt-1 uppercase">FCFA à recouvrer</span>
              </h2>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-950 text-base">Flux Financiers</h3>
              </div>
              <div className="space-y-3">
                {recentPayments.map((p) => (
                  <div key={p.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100/50 flex justify-between items-center text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{p.studentName}</p>
                      <p className="text-[10px] text-slate-400">{p.className}</p>
                    </div>
                    <span className="font-black text-emerald-600 shrink-0">
                      {shouldHideFinancials ? '••••••' : `+${new Intl.NumberFormat('fr-FR').format(p.amount)} F`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-950 text-base flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-500" /> Alertes Recouvrement
                </h3>
              </div>
              <div className="space-y-3">
                {criticalDebtors.map((d) => (
                  <div key={d.id} className="p-2.5 rounded-xl border border-rose-100 bg-rose-50/20 flex justify-between items-center text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{d.name}</p>
                      <p className="text-[10px] text-slate-500">{d.className}</p>
                    </div>
                    <span className="font-black text-rose-600 shrink-0">
                      {shouldHideFinancials ? '••••••' : `${new Intl.NumberFormat('fr-FR').format(d.debt)} F`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-950 text-base flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-indigo-600" /> Suivi Disciplinaire
                </h3>
              </div>
              <div className="space-y-3">
                {recentIncidents.map((i) => (
                  <div key={i.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col text-xs">
                    <div className="flex justify-between font-bold mb-0.5">
                      <span className="text-slate-900 truncate">{i.studentName}</span>
                      <span className={`text-[9px] px-1.5 rounded uppercase ${
                        i.severity === 'high' || i.severity === 'Grave' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>{i.severity || 'Normal'}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 italic line-clamp-1">« {i.reason} »</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-black text-slate-950 text-base sm:text-lg">Cartographie des Effectifs</h3>
              <p className="text-slate-400 text-xs font-medium">Nombre d'étudiants enregistrés par section sur cette année</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {classDistribution.length === 0 ? (
              <p className="text-xs font-medium text-slate-400 py-2 col-span-full">Aucune donnée de classe.</p>
            ) : (
              classDistribution.map((c, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-50/50 border border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 truncate">{c.name}</span>
                  <span className="text-xs font-black bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">{c.count} élèves</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all">
      <div className={`h-11 w-11 sm:h-12 sm:w-12 ${color} text-white rounded-xl flex items-center justify-center shadow-md shrink-0`}>
        {cloneElement(icon, { className: "w-5 h-5" })}
      </div>
      <div className="min-w-0">
        <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">{title}</p>
        <p className="text-lg sm:text-xl font-black text-slate-950 truncate mt-0.5">{value}</p>
      </div>
    </div>
  );
}