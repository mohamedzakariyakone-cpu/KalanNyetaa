"use client";

import { useState, useEffect, cloneElement } from 'react';
import { supabase } from '@/utils/supabase';
import { useYear } from '@/context/YearContext';
import { 
  Users, TrendingUp, Clock, 
  ArrowDownRight, 
  AlertTriangle, Calendar, UserCheck, ShieldAlert, Activity
} from 'lucide-react';

export default function Dashboard() {
  const { selectedYearId } = useYear();
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

  const currentMonth = new Date().toLocaleDateString('fr-FR', { month: 'long' });
  const formattedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  useEffect(() => {
    if (selectedYearId) {
      fetchDashboardData();
    }
  }, [selectedYearId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Récupération des élèves
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, first_name, last_name, scolarite_totale, scolarite_payee, class_id')
        .eq('academic_year_id', selectedYearId);
      if (studentsError) throw studentsError;

      // 2. Récupération des classes
      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('academic_year_id', selectedYearId);
      if (classesError) throw classesError;

      // 3. Récupération des enseignants
      const { count: teacherCount } = await supabase
        .from('teachers')
        .select('*', { count: 'exact', head: true })
        .eq('academic_year_id', selectedYearId);

      // 4. Récupération des paiements
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('id, amount, created_at, student_id')
        .eq('academic_year_id', selectedYearId)
        .order('created_at', { ascending: false });
      if (paymentsError) throw paymentsError;

      // 5. Récupération des dépenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('academic_year_id', selectedYearId);

      // 6. CORRECTION : Utilisation de .range(0, 2) au lieu de .slice(0, 3) pour limiter à 3 incidents
      const { data: discipline } = await supabase
        .from('discipline')
        .select('id, reason, severity, incident_date, student_id')
        .eq('academic_year_id', selectedYearId)
        .order('incident_date', { ascending: false })
        .range(0, 2); 

      // --- TRAITEMENT DES MAPS EN MÉMOIRE ---
      const classMap: Record<string, string> = {};
      classes?.forEach((c: { id: string | number; name: string; }) => { classMap[c.id] = c.name; });

      const studentMap: Record<string, { fullName: string, className: string }> = {};
      students?.forEach((s: { id: string | number; first_name: any; last_name: any; class_id: string | number; }) => {
        studentMap[s.id] = {
          fullName: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Élève Sans Nom',
          className: classMap[s.class_id] || 'Sans classe'
        };
      });

      // Calculs financiers globaux
      const expected = students?.reduce((acc: number, s: any) => acc + Number(s.scolarite_totale || 0), 0) || 0;
      const collected = students?.reduce((acc: number, s: any) => acc + Number(s.scolarite_payee || 0), 0) || 0;
      const totalExp = expenses?.reduce((acc: number, e: any) => acc + Number(e.amount || 0), 0) || 0;

      // Top 4 des impayés critiques (Traitement sur le tableau JS clean avec slice)
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

      // Répartition des effectifs par classe
      const distribution = (classes || []).map((c: any) => {
        const count = (students || []).filter((s: any) => s.class_id === c.id).length;
        return { name: c.name, count };
      });

      // Formatage historique des flux récents (Sécurisé sur l'array JS résultant)
      const enrichedPayments = (payments || []).slice(0, 4).map((p: any) => ({
        id: p.id,
        amount: p.amount,
        created_at: p.created_at,
        studentName: studentMap[p.student_id]?.fullName || 'Élève Anonyme',
        className: studentMap[p.student_id]?.className || 'N/A'
      }));

      // Formatage incidents disciplinaires
      const enrichedIncidents = (discipline || []).map((d: any) => ({
        id: d.id,
        reason: d.reason,
        severity: d.severity,
        date: d.incident_date,
        studentName: studentMap[d.student_id]?.fullName || 'Élève'
      }));

      setStats({
        totalStudents: students?.length || 0,
        totalClasses: classes?.length || 0,
        totalTeachers: teacherCount || 0,
        totalCollected: collected,
        totalExpected: expected,
        totalExpenses: totalExp
      });
      setRecentPayments(enrichedPayments);
      setCriticalDebtors(debtors);
      setClassDistribution(distribution);
      setRecentIncidents(enrichedIncidents);

    } catch (error) {
      console.error('Erreur lors du chargement du dashboard complet:', error);
    } finally {
      setLoading(false);
    }
  };

  const remaining = stats.totalExpected - stats.totalCollected;
  const recoveryRate = stats.totalExpected > 0 ? Math.round((stats.totalCollected / stats.totalExpected) * 100) : 0;
  const netCaisse = stats.totalCollected - stats.totalExpenses;

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Calcul des indicateurs métiers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full max-w-full overflow-x-hidden px-1 py-2 sm:px-0 bg-slate-50/50">
      
      {/* Header */}
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

      {/* Cartes Clés Réelles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard title="Élèves Inscrits" value={stats.totalStudents} icon={<Users />} color="bg-green-600" />
        <StatCard title="Enseignants" value={stats.totalTeachers} icon={<UserCheck />} color="bg-blue-600" />
        <StatCard title="Taux Recouvrement" value={`${recoveryRate}%`} icon={<TrendingUp />} color="bg-emerald-500" />
        <StatCard title="Mois en cours" value={formattedMonth} icon={<Clock />} color="bg-orange-500" />
      </div>

      {/* Vue Trésorerie Avancée */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Module Recettes Globales */}
        <div className="lg:col-span-2 bg-white p-6 sm:p-10 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-slate-100 pb-6">
            <div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">Total Encaissé (Scolarités)</p>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
                {new Intl.NumberFormat('fr-FR').format(stats.totalCollected)} <span className="text-sm font-medium text-slate-400">FCFA</span>
              </h2>
            </div>
            <div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">Total Dépenses Enregistrées</p>
              <h2 className="text-2xl sm:text-4xl font-black text-rose-600 tracking-tight">
                {new Intl.NumberFormat('fr-FR').format(stats.totalExpenses)} <span className="text-sm font-medium text-rose-300">FCFA</span>
              </h2>
            </div>
          </div>

          <div className="pt-6 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Trésorerie Disponible (Net)</p>
              <p className={`text-xl font-black ${netCaisse >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {new Intl.NumberFormat('fr-FR').format(netCaisse)} FCFA
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-500">Objectif Annuel : {new Intl.NumberFormat('fr-FR').format(stats.totalExpected)} F</span>
              <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden mt-1">
                <div className="bg-emerald-500 h-full" style={{ width: `${recoveryRate}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Module Reste à Percevoir */}
        <div className="bg-rose-500 p-6 sm:p-10 rounded-[2rem] text-white shadow-xl shadow-rose-200 flex flex-col justify-between">
          <div>
            <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
              <ArrowDownRight className="w-6 h-6" />
            </div>
            <p className="text-rose-100 font-bold text-xs uppercase tracking-widest mb-2">Fonds Dehors (Reste)</p>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight break-words">
              {new Intl.NumberFormat('fr-FR').format(remaining)} 
              <span className="text-sm block text-rose-200 font-medium mt-1 uppercase">FCFA à recouvrer</span>
            </h2>
          </div>
        </div>
      </div>

      {/* Modules de Listes Métiers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Colonne 1 : Flux Récents */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-950 text-base">Flux Financiers</h3>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Encaissements</span>
            </div>
            <div className="space-y-3">
              {recentPayments.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Aucun flux récent.</p>
              ) : (
                recentPayments.map((p) => (
                  <div key={p.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100/50 flex justify-between items-center text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{p.studentName}</p>
                      <p className="text-[10px] text-slate-400">{p.className}</p>
                    </div>
                    <span className="font-black text-emerald-600 shrink-0">+{new Intl.NumberFormat('fr-FR').format(p.amount)} F</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Colonne 2 : Impayés Critiques */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-950 text-base flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" /> Alertes Recouvrement
              </h3>
            </div>
            <div className="space-y-3">
              {criticalDebtors.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Aucun retard critique.</p>
              ) : (
                criticalDebtors.map((d) => (
                  <div key={d.id} className="p-2.5 rounded-xl border border-rose-100 bg-rose-50/20 flex justify-between items-center text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{d.name}</p>
                      <p className="text-[10px] text-slate-500">{d.className}</p>
                    </div>
                    <span className="font-black text-rose-600 shrink-0">{new Intl.NumberFormat('fr-FR').format(d.debt)} F</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Colonne 3 : Vie Scolaire & Discipline */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-950 text-base flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-indigo-600" /> Suivi Disciplinaire
              </h3>
            </div>
            <div className="space-y-3">
              {recentIncidents.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Rien à signaler (discipline OK).</p>
              ) : (
                recentIncidents.map((i) => (
                  <div key={i.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col text-xs">
                    <div className="flex justify-between font-bold mb-0.5">
                      <span className="text-slate-900 truncate">{i.studentName}</span>
                      <span className={`text-[9px] px-1.5 rounded uppercase ${
                        i.severity === 'high' || i.severity === 'Grave' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>{i.severity || 'Normal'}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 italic line-clamp-1">« {i.reason} »</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Distribution Globale Des Classes */}
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
  );
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all">
      <div className={`h-11 w-11 sm:h-12 sm:w-12 ${color} text-white rounded-xl flex items-center justify-center shadow-md shrink-0`}>
        {cloneElement(icon, { className: "w-5 h-5" })}
      </div>
      <div className="min-w-0">
        <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">{title}</p>
        <p className="text-lg sm:text-2xl font-black text-slate-950 truncate mt-0.5">{value}</p>
      </div>
    </div>
  );
}