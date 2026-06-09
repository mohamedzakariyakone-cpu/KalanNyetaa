'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { useYear } from '@/context/YearContext';
import {
  Target, Loader2, MessageSquare, Search, BellRing, AlertTriangle,
  Zap, Users, Landmark, ArrowUpRight, PieChart, Lock, Calendar, Plus, X, Trash2, TrendingDown, Wallet, Users2
} from 'lucide-react';

// --- Composants UI Internes Optimisés ---

const GlassCard = ({ children, title, icon: Icon, className = "" }: { children: React.ReactNode, title?: string, icon?: React.ElementType, className?: string }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all w-full ${className}`}>
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">{title}</h3>
      {Icon && <div className="p-2 bg-slate-50 rounded-xl text-slate-900"><Icon size={16} /></div>}
    </div>
    {children}
  </div>
);

const ProgressBar = ({ progress, color = "bg-indigo-600" }: { progress: number, color?: string }) => (
  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
    <div 
      className={`h-full transition-all duration-1000 ${color}`} 
      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} 
    />
  </div>
);

interface Payment {
  amount?: string | number;
  created_at: string;
}

interface ClassRelation {
  name?: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  parent_phone?: string;
  annual_fee?: string | number;
  payment_plan_tranches?: string | number;
  payments?: Payment[];
  classes?: ClassRelation | ClassRelation[];
}

interface Expense {
  id?: string;
  amount?: string | number;
  created_at?: string;
  description?: string;
}

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
  salary?: string | number;
}

interface Settings {
  current_month_index?: number;
}

interface ProcessedStudent extends Student {
  totalPaid: number;
  className: string;
  annual_fee: number;
}

interface ClassPerformance {
  name: string;
  percent: number;
}

interface Analytics {
  totalPotential: number;
  collected: number;
  expectedMonth: number;
  collectedMonth: number;
  healthScore: number;
  runway: number;
  totalExpenses: number;
  monthlySalaries: number;
  annualSalaries: number;
  netCash: number;
  classPerformance: ClassPerformance[];
  processedStudents: ProcessedStudent[];
}

export default function CFODashboardUltraResponsive() {
  const [students, setStudents] = useState<Student[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expDesc, setExpDesc] = useState('');
  
  // Géré en string pour afficher les espaces en temps réel
  const [expAmount, setExpAmount] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [expenseSearchTerm, setExpenseSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'students' | 'expenses'>('students');
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const { selectedYearId, isReadOnly, isLoading: yearLoading, selectedYear } = useYear();

  // Fonction de formatage en direct (ajoute des espaces tous les 3 chiffres)
  const formatNumberInput = (value: string) => {
    // Supprime tout ce qui n'est pas un chiffre
    const cleanValue = value.replace(/\D/g, '');
    if (!cleanValue) return '';
    // Formate avec le séparateur de milliers (espace)
    return new Intl.NumberFormat('fr-FR').format(parseInt(cleanValue, 10));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatNumberInput(e.target.value);
    setExpAmount(formatted);
  };

  const fetchData = useCallback(async () => {
    if (!selectedYearId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileErr) throw profileErr;
      const schoolId = profile?.school_id;

      const { data: sData, error: sErr } = await supabase
        .from('school_settings')
        .select('*')
        .eq('school_id', schoolId)
        .maybeSingle();
      
      if (sErr) throw sErr;
      
      setSettings(sData || { current_month_index: new Date().getMonth() + 1 });

      const [studentsRes, expensesRes, teachersRes] = await Promise.all([
        supabase.from('students').select('*, payments(amount, created_at), classes(name)').eq('academic_year_id', selectedYearId),
        supabase.from('expenses').select('*').eq('academic_year_id', selectedYearId).order('created_at', { ascending: false }),
        supabase.from('teachers').select('id, first_name, last_name, salary').eq('academic_year_id', selectedYearId)
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (teachersRes.error) throw teachersRes.error;

      setStudents((studentsRes.data as Student[]) || []);
      setExpenses((expensesRes.data as Expense[]) || []);
      setTeachers((teachersRes.data as Teacher[]) || []);
    } catch (err: unknown) {
      console.error("Erreur de chargement:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedYearId]);

  useEffect(() => { 
    if (!yearLoading && selectedYearId) {
      fetchData(); 
    }
  }, [fetchData, yearLoading, selectedYearId]);

  const analytics = useMemo(() => {
    const totalExp = expenses.reduce((sum: number, e: Expense) => sum + (Number(e.amount) || 0), 0);
    const monthlySalaries = teachers.reduce((sum: number, t: Teacher) => sum + (Number(t.salary) || 0), 0);
    const annualSalaries = monthlySalaries * 10; 

    if (!students.length) return { 
      totalPotential: 0, collected: 0, expectedMonth: 0, 
      collectedMonth: 0, healthScore: 0, runway: 0, totalExpenses: totalExp, 
      monthlySalaries, annualSalaries, netCash: -totalExp,
      classPerformance: [], processedStudents: []
    };

    const now = new Date();
    const currentMonth = settings?.current_month_index || (now.getMonth() + 1);
    
    let totalPotential = 0;
    let collected = 0;
    let expectedMonth = 0;
    let collectedMonth = 0;

    const classStats: Record<string, { total: number; paid: number }> = {};

    const processedStudents: ProcessedStudent[] = students.map((s) => {
      const fee = Number(s.annual_fee) || 0;
      const pays = s.payments || [];
      const totalPaid = pays.reduce((sum: number, p: Payment) => sum + (Number(p.amount) || 0), 0);
      const className = Array.isArray(s.classes) 
        ? (s.classes[0]?.name || "Sans Classe") 
        : (s.classes?.name || "Sans Classe");
      
      totalPotential += fee;
      collected += Math.min(totalPaid, fee);
      const tranches = Number(s.payment_plan_tranches) || 1;
      if (tranches === 9 && currentMonth <= 9) expectedMonth += (fee / 9);
      else if (tranches === 3 && [1, 5, 9].includes(currentMonth)) expectedMonth += (fee / 3);
      
      const paidMonth = pays.filter((p: Payment) => {
        const d = new Date(p.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).reduce((sum: number, p: Payment) => sum + (Number(p.amount) || 0), 0);
      collectedMonth += paidMonth;

      if (!classStats[className]) classStats[className] = { total: 0, paid: 0 };
      classStats[className].total += fee;
      classStats[className].paid += totalPaid;
      return { ...s, totalPaid, className, annual_fee: fee };
    });

    const burnRate = (totalExp / 6) + monthlySalaries;
    const runway = (collected - totalExp) / (burnRate || 1);
    const netCash = collected - totalExp;

    return {
      totalPotential,
      collected,
      expectedMonth,
      collectedMonth,
      totalExpenses: totalExp,
      monthlySalaries,
      annualSalaries,
      netCash,
      runway: Math.max(0, runway),
      healthScore: totalPotential > 0 ? Math.round((collected / totalPotential) * 100) : 0,
      classPerformance: Object.entries(classStats).map(([name, stats]) => ({
        name,
        percent: Math.round((stats.paid / stats.total) * 100) || 0
      })).sort((a, b) => b.percent - a.percent),
      processedStudents
    } as Analytics;
  }, [students, expenses, teachers, settings]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Nettoyage de la valeur : on retire tous les espaces pour avoir le vrai nombre entier
    const numericAmount = parseInt(expAmount.replace(/\s/g, ''), 10);

    if (!expDesc || isNaN(numericAmount) || numericAmount <= 0 || !selectedYearId) {
      alert('Tous les champs sont requis');
      return;
    }
    if (isReadOnly) {
      alert('Impossible d\'ajouter une dépense en mode lecture seule');
      return;
    }
    
    setIsSubmittingExpense(true);
    const { error } = await supabase.from('expenses').insert([{ 
      description: expDesc, 
      amount: numericAmount, // Envoi du nombre propre à Supabase
      academic_year_id: selectedYearId
    }]);
    setIsSubmittingExpense(false);
    if (error) {
      alert(`Erreur : ${error.message}`);
      return;
    }

    setExpDesc('');
    setExpAmount('');
    setShowAddExpenseModal(false);
    fetchData();
  };

  const handleDeleteExpense = async (id: string) => {
    if (isReadOnly) return;
    if (!confirm('Voulez-vous vraiment supprimer cette dépense ?')) return;

    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) {
      alert(`Erreur: ${error.message}`);
      return;
    }
    fetchData();
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => 
      (e.description || '').toLowerCase().includes(expenseSearchTerm.toLowerCase())
    );
  }, [expenses, expenseSearchTerm]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-white">
      <Loader2 className="animate-spin text-indigo-600" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 w-full overflow-x-hidden pb-12">
      <div className="w-full max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 px-4 sm:px-0">
          <div className="w-full md:w-auto">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="text-indigo-600" size={16} fill="currentColor" />
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Comptabilité d'École</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black text-slate-900 uppercase italic leading-tight">
              Intelligence <span className="text-indigo-600">Financière</span>
            </h1>
            {selectedYear && !selectedYear.is_current && (
              <p className="text-[10px] font-bold text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle size={12} /> Année historique - Lecture seule
              </p>
            )}
          </div>
  
          <div className="flex gap-2 w-full md:w-auto">
            {isReadOnly && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-xl text-[11px] font-bold">
                <Lock size={13} className="shrink-0" /> Lecture seule
              </div>
            )}
            <button onClick={fetchData} disabled={yearLoading} className="flex-1 md:flex-none px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-sm text-center active:scale-95 transition-transform">
              Actualiser
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-4 sm:mx-0 bg-rose-50 border border-rose-100 text-rose-600 p-3.5 rounded-xl text-xs font-bold mb-6 flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Grille Principale */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-3 sm:gap-6 px-4 sm:px-0">
          <div className="col-span-2 lg:col-span-3 bg-slate-900 rounded-2xl p-5 text-white flex flex-col items-center justify-center shadow-sm text-center">
            <div className="text-3xl sm:text-4xl font-black italic text-green-400">{analytics.healthScore}%</div>
            <div className="text-[9px] font-bold uppercase mt-1 opacity-60 tracking-widest">Recouvrement Annuel</div>
            <ProgressBar progress={analytics.healthScore} color="bg-green-400" />
          </div>
        
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-1 lg:col-span-3">
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-tight">Trésorerie Actuelle</p>
              <div className={`text-base sm:text-xl font-black italic mt-1 truncate ${analytics.netCash >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {analytics.netCash.toLocaleString()} F
              </div>
            </div>
            <div className="text-[8px] text-slate-400 font-bold uppercase mt-2 flex items-center gap-1">
              <Wallet size={12} className="text-slate-400" /> Reste après dépenses
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-1 lg:col-span-3">
            <div>
              <p className="text-[9px] font-black uppercase text-rose-400 tracking-tight">Total Sorties (Dépenses)</p>
              <div className="text-base sm:text-xl font-black italic text-rose-600 mt-1 truncate">
                {analytics.totalExpenses.toLocaleString()} F
              </div>
            </div>
            <div className="text-[8px] text-slate-400 font-bold uppercase mt-2 flex items-center gap-1">
              <TrendingDown size={12} className="text-rose-400" /> Sorties cumulées
            </div>
          </div>

          <GlassCard title="Autonomie (Runway)" icon={Landmark} className="col-span-2 lg:col-span-3">
            <div className="text-xl font-black italic text-slate-900">{analytics.runway.toFixed(1)} <span className="text-xs uppercase font-semibold">Mois</span></div>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase italic">Survie de la caisse</p>
          </GlassCard>
        </div>

        {/* Charges Salariales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 sm:mt-6 px-4 sm:px-0">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Masse Salariale Mensuelle</p>
              <div className="text-xl sm:text-2xl font-black italic text-indigo-600">{analytics.monthlySalaries.toLocaleString()} F</div>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Salaires bruts cumulés / mois</p>
            </div>
            <div className="p-3.5 bg-indigo-50 rounded-2xl text-indigo-600 hidden sm:block">
              <Users2 size={24} />
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Masse Salariale Annuelle</p>
              <div className="text-xl sm:text-2xl font-black italic text-indigo-800">{analytics.annualSalaries.toLocaleString()} F</div>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Projection sur 10 mois de cours</p>
            </div>
            <div className="p-3.5 bg-indigo-50 rounded-2xl text-indigo-800 hidden sm:block">
              <Calendar size={24} />
            </div>
          </div>
        </div>

        {/* Objectifs Mensuels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 sm:mt-6 px-4 sm:px-0">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Encaissé ce Mois</p>
            <div className="text-xl sm:text-2xl font-black italic text-slate-900">{analytics.collectedMonth.toLocaleString()} F</div>
            <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-green-600">
              <ArrowUpRight size={14} /> {analytics.expectedMonth > 0 ? Math.round((analytics.collectedMonth / analytics.expectedMonth) * 100) : 0}% de l'objectif
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Objectif Attendu ce Mois</p>
            <div className="text-xl sm:text-2xl font-black italic text-slate-900">{analytics.expectedMonth.toLocaleString()} F</div>
            <div className="mt-2 text-[10px] font-bold text-slate-400 italic">Calculé selon les échelonnements</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm sm:col-span-2 lg:col-span-1">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Potentiel Général Annuel</p>
            <div className="text-xl font-black italic text-slate-900">{analytics.totalPotential.toLocaleString()} F</div>
            <div className="text-[9px] font-black uppercase text-emerald-600 mt-1">Déjà encaissé : {analytics.collected.toLocaleString()} F</div>
          </div>
        </div>

        {/* Onglets Mobile */}
        <div className="flex border-b border-slate-200 mt-6 sm:hidden bg-white sticky top-0 z-20 shadow-xs">
          <button 
            onClick={() => setActiveTab('students')}
            className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-wider transition-colors ${activeTab === 'students' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-400'}`}
          >
            Élèves ({analytics.processedStudents.length})
          </button>
          <button 
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-wider transition-colors ${activeTab === 'expenses' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-400'}`}
          >
            Dépenses ({expenses.length})
          </button>
        </div>

        {/* Blocs de contenu */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4 sm:mt-6">
          
          {/* SECTION 1 : EXPENSES */}
          <div className={`lg:col-span-4 flex flex-col gap-6 px-4 sm:px-0 ${activeTab === 'expenses' ? 'block' : 'hidden sm:block'}`}>
            
            {/* Formulaire avec sépérateur natif en temps réel */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black uppercase text-slate-400 italic tracking-widest">Enregistrer une Sortie</h3>
                <PieChart size={14} className="text-slate-400" />
              </div>
              <form onSubmit={handleAddExpense} className="space-y-3">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Motif de la dépense</label>
                  <input 
                    type="text" placeholder="Ex: Fournitures, Facture Électricité, Maintenance..."
                    className="w-full p-3 bg-slate-50 rounded-xl border-0 text-xs font-bold outline-none focus:ring-2 ring-indigo-100 disabled:opacity-50"
                    value={expDesc} onChange={(e) => setExpDesc(e.target.value)}
                    disabled={isReadOnly}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Montant (FCFA)</label>
                  {/* Input HTML classique mais géré avec notre fonction de formatage en direct */}
                  <input 
                    type="text" 
                    placeholder="Montant décaissé..."
                    className="w-full p-3 bg-slate-50 rounded-xl border-0 text-xs font-black text-rose-600 outline-none focus:ring-2 ring-indigo-100 disabled:opacity-50"
                    value={expAmount}
                    onChange={handleAmountChange}
                    disabled={isReadOnly}
                    required
                  />
                </div>
                <button type="submit" disabled={isReadOnly || isSubmittingExpense} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wide disabled:opacity-50 shadow-sm active:scale-98 transition-transform">
                  {isSubmittingExpense ? 'Enregistrement...' : isReadOnly ? 'Mode lecture seule' : 'Enregistrer la Sortie'}
                </button>
              </form>
            </div>

            {/* Historique */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-1">
              <div className="flex flex-col gap-2 mb-4">
                <h3 className="text-[10px] font-black uppercase text-slate-400 italic tracking-widest">Historique Journalier des Dépenses</h3>
                <div className="relative w-full mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                  <input 
                    type="text" placeholder="Filtrer les dépenses..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl text-[11px] font-semibold outline-none"
                    value={expenseSearchTerm} onChange={(e) => setExpenseSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-[450px] overflow-y-auto no-scrollbar pr-1">
                {filteredExpenses.length === 0 ? (
                  <p className="text-[11px] font-semibold text-slate-400 text-center py-4">Aucune dépense répertoriée.</p>
                ) : filteredExpenses.map((ex, i) => (
                  <div key={ex.id || i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-[11px] font-black text-slate-800 uppercase truncate italic">{ex.description}</p>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-0.5">
                        <Calendar size={10} />
                        <span>{formatDate(ex.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] font-black text-rose-600">-{Number(ex.amount).toLocaleString()} F</span>
                      {!isReadOnly && (
                        <button 
                          onClick={() => ex.id && handleDeleteExpense(ex.id)}
                          className="p-1 text-slate-300 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance */}
            <GlassCard title="Performance de collecte par Classe" icon={Users} className="hidden lg:block">
              <div className="space-y-3.5">
                {analytics.classPerformance.map((c: ClassPerformance, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-14 text-[9px] font-black text-slate-900 uppercase truncate">{c.name}</div>
                    <div className="flex-1"><ProgressBar progress={c.percent} color={c.percent > 70 ? "bg-green-500" : "bg-indigo-500"} /></div>
                    <div className="w-8 text-[9px] font-black text-slate-400 text-right">{c.percent}%</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* SECTION 2 : REGISTRE ETUDIANTS */}
          <div className={`lg:col-span-8 px-4 sm:px-0 ${activeTab === 'students' ? 'block' : 'hidden sm:block'}`}>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm w-full">
              
              <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900">Registre Global de Scolarité</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Suivi des paiements individuels et relances WhatsApp</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                  <input 
                    type="text" placeholder="Rechercher un élève..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl border-none text-xs font-bold outline-none focus:ring-1 ring-indigo-500"
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* VUE SMARTPHONE */}
              <div className="block sm:hidden divide-y divide-slate-100">
                {analytics.processedStudents
                  .filter((s: ProcessedStudent) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                    <p className="text-xs text-center text-slate-400 py-8 font-semibold">Aucun élève trouvé.</p>
                  ) : analytics.processedStudents
                  .filter((s: ProcessedStudent) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((s: ProcessedStudent) => {
                    const remaining = s.annual_fee - s.totalPaid;
                    return (
                      <div key={s.id} className="p-4 flex flex-col gap-3 bg-white">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="text-xs font-black uppercase text-slate-900">{s.last_name} {s.first_name}</div>
                            <span className="inline-block px-1.5 py-0.5 bg-slate-100 rounded text-[8px] font-black text-slate-500 uppercase mt-1">{s.className}</span>
                          </div>
                          <button 
                            onClick={() => {
                              const msg = encodeURIComponent(`Bonjour, rappel pour la scolarité de ${s.first_name}. Solde restant : ${remaining.toLocaleString()} F. Merci de régulariser.`);
                              window.open(`https://wa.me/${s.parent_phone?.replace(/\D/g,'')}?text=${msg}`, '_blank');
                            }}
                            className="p-2 bg-indigo-50 text-indigo-600 rounded-xl active:scale-90 transition-transform shrink-0"
                          >
                            <MessageSquare size={14} />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[10px] bg-slate-50 p-2 rounded-xl">
                          <div>
                            <span className="text-slate-400 text-[8px] block uppercase font-bold">Scolarité</span>
                            <span className="font-bold text-slate-800">{s.annual_fee.toLocaleString()} F</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[8px] block uppercase font-bold">Payé</span>
                            <span className="font-black text-emerald-600">{s.totalPaid.toLocaleString()} F</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[8px] block uppercase font-bold">Reste</span>
                            <span className={`font-black ${remaining > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                              {remaining.toLocaleString()} F
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* VUE DESKTOP */}
              <div className="hidden sm:block w-full overflow-x-auto">
                <table className="w-full text-left min-w-full">
                  <thead>
                    <tr className="bg-slate-50/70 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                      <th className="px-5 py-3.5">Élève</th>
                      <th className="px-4 py-3.5">Classe</th>
                      <th className="px-4 py-3.5">Frais Annuel</th>
                      <th className="px-4 py-3.5">Encaissé</th>
                      <th className="px-4 py-3.5">Reste à payer</th>
                      <th className="px-5 py-3.5 text-right">Relance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.processedStudents
                      .filter((s: ProcessedStudent) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-xs text-center text-slate-400 py-8 font-semibold">Aucun élève trouvé.</td>
                        </tr>
                      ) : analytics.processedStudents
                      .filter((s: ProcessedStudent) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((s: ProcessedStudent) => {
                        const remaining = s.annual_fee - s.totalPaid;
                        return (
                          <tr key={s.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="text-[10px] font-black text-slate-900 uppercase tracking-wide">{s.last_name} {s.first_name}</div>
                              <div className="text-[8px] font-bold text-slate-400 mt-0.5">{s.parent_phone || 'Pas de numéro'}</div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-[8px] font-black text-slate-600 uppercase tracking-tight">{s.className}</span>
                            </td>
                            <td className="px-4 py-3.5 text-[10px] font-bold text-slate-700">{s.annual_fee.toLocaleString()} F</td>
                            <td className="px-4 py-3.5">
                              <div className="text-[10px] font-black text-emerald-600">{s.totalPaid.toLocaleString()} F</div>
                              <div className="text-[7px] font-bold text-slate-300 italic">{Math.round((s.totalPaid / s.annual_fee) * 100 || 0)}% réglé</div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`text-[10px] font-black ${remaining > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {remaining.toLocaleString()} F
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button 
                                onClick={() => {
                                  const msg = encodeURIComponent(`Bonjour, rappel pour la scolarité de ${s.first_name}. Solde restant : ${remaining.toLocaleString()} F.`);
                                  window.open(`https://wa.me/${s.parent_phone?.replace(/\D/g,'')}?text=${msg}`, '_blank');
                                }}
                                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                              >
                                <MessageSquare size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Campagne WhatsApp */}
            <div className="bg-indigo-600 rounded-2xl p-5 text-white shadow-md relative overflow-hidden mt-6 mx-4 sm:mx-0">
              <div className="relative z-10 w-full">
                <h3 className="text-base sm:text-lg font-black italic uppercase mb-1">Campagne de Rappels Globale</h3>
                <p className="text-indigo-100 text-[10px] mb-4 opacity-90 leading-relaxed">
                  Pour relancer tous les parents en retard en un seul clic :
                </p>
                <div className="space-y-2 mb-4 bg-indigo-700/50 p-3 rounded-xl border border-indigo-500/30">
                  <div className="flex items-start gap-2">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-black text-indigo-600">1</span>
                    <p className="text-[10px] font-medium text-indigo-50">Créez votre liste de diffusion <strong>"Parents en Retard"</strong> dans WhatsApp.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-black text-indigo-600">2</span>
                    <p className="text-[10px] font-medium text-indigo-50">Ouvrez l'application pour y coller votre message.</p>
                  </div>
                </div>
                <button 
                  onClick={() => window.open('whatsapp://', '_blank')}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase shadow-xs active:scale-95 transition-transform text-center block"
                >
                  Ouvrir l'application WhatsApp
                </button>
              </div>
              <BellRing className="absolute right-[-15px] bottom-[-15px] text-white opacity-10" size={110} />
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}