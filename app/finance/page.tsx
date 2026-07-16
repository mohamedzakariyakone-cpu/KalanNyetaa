'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { offlineFetch, offlineWrite } from '@/utils/offlineApi';
import { useCacheRefresh } from '@/hooks/useCacheRefresh';
import { useYear } from '@/context/YearContext';
import {
  Target, Loader2, MessageSquare, Search, BellRing, AlertTriangle,
  Zap, Users, Landmark, ArrowUpRight, PieChart, Lock, Calendar, Plus, X, Trash2, TrendingDown, Wallet, Users2,
  BarChart3, TrendingUp, Eye, EyeOff, RotateCcw, Download, Filter
} from 'lucide-react';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const EXPENSE_CATEGORIES = [
  'Fournitures',
  'Électricité',
  'Eau',
  'Maintenance',
  'Transport',
  'Télécommunications',
  'Assurance',
  'Autre'
];

// --- Composants UI Internes Optimisés ---

const GlassCard = ({ children, title, icon: Icon, className = "", action }: { children: React.ReactNode, title?: string, icon?: React.ElementType, className?: string, action?: React.ReactNode }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all w-full ${className}`}>
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">{title}</h3>
      <div className="flex items-center gap-2">
        {action}
        {Icon && <div className="p-2 bg-slate-50 rounded-xl text-slate-900"><Icon size={16} /></div>}
      </div>
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
  category?: string;
  expense_date?: string;
  is_deleted?: boolean;
  deleted_at?: string;
  school_id?: string;
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
  selectedPeriodLabel: string;
  selectedPeriodCollected: number;
  selectedPeriodTarget: number;
  selectedPeriodProgress: number;
  monthlyExpenses: number;
  healthScore: number;
  runway: number;
  totalExpenses: number;
  monthlySalaries: number;
  annualSalaries: number;
  netCash: number;
  classPerformance: ClassPerformance[];
  processedStudents: ProcessedStudent[];
  expensesByCategory: Record<string, number>;
  averageExpense: number;
  expenseCount: number;
  monthlyAverageExpense: number;
}

export default function CFODashboardImproved() {
  const [students, setStudents] = useState<Student[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [deletedExpenses, setDeletedExpenses] = useState<Expense[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('Autre');
  const [searchTerm, setSearchTerm] = useState('');
  const [expenseSearchTerm, setExpenseSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'students' | 'expenses'>('students');
  const [viewMode, setViewMode] = useState<'annual' | 'monthly'>('annual');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(new Date().getMonth());
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [showDeletedOnly, setShowDeletedOnly] = useState(false);
  const { selectedYearId, isReadOnly, isLoading: yearLoading, selectedYear } = useYear();

  const formatNumberInput = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    if (!cleanValue) return '';
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

      const { data: sData, error: sErr } = await offlineFetch<Settings | null>(`finance_settings:${schoolId}`, async () => {
        return await supabase
          .from('school_settings')
          .select('*')
          .eq('school_id', schoolId)
          .maybeSingle();
      });
      
      if (sErr) throw sErr;
      setSettings(sData || { current_month_index: new Date().getMonth() + 1 });

      const { data: studentsData, error: studentsError } = await offlineFetch<Student[]>(`finance_students:${selectedYearId}`, async () => {
        return await supabase
          .from('students')
          .select('*, payments(amount, created_at), classes(name)')
          .eq('academic_year_id', selectedYearId);
      });

      // Récupérer les dépenses actives (non supprimées) filtrées par school_id
      const { data: expensesData, error: expensesError } = await offlineFetch<Expense[]>(`finance_expenses:${selectedYearId}`, async () => {
        return await supabase
          .from('expenses')
          .select('*')
          .eq('academic_year_id', selectedYearId)
          .eq('school_id', schoolId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });
      });

      // Récupérer les dépenses supprimées (corbeille)
      const { data: deletedData, error: deletedError } = await offlineFetch<Expense[]>(`finance_deleted_expenses:${selectedYearId}`, async () => {
        return await supabase
          .from('expenses')
          .select('*')
          .eq('academic_year_id', selectedYearId)
          .eq('school_id', schoolId)
          .eq('is_deleted', true)
          .order('deleted_at', { ascending: false });
      });

      const { data: teachersData, error: teachersError } = await offlineFetch<Teacher[]>(`finance_teachers:${selectedYearId}`, async () => {
        return await supabase
          .from('teachers')
          .select('id, first_name, last_name, salary')
          .eq('academic_year_id', selectedYearId);
      });

      if (studentsError) throw studentsError;
      if (expensesError) throw expensesError;
      if (deletedError) throw deletedError;
      if (teachersError) throw teachersError;

      setStudents(studentsData || []);
      setExpenses(expensesData || []);
      setDeletedExpenses(deletedData || []);
      setTeachers(teachersData || []);
    } catch (err: unknown) {
      console.error("Erreur de chargement:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedYearId]);

  const financeCacheKeys = useMemo(() => {
    if (!selectedYearId) return [];
    return [`finance_expenses:${selectedYearId}`, `finance_deleted_expenses:${selectedYearId}`, `finance_students:${selectedYearId}`, `finance_teachers:${selectedYearId}`];
  }, [selectedYearId]);

  useCacheRefresh({
    cacheKeys: financeCacheKeys,
    cachePattern: /^finance_/, 
    onInvalidate: () => fetchData(),
    debounceMs: 150,
    refreshOnFocus: true,
    refreshOnVisibilityChange: true,
    refreshIntervalMs: 120000,
  });

  useEffect(() => { 
    if (!yearLoading && selectedYearId) {
      fetchData(); 
    }
  }, [fetchData, yearLoading, selectedYearId]);

  const analytics = useMemo(() => {
    const totalExp = expenses.reduce((sum: number, e: Expense) => sum + (Number(e.amount) || 0), 0);
    const monthlySalaries = teachers.reduce((sum: number, t: Teacher) => sum + (Number(t.salary) || 0), 0);
    const annualSalaries = monthlySalaries * 10;

    // Calculer les dépenses par catégorie
    const expensesByCategory: Record<string, number> = {};
    expenses.forEach(exp => {
      const cat = exp.category || 'Autre';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (Number(exp.amount) || 0);
    });

    const averageExpense = expenses.length > 0 ? totalExp / expenses.length : 0;
    const monthlyAverageExpense = expenses.length > 0 ? totalExp / 12 : 0;

    if (!students.length) return {
      totalPotential: 0,
      collected: 0,
      expectedMonth: 0,
      collectedMonth: 0,
      selectedPeriodLabel: 'Année',
      selectedPeriodCollected: 0,
      selectedPeriodTarget: 0,
      selectedPeriodProgress: 0,
      monthlyExpenses: 0,
      healthScore: 0,
      runway: 0,
      totalExpenses: totalExp,
      monthlySalaries,
      annualSalaries,
      netCash: -totalExp,
      classPerformance: [],
      processedStudents: [],
      expensesByCategory,
      averageExpense,
      expenseCount: expenses.length,
      monthlyAverageExpense
    } as Analytics;

    const now = new Date();
    const selectedMonth = selectedMonthIndex;
    const selectedMonthName = MONTHS[selectedMonth];

    let totalPotential = 0;
    let collected = 0;
    let expectedMonth = 0;
    let collectedMonth = 0;
    let selectedPeriodCollected = 0;
    let selectedPeriodTarget = 0;
    let selectedMonthExpenses = 0;

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

      const baseTranches = Number(s.payment_plan_tranches) || 1;
      if (viewMode === 'annual') {
        if (baseTranches === 9 && now.getMonth() < 9) expectedMonth += (fee / 9);
        else if (baseTranches === 3 && [0, 4, 8].includes(now.getMonth())) expectedMonth += (fee / 3);
      } else {
        if (baseTranches === 9 && selectedMonth < 9) selectedPeriodTarget += (fee / 9);
        else if (baseTranches === 3 && [0, 4, 8].includes(selectedMonth)) selectedPeriodTarget += (fee / 3);
      }

      const paidMonth = pays.filter((p: Payment) => {
        const d = new Date(p.created_at);
        return d.getMonth() === selectedMonth && d.getFullYear() === now.getFullYear();
      }).reduce((sum: number, p: Payment) => sum + (Number(p.amount) || 0), 0);
      collectedMonth += paidMonth;
      selectedMonthExpenses += paidMonth;
      if (viewMode === 'monthly') selectedPeriodCollected += paidMonth;

      if (!classStats[className]) classStats[className] = { total: 0, paid: 0 };
      classStats[className].total += fee;
      classStats[className].paid += totalPaid;
      return { ...s, totalPaid, className, annual_fee: fee };
    });

    if (viewMode === 'annual') {
      selectedPeriodCollected = collected;
      selectedPeriodTarget = totalPotential;
    }

    const burnRate = (totalExp / 6) + monthlySalaries;
    const runway = (collected - totalExp) / (burnRate || 1);
    const netCash = collected - totalExp;

    return {
      totalPotential,
      collected,
      expectedMonth: selectedPeriodTarget,
      collectedMonth: selectedPeriodCollected,
      selectedPeriodLabel: viewMode === 'annual' ? 'Année' : selectedMonthName,
      selectedPeriodCollected,
      selectedPeriodTarget,
      selectedPeriodProgress: selectedPeriodTarget > 0 ? Math.round((selectedPeriodCollected / selectedPeriodTarget) * 100) : 0,
      monthlyExpenses: selectedMonthExpenses,
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
      processedStudents,
      expensesByCategory,
      averageExpense,
      expenseCount: expenses.length,
      monthlyAverageExpense
    } as Analytics;
  }, [students, expenses, teachers, settings, viewMode, selectedMonthIndex]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
    const { data, error } = await offlineWrite({
      table: 'expenses',
      action: 'INSERT',
      payload: [{
        description: expDesc,
        amount: numericAmount,
        category: expCategory,
        academic_year_id: selectedYearId,
        is_deleted: false
      }],
      cacheKey: `finance_expenses:${selectedYearId}`,
      optimisticUpdate: () => {
        setExpenses(prev => [{
          id: `temp-${Date.now()}`,
          description: expDesc,
          amount: numericAmount,
          category: expCategory,
          created_at: new Date().toISOString(),
          is_deleted: false
        }, ...prev]);
      }
    });
    setIsSubmittingExpense(false);
    if (error) {
      alert(`Erreur : ${error.message}`);
      return;
    }

    setExpDesc('');
    setExpAmount('');
    setExpCategory('Autre');
    setShowAddExpenseModal(false);
    fetchData();
  };

  const handleDeleteExpense = async (id: string) => {
    if (isReadOnly) return;
    if (!confirm('Voulez-vous vraiment supprimer cette dépense ?')) return;

    const { data, error } = await offlineWrite({
      table: 'expenses',
      action: 'UPDATE',
      payload: [{
        is_deleted: true,
        deleted_at: new Date().toISOString()
      }],
      options: {
        keyColumn: 'id',
        keyValue: id,
      },
      cacheKey: `finance_expenses:${selectedYearId}`,
      optimisticUpdate: () => {
        setExpenses(prev => prev.filter(exp => exp.id !== id));
        const deleted = expenses.find(e => e.id === id);
        if (deleted) {
          setDeletedExpenses(prev => [{ ...deleted, is_deleted: true, deleted_at: new Date().toISOString() }, ...prev]);
        }
      }
    });
    if (error) {
      alert(`Erreur: ${error.message}`);
      return;
    }
    fetchData();
  };

  const handleRestoreExpense = async (id: string) => {
    if (isReadOnly) return;

    const { data, error } = await offlineWrite({
      table: 'expenses',
      action: 'UPDATE',
      payload: [{
        is_deleted: false,
        deleted_at: null
      }],
      options: {
        keyColumn: 'id',
        keyValue: id,
      },
      cacheKey: `finance_expenses:${selectedYearId}`,
      optimisticUpdate: () => {
        const restored = deletedExpenses.find(e => e.id === id);
        if (restored) {
          setExpenses(prev => [{ ...restored, is_deleted: false }, ...prev]);
          setDeletedExpenses(prev => prev.filter(exp => exp.id !== id));
        }
      }
    });
    if (error) {
      alert(`Erreur: ${error.message}`);
      return;
    }
    fetchData();
  };

  const handlePermanentDelete = async (id: string) => {
    if (isReadOnly) return;
    if (!confirm('Supprimer définitivement cette dépense ? Cette action est irréversible.')) return;

    const { data, error } = await offlineWrite({
      table: 'expenses',
      action: 'DELETE',
      payload: null,
      options: {
        keyColumn: 'id',
        keyValue: id,
      },
      cacheKey: `finance_deleted_expenses:${selectedYearId}`,
      optimisticUpdate: () => {
        setDeletedExpenses(prev => prev.filter(exp => exp.id !== id));
      }
    });
    if (error) {
      alert(`Erreur: ${error.message}`);
      return;
    }
    fetchData();
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => 
      (e.description || '').toLowerCase().includes(expenseSearchTerm.toLowerCase()) ||
      (e.category || '').toLowerCase().includes(expenseSearchTerm.toLowerCase())
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 w-full overflow-x-hidden pb-12">
      <div className="w-full max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 px-4 sm:px-0">
          <div className="w-full md:w-auto">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="text-indigo-600" size={16} fill="currentColor" />
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Comptabilité d'École</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase italic leading-tight">
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
            <button onClick={fetchData} disabled={yearLoading} className="flex-1 md:flex-none px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-sm text-center active:scale-95 transition-transform hover:bg-slate-800">
              Actualiser
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 px-4 sm:px-0">
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <label className="flex flex-col text-[10px] text-slate-500 font-black uppercase tracking-widest">
              Vue
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'annual' | 'monthly')}
                className="mt-2 min-w-[140px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 ring-indigo-100"
              >
                <option value="annual">Annuel</option>
                <option value="monthly">Mensuel</option>
              </select>
            </label>
            {viewMode === 'monthly' && (
              <label className="flex flex-col text-[10px] text-slate-500 font-black uppercase tracking-widest">
                Mois
                <select
                  value={selectedMonthIndex}
                  onChange={(e) => setSelectedMonthIndex(Number(e.target.value))}
                  className="mt-2 min-w-[140px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 ring-indigo-100"
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index}>{month}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Période : {viewMode === 'annual' ? 'Données annuelles' : MONTHS[selectedMonthIndex]}
          </div>
        </div>

        {error && (
          <div className="mx-4 sm:mx-0 bg-rose-50 border border-rose-100 text-rose-600 p-3.5 rounded-xl text-xs font-bold mb-6 flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Grille Principale - Indicateurs Clés */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-3 sm:gap-6 px-4 sm:px-0 mb-6">
          {/* Score de Recouvrement */}
          <div className="col-span-2 lg:col-span-3 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white flex flex-col items-center justify-center shadow-lg text-center">
            <div className="text-3xl sm:text-4xl font-black italic text-green-400">{analytics.healthScore}%</div>
            <div className="text-[9px] font-bold uppercase mt-1 opacity-70 tracking-widest">Recouvrement Annuel</div>
            <ProgressBar progress={analytics.healthScore} color="bg-green-400" />
          </div>
        
          {/* Trésorerie */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-1 lg:col-span-3 hover:shadow-md transition-all">
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

          {/* Dépenses Totales */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-1 lg:col-span-3 hover:shadow-md transition-all">
            <div>
              <p className="text-[9px] font-black uppercase text-rose-400 tracking-tight">Dépenses Totales</p>
              <div className="text-base sm:text-xl font-black italic text-rose-600 mt-1 truncate">
                {analytics.totalExpenses.toLocaleString()} F
              </div>
            </div>
            <div className="text-[10px] font-bold uppercase text-slate-500 mt-2">
              {analytics.expenseCount} enregistrements
            </div>
            <div className="text-[8px] text-slate-400 font-bold uppercase mt-2 flex items-center gap-1">
              <TrendingDown size={12} className="text-rose-400" /> Dépense globale
            </div>
          </div>

          {/* Autonomie */}
          <GlassCard title="Autonomie (Runway)" icon={Landmark} className="col-span-2 lg:col-span-3">
            <div className="text-xl font-black italic text-slate-900">{analytics.runway.toFixed(1)} <span className="text-xs uppercase font-semibold">Mois</span></div>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase italic">Survie de la caisse</p>
          </GlassCard>

          {/* Dépense Moyenne */}
          <GlassCard title="Dépense Moyenne" icon={BarChart3} className="col-span-2 lg:col-span-3">
            <div className="text-xl font-black italic text-slate-900">{analytics.averageExpense.toLocaleString()} F</div>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase italic">Par transaction</p>
          </GlassCard>

          {/* Moyenne Mensuelle */}
          <GlassCard title="Moyenne Mensuelle" icon={TrendingUp} className="col-span-2 lg:col-span-3">
            <div className="text-xl font-black italic text-slate-900">{analytics.monthlyAverageExpense.toLocaleString()} F</div>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase italic">Projection annuelle</p>
          </GlassCard>
        </div>

        {/* Charges Salariales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 sm:mt-6 px-4 sm:px-0">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Masse Salariale Mensuelle</p>
              <div className="text-xl sm:text-2xl font-black italic text-indigo-600">{analytics.monthlySalaries.toLocaleString()} F</div>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Salaires bruts cumulés / mois</p>
            </div>
            <div className="p-3.5 bg-indigo-50 rounded-2xl text-indigo-600 hidden sm:block">
              <Users2 size={24} />
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
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
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Encaissé</p>
            <div className="text-xl sm:text-2xl font-black italic text-slate-900">{analytics.selectedPeriodCollected.toLocaleString()} F</div>
            <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-green-600">
              <ArrowUpRight size={14} /> {analytics.selectedPeriodProgress}% de l'objectif
            </div>
            <p className="text-[9px] text-slate-400 mt-2 uppercase">Période : {analytics.selectedPeriodLabel}</p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Objectif Attendu</p>
            <div className="text-xl sm:text-2xl font-black italic text-slate-900">{analytics.selectedPeriodTarget.toLocaleString()} F</div>
            <div className="mt-2 text-[10px] font-bold text-slate-400 italic">Calculé selon les échelonnements</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm sm:col-span-2 lg:col-span-1 hover:shadow-md transition-all">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Potentiel Général Annuel</p>
            <div className="text-xl font-black italic text-slate-900">{analytics.totalPotential.toLocaleString()} F</div>
            <div className="text-[9px] font-black uppercase text-emerald-600 mt-1">Déjà encaissé : {analytics.collected.toLocaleString()} F</div>
          </div>
        </div>

        {/* Dépenses par Catégorie */}
        {Object.keys(analytics.expensesByCategory).length > 0 && (
          <div className="mt-6 px-4 sm:px-0">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <PieChart size={16} className="text-indigo-600" />
                <h3 className="text-[10px] font-black uppercase text-slate-400 italic tracking-widest">Dépenses par Catégorie</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(analytics.expensesByCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, amount]) => (
                    <div key={category} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase truncate">{category}</p>
                      <p className="text-sm font-black text-slate-900 mt-1">{(amount as number).toLocaleString()} F</p>
                      <p className="text-[8px] text-slate-400 mt-1">
                        {((amount as number / analytics.totalExpenses) * 100).toFixed(1)}%
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

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
          
          {/* SECTION : EXPENSES */}
          <div className={`lg:col-span-5 flex flex-col gap-6 px-4 sm:px-0 ${activeTab === 'expenses' ? 'block' : 'hidden sm:block'}`}>
            
            {/* Formulaire d'ajout */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black uppercase text-slate-400 italic tracking-widest">Enregistrer une Dépense</h3>
                <PieChart size={14} className="text-slate-400" />
              </div>
              <form onSubmit={handleAddExpense} className="space-y-3">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Motif</label>
                  <input 
                    type="text" placeholder="Ex: Fournitures, Électricité..."
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:ring-2 ring-indigo-100 disabled:opacity-50 transition-all"
                    value={expDesc} onChange={(e) => setExpDesc(e.target.value)}
                    disabled={isReadOnly}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Catégorie</label>
                  <select 
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:ring-2 ring-indigo-100 disabled:opacity-50"
                    disabled={isReadOnly}
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Montant (FCFA)</label>
                  <input 
                    type="text" 
                    placeholder="0"
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-black text-rose-600 outline-none focus:ring-2 ring-indigo-100 disabled:opacity-50 transition-all"
                    value={expAmount}
                    onChange={handleAmountChange}
                    disabled={isReadOnly}
                    required
                  />
                </div>
                <button type="submit" disabled={isReadOnly || isSubmittingExpense} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wide disabled:opacity-50 shadow-sm active:scale-98 transition-all hover:bg-indigo-700">
                  {isSubmittingExpense ? 'Enregistrement...' : isReadOnly ? 'Mode lecture seule' : '+ Enregistrer'}
                </button>
              </form>
            </div>

            {/* Historique des dépenses */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-1">
              <div className="flex flex-col gap-2 mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 italic tracking-widest">Historique des Dépenses</h3>
                  <button
                    onClick={() => setShowTrashModal(true)}
                    className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors"
                    title="Voir la corbeille"
                  >
                    <Trash2 size={14} className="text-slate-400 hover:text-slate-600" />
                  </button>
                </div>
                <div className="relative w-full mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                  <input 
                    type="text" placeholder="Filtrer..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl text-[11px] font-semibold outline-none border border-slate-200 focus:ring-2 ring-indigo-100"
                    value={expenseSearchTerm} onChange={(e) => setExpenseSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {filteredExpenses.length === 0 ? (
                  <p className="text-[11px] font-semibold text-slate-400 text-center py-6">Aucune dépense enregistrée.</p>
                ) : filteredExpenses.map((ex, i) => (
                  <div key={ex.id || i} className="flex justify-between items-start p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all hover:shadow-sm">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-[11px] font-bold text-slate-900 truncate">{ex.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                          {ex.category || 'Autre'}
                        </span>
                        <span className="text-[9px] text-slate-400">{formatDate(ex.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-[11px] font-black text-rose-600 whitespace-nowrap">{(Number(ex.amount) || 0).toLocaleString()} F</span>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleDeleteExpense(ex.id || '')}
                          className="p-1.5 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={12} className="text-slate-400 hover:text-rose-600" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION : STUDENTS (placeholder) */}
          <div className={`lg:col-span-7 px-4 sm:px-0 ${activeTab === 'students' ? 'block' : 'hidden sm:block'}`}>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-semibold text-slate-400 text-center">Section Élèves à configurer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Corbeille */}
      {showTrashModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
              <h2 className="text-[12px] font-black uppercase text-slate-900 tracking-widest">Corbeille des Dépenses</h2>
              <button
                onClick={() => setShowTrashModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} className="text-slate-600" />
              </button>
            </div>
            
            <div className="p-4">
              {deletedExpenses.length === 0 ? (
                <p className="text-[11px] font-semibold text-slate-400 text-center py-8">Aucune dépense supprimée.</p>
              ) : (
                <div className="space-y-2">
                  {deletedExpenses.map((ex, i) => (
                    <div key={ex.id || i} className="flex justify-between items-start p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-[11px] font-bold text-slate-900 truncate">{ex.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-semibold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                            {ex.category || 'Autre'}
                          </span>
                          <span className="text-[9px] text-slate-400">Supprimée : {formatDate(ex.deleted_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-[11px] font-black text-slate-600 whitespace-nowrap">{(Number(ex.amount) || 0).toLocaleString()} F</span>
                        {!isReadOnly && (
                          <>
                            <button
                              onClick={() => {
                                handleRestoreExpense(ex.id || '');
                                setShowTrashModal(false);
                              }}
                              className="p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                              title="Restaurer"
                            >
                              <RotateCcw size={12} className="text-slate-400 hover:text-green-600" />
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(ex.id || '')}
                              className="p-1.5 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Supprimer définitivement"
                            >
                              <X size={12} className="text-slate-400 hover:text-rose-600" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
