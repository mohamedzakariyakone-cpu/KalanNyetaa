'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { offlineFetch, offlineWrite } from '@/utils/offlineApi';
import { useCacheRefresh } from '@/hooks/useCacheRefresh';
import { useYear } from '@/context/YearContext';
import {
  Loader2, MessageSquare, Search, AlertTriangle,
  ArrowUpRight, PieChart, Lock, Calendar, Trash2, TrendingDown, Wallet, Users2,
  TrendingUp, RotateCcw, Landmark, ShieldCheck, CheckCircle2, Plus, X
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
  
  // Onglets organisés façon console administrative
  const [activeTab, setActiveTab] = useState<'students' | 'expenses' | 'trash'>('students');
  const [viewMode, setViewMode] = useState<'annual' | 'monthly'>('annual');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(new Date().getMonth());
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  
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

      const { data: expensesData, error: expensesError } = await offlineFetch<Expense[]>(`finance_expenses:${selectedYearId}`, async () => {
        return await supabase
          .from('expenses')
          .select('*')
          .eq('academic_year_id', selectedYearId)
          .eq('school_id', schoolId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });
      });

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
      alert('Action impossible en mode lecture seule');
      return;
    }
    
    setIsSubmittingExpense(true);
    const { error } = await offlineWrite({
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
    fetchData();
  };

  const handleDeleteExpense = async (id: string) => {
    if (isReadOnly) return;
    if (!confirm('Déplacer cette dépense vers la corbeille ?')) return;

    const { error } = await offlineWrite({
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

    const { error } = await offlineWrite({
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

    const { error } = await offlineWrite({
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

  const filteredDeletedExpenses = useMemo(() => {
    return deletedExpenses.filter(e => 
      (e.description || '').toLowerCase().includes(expenseSearchTerm.toLowerCase()) ||
      (e.category || '').toLowerCase().includes(expenseSearchTerm.toLowerCase())
    );
  }, [deletedExpenses, expenseSearchTerm]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading) return (
    <div className="flex h-64 w-full items-center justify-center">
      <Loader2 className="animate-spin text-blue-600" size={28} />
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-16 font-sans text-slate-900 antialiased">
      
      {/* 1. EN-TÊTE ÉPURÉ DE LA GESTION FINANCIÈRE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Direction Financière</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Comptabilité & Trésorerie
          </h1>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {isReadOnly && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold">
              <Lock size={13} className="shrink-0" /> Lecture seule
            </div>
          )}
          <button 
            onClick={fetchData} 
            disabled={yearLoading} 
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-xs active:scale-95"
          >
            Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* 2. CONTRÔLE DE PÉRIODE & KPI CLÉS PLATS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Période :</span>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'annual' | 'monthly')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="annual">Exercice Annuel</option>
            <option value="monthly">Vue Mensuelle</option>
          </select>

          {viewMode === 'monthly' && (
            <select
              value={selectedMonthIndex}
              onChange={(e) => setSelectedMonthIndex(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 outline-none focus:border-blue-600 cursor-pointer"
            >
              {MONTHS.map((month, index) => (
                <option key={month} value={index}>{month}</option>
              ))}
            </select>
          )}
        </div>

        <div className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 self-start sm:self-auto">
          {viewMode === 'annual' ? 'Données globales annuelles' : `Mois : ${MONTHS[selectedMonthIndex]}`}
        </div>
      </div>

      {/* GRILLE DES 4 KPI PLATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 bg-white space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Recouvrement Annuel</span>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
            {analytics.healthScore}%
          </p>
          <span className="text-[11px] font-bold text-slate-400 block pt-1">
            {analytics.collected.toLocaleString()} F encaissés
          </span>
        </div>

        <div className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 bg-white space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Trésorerie Active</span>
          <p className={`text-2xl sm:text-3xl font-black leading-tight ${analytics.netCash >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {analytics.netCash.toLocaleString()} <span className="text-xs font-bold text-slate-400">F</span>
          </p>
          <span className="text-[11px] font-bold text-slate-400 block pt-1">
            Solde net après décaissements
          </span>
        </div>

        <div className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 bg-white space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Dépenses Directes</span>
          <p className="text-2xl sm:text-3xl font-black text-rose-600 leading-tight">
            {analytics.totalExpenses.toLocaleString()} <span className="text-xs font-bold text-rose-400">F</span>
          </p>
          <span className="text-[11px] font-bold text-slate-400 block pt-1">
            {analytics.expenseCount} opérations enregistrées
          </span>
        </div>

        <div className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 bg-white space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Masse Salariale</span>
          <p className="text-2xl sm:text-3xl font-black text-blue-600 leading-tight">
            {analytics.monthlySalaries.toLocaleString()} <span className="text-xs font-bold text-blue-400">F/m</span>
          </p>
          <span className="text-[11px] font-bold text-slate-400 block pt-1">
            Autonomie : {analytics.runway.toFixed(1)} mois
          </span>
        </div>
      </div>

      {/* 3. BARRE DE NAVIGATION DES MODULES PLATS */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap ${
            activeTab === 'students'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Registre Scolarités ({analytics.processedStudents.length})
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap ${
            activeTab === 'expenses'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Dépenses & Décaissements ({expenses.length})
        </button>

        <button
          onClick={() => setActiveTab('trash')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'trash'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-rose-600'
          }`}
        >
          <Trash2 size={13} />
          <span>Corbeille ({deletedExpenses.length})</span>
        </button>
      </div>

      {/* 4. CONTENU DU MODULE : SCOLARITÉS */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase">Suivi des paiements élèves</h3>
                <p className="text-xs text-slate-500">Relance rapide WhatsApp et contrôle des impayés</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Rechercher un élève..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:bg-white focus:border-blue-600 transition"
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Vue Table Desktop */}
            <div className="hidden sm:block w-full overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    <th className="px-5 py-3">Élève</th>
                    <th className="px-4 py-3">Classe</th>
                    <th className="px-4 py-3 text-right">Frais Annuel</th>
                    <th className="px-4 py-3 text-right">Encaissé</th>
                    <th className="px-4 py-3 text-right">Restant dû</th>
                    <th className="px-5 py-3 text-right">Relance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.processedStudents
                    .filter((s: ProcessedStudent) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-xs text-center text-slate-400 py-8 font-medium">Aucun élève trouvé.</td>
                      </tr>
                    ) : analytics.processedStudents
                    .filter((s: ProcessedStudent) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((s: ProcessedStudent) => {
                      const remaining = s.annual_fee - s.totalPaid;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-5 py-3">
                            <div className="font-bold text-slate-900 capitalize">{s.last_name} {s.first_name}</div>
                            <span className="text-[10px] text-slate-400 font-medium">{s.parent_phone || 'Sans contact'}</span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {s.className}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700">
                            {s.annual_fee.toLocaleString()} F
                          </td>
                          <td className="px-4 py-3 text-right font-black text-emerald-600">
                            {s.totalPaid.toLocaleString()} F
                          </td>
                          <td className="px-4 py-3 text-right font-black">
                            <span className={remaining > 0 ? 'text-rose-600' : 'text-slate-400'}>
                              {remaining.toLocaleString()} F
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button 
                              onClick={() => {
                                const msg = encodeURIComponent(`Bonjour, rappel concernant la scolarité de ${s.first_name}. Reste à régler : ${remaining.toLocaleString()} FCFA. Merci de régulariser.`);
                                window.open(`https://wa.me/${s.parent_phone?.replace(/\D/g,'')}?text=${msg}`, '_blank');
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-lg transition"
                              title="Envoyer message WhatsApp"
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

            {/* Vue Cartes Mobile */}
            <div className="sm:hidden divide-y divide-slate-100">
              {analytics.processedStudents
                .filter((s: ProcessedStudent) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((s: ProcessedStudent) => {
                  const remaining = s.annual_fee - s.totalPaid;
                  return (
                    <div key={s.id} className="p-4 space-y-2.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-slate-900 capitalize">{s.last_name} {s.first_name}</p>
                          <span className="text-[10px] text-slate-500 font-medium">{s.className}</span>
                        </div>
                        <button 
                          onClick={() => {
                            const msg = encodeURIComponent(`Bonjour, rappel pour la scolarité de ${s.first_name}. Solde restant : ${remaining.toLocaleString()} F.`);
                            window.open(`https://wa.me/${s.parent_phone?.replace(/\D/g,'')}?text=${msg}`, '_blank');
                          }}
                          className="p-2 text-blue-600 bg-blue-50 border border-blue-100 rounded-xl"
                        >
                          <MessageSquare size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="text-[9px] text-slate-400 block font-bold">Frais</span>
                          <span className="font-bold text-slate-800">{s.annual_fee.toLocaleString()} F</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="text-[9px] text-slate-400 block font-bold">Payé</span>
                          <span className="font-bold text-emerald-600">{s.totalPaid.toLocaleString()} F</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="text-[9px] text-slate-400 block font-bold">Reste</span>
                          <span className={`font-bold ${remaining > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {remaining.toLocaleString()} F
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

          </div>
        </div>
      )}

      {/* 5. CONTENU DU MODULE : DÉPENSES & DÉCAISSEMENTS */}
      {activeTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Colonne gauche : Formulaire de saisie plat (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900 uppercase">Enregistrer une dépense</h3>
                <p className="text-xs text-slate-500">Ajoutez une sortie de caisse certifiée</p>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Motif du décaissement</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Facture électricité, fournitures bureau..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-600 transition"
                    value={expDesc} 
                    onChange={(e) => setExpDesc(e.target.value)}
                    disabled={isReadOnly}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Catégorie comptable</label>
                  <select 
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-600 transition cursor-pointer"
                    disabled={isReadOnly}
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Montant décaissé (FCFA)</label>
                  <input 
                    type="text" 
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-rose-600 outline-none focus:bg-white focus:border-blue-600 transition"
                    value={expAmount}
                    onChange={handleAmountChange}
                    disabled={isReadOnly}
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isReadOnly || isSubmittingExpense} 
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-40"
                >
                  {isSubmittingExpense ? 'Enregistrement...' : 'Valider la sortie'}
                </button>
              </form>
            </div>

            {/* Répartition par catégorie plate */}
            {Object.keys(analytics.expensesByCategory).length > 0 && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <PieChart size={14} className="text-blue-600" />
                  <h4 className="text-xs font-bold uppercase text-slate-800">Dépenses par catégorie</h4>
                </div>
                <div className="space-y-2">
                  {Object.entries(analytics.expensesByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, amount]) => (
                      <div key={category} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="font-semibold text-slate-700">{category}</span>
                        <div className="text-right">
                          <span className="font-bold text-slate-900">{amount.toLocaleString()} F</span>
                          <span className="text-[10px] text-slate-400 block">
                            {((amount / analytics.totalExpenses) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Colonne droite : Registre des dépenses actives (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase">
                  Historique des décaissements ({filteredExpenses.length})
                </h3>
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                  <input 
                    type="text" 
                    placeholder="Filtrer motif ou catégorie..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:bg-white focus:border-blue-600 transition"
                    value={expenseSearchTerm} 
                    onChange={(e) => setExpenseSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {filteredExpenses.length === 0 ? (
                  <p className="text-xs font-semibold text-slate-400 text-center py-10">Aucune dépense active.</p>
                ) : filteredExpenses.map((ex, i) => (
                  <div key={ex.id || i} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{ex.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                          {ex.category || 'Autre'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">{formatDate(ex.created_at)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-black text-rose-600 whitespace-nowrap">
                        -{(Number(ex.amount) || 0).toLocaleString()} F
                      </span>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleDeleteExpense(ex.id || '')}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Mettre à la corbeille"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 6. CONTENU DU MODULE : CORBEILLE DES DÉPENSES */}
      {activeTab === 'trash' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase">Corbeille des écritures supprimées</h3>
              <p className="text-xs text-slate-500 font-medium">Restauration en un clic ou suppression définitive</p>
            </div>
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input 
                type="text" 
                placeholder="Filtrer la corbeille..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:bg-white focus:border-blue-600 transition"
                value={expenseSearchTerm} 
                onChange={(e) => setExpenseSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {filteredDeletedExpenses.length === 0 ? (
              <p className="text-xs font-semibold text-slate-400 text-center py-10">La corbeille est vide.</p>
            ) : filteredDeletedExpenses.map((ex, i) => (
              <div key={ex.id || i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-600 line-through truncate">{ex.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {ex.category || 'Autre'}
                    </span>
                    <span className="text-[11px] text-slate-400">Supprimé le : {formatDate(ex.deleted_at)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <span className="text-xs font-bold text-slate-500">
                    {(Number(ex.amount) || 0).toLocaleString()} F
                  </span>

                  {!isReadOnly && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRestoreExpense(ex.id || '')}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                        title="Restaurer"
                      >
                        <RotateCcw size={12} />
                        <span>Restaurer</span>
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(ex.id || '')}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                        title="Détruire définitivement"
                      >
                        <Trash2 size={12} />
                        <span>Détruire</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}