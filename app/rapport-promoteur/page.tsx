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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={28} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-20 font-sans text-slate-900 antialiased">
      
      {/* 1. EN-TÊTE ÉPURÉ & ACTION VOCALE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Synthèse Décisionnelle</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Rapport Promoteur
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Résumé stratégique et financier de l'établissement
          </p>
        </div>

        <button 
          onClick={toggleSpeech}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-xs self-start sm:self-auto ${
            isSpeaking 
              ? 'bg-rose-600 text-white animate-pulse' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
          <span>{isSpeaking ? 'Arrêter la lecture' : 'Écouter le rapport'}</span>
        </button>
      </div>

      {/* 2. GRILLE PRINCIPALE DE CARTES PLATES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Effectif global */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-slate-500">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Users size={18} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Effectif Global</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
            {data.totalStudents} <span className="text-xs font-bold text-slate-400">élèves inscrits</span>
          </p>
        </div>

        {/* Caisse actuelle */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-slate-500">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Landmark size={18} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Trésorerie Active (En Caisse)</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 leading-tight">
            {data.netCaisse.toLocaleString()} <span className="text-xs font-bold text-emerald-400">FCFA</span>
          </p>
        </div>

        {/* Flux des recettes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs col-span-1 md:col-span-2 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp size={18} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 block">Flux des Recettes</span>
              <span className="text-[11px] text-slate-400 font-medium">Encaissements de scolarité</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Encaissé ce jour</span>
              <p className="text-xl sm:text-2xl font-black text-emerald-600 leading-tight">
                +{data.dailyCollected.toLocaleString()} F
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total mois ({data.currentMonthName})</span>
              <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {data.monthlyCollected.toLocaleString()} F
              </p>
            </div>
          </div>
        </div>

        {/* Flux des dépenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs col-span-1 md:col-span-2 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <Wallet size={18} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 block">Flux des Décaissements</span>
              <span className="text-[11px] text-slate-400 font-medium">Charges et sorties enregistrées</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dépensé ce jour</span>
              <p className="text-xl sm:text-2xl font-black text-rose-600 leading-tight">
                -{data.dailyExpenses.toLocaleString()} F
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total mois ({data.currentMonthName})</span>
              <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {data.monthlyExpenses.toLocaleString()} F
              </p>
            </div>
          </div>
        </div>

        {/* Comparaison mensuelle */}
        <div className="bg-white col-span-1 md:col-span-2 p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
              <ArrowRight size={18} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 block">Comparaison d'un mois à l'autre</span>
              <span className="text-[11px] text-slate-500 font-medium">
                {data.currentMonthName} par rapport à {data.previousMonthName}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Encaissement</span>
              <p className="text-lg sm:text-xl font-black text-slate-900">{data.monthlyCollected.toLocaleString()} F</p>
              <span className="text-[10px] text-slate-400 block">Mois préc. : {data.previousMonthlyCollected.toLocaleString()} F</span>
              <span className={`inline-block text-[11px] font-bold ${
                data.collectionGrowthPercent === null 
                  ? 'text-slate-400' 
                  : data.collectionGrowthPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {data.collectionGrowthPercent === null ? 'Période initiale' : `${data.collectionGrowthPercent >= 0 ? '+' : ''}${data.collectionGrowthPercent}%`}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dépenses</span>
              <p className="text-lg sm:text-xl font-black text-slate-900">{data.monthlyExpenses.toLocaleString()} F</p>
              <span className="text-[10px] text-slate-400 block">Mois préc. : {data.previousMonthlyExpenses.toLocaleString()} F</span>
              <span className={`inline-block text-[11px] font-bold ${
                data.expenseGrowthPercent === null 
                  ? 'text-slate-400' 
                  : data.expenseGrowthPercent <= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {data.expenseGrowthPercent === null ? 'Période initiale' : `${data.expenseGrowthPercent >= 0 ? '+' : ''}${data.expenseGrowthPercent}%`}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Résultat net mensuel</span>
              <p className={`text-lg sm:text-xl font-black ${data.monthlyProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {data.monthlyProfit.toLocaleString()} F
              </p>
              <span className="text-[10px] text-slate-400 block">Mois préc. : {data.previousMonthlyProfit.toLocaleString()} F</span>
              <span className={`inline-block text-[11px] font-bold ${
                data.profitGrowthPercent === null 
                  ? 'text-slate-400' 
                  : data.profitGrowthPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {data.profitGrowthPercent === null ? 'Période initiale' : `${data.profitGrowthPercent >= 0 ? '+' : ''}${data.profitGrowthPercent}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Prévisions - Reste à percevoir */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-slate-500">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Calendar size={18} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Reste à percevoir</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-blue-600 leading-tight">
            {data.remainingToCollect.toLocaleString()} <span className="text-xs font-bold text-blue-400">F</span>
          </p>
          <span className="text-[11px] font-semibold text-slate-400 block">
            Reliquat théorique sur la scolarité annuelle
          </span>
        </div>

        {/* Salaires prévisionnels */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-slate-500">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <Info size={18} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Masse Salariale Mensuelle</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
            {data.monthlySalaries.toLocaleString()} <span className="text-xs font-bold text-slate-400">F</span>
          </p>
          <span className="text-[11px] font-semibold text-slate-400 block">
            Montant cumulé dû aux enseignants chaque mois
          </span>
        </div>

      </div>

    </div>
  );
}