'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { offlineFetch } from '@/utils/offlineApi';
import { useYear } from '@/context/YearContext';
import { 
  Loader2, Volume2, VolumeX, TrendingUp, Users, Wallet, 
  ArrowRight, Calendar, Landmark, Info
} from 'lucide-react';

export default function RapportPromoteurPage() {
  const { selectedYearId, selectedYear, isLoading: yearLoading } = useYear();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSynth, setSpeechSynth] = useState<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSpeechSynth(window.speechSynthesis);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedYearId) return;
    setLoading(true);
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const firstDayOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const currentMonthName = firstDayOfMonth.toLocaleDateString('fr-FR', { month: 'long' });
      const previousMonthName = firstDayOfPreviousMonth.toLocaleDateString('fr-FR', { month: 'long' });

      const parseDate = (value: any) => {
        const date = value ? new Date(value) : null;
        return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
      };

      const isInRange = (value: any, start: Date, end: Date) => {
        const date = parseDate(value);
        return date ? date >= start && date < end : false;
      };

      // 1. Récupérer les élèves pour le total et la scolarité
      const { data: students } = await offlineFetch<any[]>(`rapport_students:${selectedYearId}`, async () => {
        return await supabase
          .from('students')
          .select('id, scolarite_totale, scolarite_payee')
          .eq('academic_year_id', selectedYearId);
      });

      // 2. Récupérer les paiements du jour et du mois
      const { data: payments } = await offlineFetch<any[]>(`rapport_payments:${selectedYearId}`, async () => {
        return await supabase
          .from('payments')
          .select('amount, created_at')
          .eq('academic_year_id', selectedYearId);
      });

      // 3. Récupérer les dépenses du jour et du mois
      const { data: expenses } = await offlineFetch<any[]>(`rapport_expenses:${selectedYearId}`, async () => {
        return await supabase
          .from('expenses')
          .select('amount, created_at')
          .eq('academic_year_id', selectedYearId);
      });

      // 4. Récupérer les enseignants pour les salaires
      const { data: teachers } = await offlineFetch<any[]>(`rapport_teachers:${selectedYearId}`, async () => {
        return await supabase
          .from('teachers')
          .select('salary')
          .eq('academic_year_id', selectedYearId);
      });

      const totalStudents = students?.length || 0;
      const totalExpected = students?.reduce((acc: number, s: any) => acc + Number(s.scolarite_totale || 0), 0) || 0;
      const totalCollected = students?.reduce((acc: number, s: any) => acc + Number(s.scolarite_payee || 0), 0) || 0;
      
      const dailyCollected = payments?.filter((p: any) => p.created_at?.startsWith(today))
        .reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) || 0;
      
      const monthlyCollected = payments?.filter((p: any) => isInRange(p.created_at, firstDayOfMonth, firstDayOfNextMonth))
        .reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) || 0;

      const previousMonthlyCollected = payments?.filter((p: any) => isInRange(p.created_at, firstDayOfPreviousMonth, firstDayOfMonth))
        .reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) || 0;

      const dailyExpenses = expenses?.filter((e: any) => e.created_at?.startsWith(today))
        .reduce((acc: number, e: any) => acc + Number(e.amount || 0), 0) || 0;
      
      const monthlyExpenses = expenses?.filter((e: any) => isInRange(e.created_at, firstDayOfMonth, firstDayOfNextMonth))
        .reduce((acc: number, e: any) => acc + Number(e.amount || 0), 0) || 0;

      const previousMonthlyExpenses = expenses?.filter((e: any) => isInRange(e.created_at, firstDayOfPreviousMonth, firstDayOfMonth))
        .reduce((acc: number, e: any) => acc + Number(e.amount || 0), 0) || 0;

      const totalExpenses = expenses?.reduce((acc: number, e: any) => acc + Number(e.amount || 0), 0) || 0;
      const netCaisse = totalCollected - totalExpenses;
      
      const monthlyProfit = monthlyCollected - monthlyExpenses;
      const previousMonthlyProfit = previousMonthlyCollected - previousMonthlyExpenses;
      const monthlySalaries = teachers?.reduce((acc: number, t: any) => acc + Number(t.salary || 0), 0) || 0;
      const remainingToCollect = totalExpected - totalCollected;
      const averagePerStudentMonthly = totalStudents > 0 ? Math.round(monthlyCollected / totalStudents) : 0;
      const annualRecoveryRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

      const collectionGrowthPercent = previousMonthlyCollected > 0
        ? Math.round(((monthlyCollected - previousMonthlyCollected) / previousMonthlyCollected) * 100)
        : null;
      const expenseGrowthPercent = previousMonthlyExpenses > 0
        ? Math.round(((monthlyExpenses - previousMonthlyExpenses) / previousMonthlyExpenses) * 100)
        : null;
      const profitGrowthPercent = previousMonthlyProfit !== 0
        ? Math.round(((monthlyProfit - previousMonthlyProfit) / Math.abs(previousMonthlyProfit)) * 100)
        : null;

      setData({
        totalStudents,
        totalExpected,
        totalCollected,
        dailyCollected,
        monthlyCollected,
        previousMonthlyCollected,
        dailyExpenses,
        monthlyExpenses,
        previousMonthlyExpenses,
        totalExpenses,
        netCaisse,
        monthlyProfit,
        previousMonthlyProfit,
        monthlySalaries,
        remainingToCollect,
        averagePerStudentMonthly,
        annualRecoveryRate,
        collectionGrowthPercent,
        expenseGrowthPercent,
        profitGrowthPercent,
        currentMonthName,
        previousMonthName,
      });

    } catch (error) {
      console.error('Erreur rapport:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedYearId]);

  useEffect(() => {
    if (selectedYearId) fetchData();
  }, [selectedYearId, fetchData]);

  const reportText = useMemo(() => {
    if (!data) return "";
    return `Monsieur le promoteur, voici le rapport de l'école pour aujourd'hui.
    L'école compte à ce jour ${data.totalStudents} élèves.
    Nous avons encaissé ${data.dailyCollected.toLocaleString()} francs aujourd'hui, et un total de ${data.monthlyCollected.toLocaleString()} francs en ${data.currentMonthName}, contre ${data.previousMonthlyCollected.toLocaleString()} francs en ${data.previousMonthName}.
    Les dépenses s'élèvent à ${data.dailyExpenses.toLocaleString()} francs aujourd'hui, et ${data.monthlyExpenses.toLocaleString()} francs en ${data.currentMonthName}, contre ${data.previousMonthlyExpenses.toLocaleString()} francs le mois dernier.
    Le résultat net ce mois-ci est de ${data.monthlyProfit.toLocaleString()} francs, ${data.profitGrowthPercent !== null ? (data.profitGrowthPercent >= 0 ? 'en hausse de ' : 'en baisse de ') + Math.abs(data.profitGrowthPercent) + ' % par rapport au mois précédent.' : 'sans comparaison disponible avec le mois précédent.'}
    Actuellement, il y a ${data.netCaisse.toLocaleString()} francs dans la caisse.
    D'ici la fin de l'année scolaire, l'école doit encore encaisser ${data.remainingToCollect.toLocaleString()} francs.
    Le taux de recouvrement annuel est de ${data.annualRecoveryRate}% et la moyenne encaissée par élève ce mois-ci est de ${data.averagePerStudentMonthly.toLocaleString()} francs.`;
  }, [data]);

  const toggleSpeech = () => {
    if (!speechSynth) return;

    if (isSpeaking) {
      speechSynth.cancel();
      setIsSpeaking(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(reportText);
      utterance.lang = 'fr-FR';
      utterance.onend = () => setIsSpeaking(false);
      setIsSpeaking(true);
      speechSynth.speak(utterance);
    }
  };

  if (loading || yearLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header Simplifié */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight">
              Rapport <span className="text-blue-600">Promoteur</span>
            </h1>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
              Résumé essentiel de votre établissement
            </p>
          </div>
          <button 
            onClick={toggleSpeech}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm uppercase transition-all shadow-lg active:scale-95 ${
              isSpeaking ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-900 text-white hover:bg-blue-600'
            }`}
          >
            {isSpeaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
            {isSpeaking ? 'Arrêter la lecture' : 'Écouter le rapport'}
          </button>
        </div>

        {/* Grille de Rapport Facile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Effectif */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Users size={24} />
              </div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Effectif Global</span>
            </div>
            <p className="text-3xl font-black text-slate-900">{data.totalStudents} <span className="text-sm text-slate-400 font-bold uppercase tracking-widest">Élèves</span></p>
          </div>

          {/* Caisse Actuelle */}
          <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl shadow-blue-900/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/10 text-blue-400 rounded-2xl">
                <Landmark size={24} />
              </div>
              <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Argent en Caisse</span>
            </div>
            <p className="text-3xl font-black text-blue-400">{data.netCaisse.toLocaleString()} <span className="text-sm text-white/60 font-bold uppercase tracking-widest">FCFA</span></p>
          </div>

          {/* Encaissements */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <TrendingUp size={24} />
              </div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Flux des Recettes</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Encaissé ce jour</p>
                <p className="text-2xl font-black text-emerald-600">{data.dailyCollected.toLocaleString()} F</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Encaissé ce mois</p>
                <p className="text-2xl font-black text-slate-900">{data.monthlyCollected.toLocaleString()} F</p>
              </div>
            </div>
          </div>

          {/* Dépenses */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <Wallet size={24} />
              </div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Flux des Dépenses</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Dépensé ce jour</p>
                <p className="text-2xl font-black text-rose-600">{data.dailyExpenses.toLocaleString()} F</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Dépensé ce mois</p>
                <p className="text-2xl font-black text-slate-900">{data.monthlyExpenses.toLocaleString()} F</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 col-span-1 md:col-span-2 p-6 rounded-[2.5rem] text-white shadow-xl shadow-slate-900/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-white/10 rounded-2xl">
                <ArrowRight size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-200 tracking-widest">Comparaison mensuelle</p>
                <p className="text-sm text-slate-400 mt-1">{data.currentMonthName} vs {data.previousMonthName}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-[9px] uppercase tracking-widest text-slate-300 font-bold mb-2">Encaissement</p>
                <p className="text-xl font-black text-white">{data.monthlyCollected.toLocaleString()} F</p>
                <p className="text-[11px] text-slate-300 mt-2">Mois dernier {data.previousMonthlyCollected.toLocaleString()} F</p>
                <p className={`text-[11px] font-bold mt-3 ${data.collectionGrowthPercent === null ? 'text-slate-300' : data.collectionGrowthPercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {data.collectionGrowthPercent === null ? 'Nouveau mois' : `${data.collectionGrowthPercent >= 0 ? '+' : ''}${data.collectionGrowthPercent}%`}
                </p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-[9px] uppercase tracking-widest text-slate-300 font-bold mb-2">Dépenses</p>
                <p className="text-xl font-black text-white">{data.monthlyExpenses.toLocaleString()} F</p>
                <p className="text-[11px] text-slate-300 mt-2">Mois dernier {data.previousMonthlyExpenses.toLocaleString()} F</p>
                <p className={`text-[11px] font-bold mt-3 ${data.expenseGrowthPercent === null ? 'text-slate-300' : data.expenseGrowthPercent <= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {data.expenseGrowthPercent === null ? 'Nouveau mois' : `${data.expenseGrowthPercent >= 0 ? '+' : ''}${data.expenseGrowthPercent}%`}
                </p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-[9px] uppercase tracking-widest text-slate-300 font-bold mb-2">Résultat net</p>
                <p className="text-xl font-black text-white">{data.monthlyProfit.toLocaleString()} F</p>
                <p className="text-[11px] text-slate-300 mt-2">Mois dernier {data.previousMonthlyProfit.toLocaleString()} F</p>
                <p className={`text-[11px] font-bold mt-3 ${data.profitGrowthPercent === null ? 'text-slate-300' : data.profitGrowthPercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {data.profitGrowthPercent === null ? 'Nouveau mois' : `${data.profitGrowthPercent >= 0 ? '+' : ''}${data.profitGrowthPercent}%`}
                </p>
              </div>
            </div>
          </div>

          {/* Prévisions */}
          <div className="bg-blue-600 p-6 rounded-[2.5rem] text-white shadow-xl shadow-blue-600/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 text-white rounded-2xl">
                <Calendar size={24} />
              </div>
              <span className="text-[10px] font-black uppercase text-blue-100 tracking-widest">Reste à percevoir</span>
            </div>
            <p className="text-2xl font-black">{data.remainingToCollect.toLocaleString()} F</p>
            <p className="text-[9px] font-bold text-blue-100 uppercase mt-2 italic">D'ici la fin de l'année</p>
          </div>

          {/* Salaires */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                <Info size={24} />
              </div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Masse Salariale</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{data.monthlySalaries.toLocaleString()} F</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-2 italic">À payer ce mois-ci</p>
          </div>

        </div>

        {/* Note de bas de page */}
        <div className="mt-12 text-center">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">KalanNyetaa Intelligence</p>
        </div>
      </div>
    </div>
  );
}
