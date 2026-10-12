"use client";

import { Suspense, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { useYear } from '@/context/YearContext';
import { 
  Trophy, AlertTriangle, TrendingUp, Users, 
  Target, Loader2, Award, Star, Search, ChevronDown
} from 'lucide-react';

export default function PerformancePage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-3">
        <Loader2 className="animate-spin text-blue-600" size={28} />
        <p className="font-bold text-xs uppercase tracking-widest text-slate-500">Analyse des performances...</p>
      </div>
    }>
      <PerformanceContent />
    </Suspense>
  );
}

function PerformanceContent() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [period, setPeriod] = useState('1er Trimestre');

  const { selectedYearId, isLoading: yearLoading } = useYear();

  const allPeriods = [
    "1er Trimestre", "2e Trimestre", "3e Trimestre", "Examen Final",
    "composition du mois de janvier", "composition du mois de fevrier",
    "composition du mois de mars", "composition du mois d'avril",
    "composition du mois mai", "composition du mois de juin",
    "composition du mois de juillet", "compositin du mois d'aout",
    "composition du mois de septembre", "composition du mois d'octobre"
  ];

  const fetchPerformanceData = useCallback(async () => {
    if (!selectedYearId) return;
    setLoading(true);
    try {
      const { data: grades, error } = await supabase
        .from('student_grades')
        .select(`
          grade_value,
          subject_name,
          period,
          students (
            id, 
            first_name, 
            last_name, 
            classes (name)
          )
        `)
        .eq('period', period)
        .eq('academic_year_id', selectedYearId);

      if (error) throw error;
      if (!grades || grades.length === 0) {
        setStats(null);
        return;
      }

      const studentMetrics: any = {};
      const subjectMajors: any = {};

      grades.forEach((g: any) => {
        if (!g.students) return;
        const sId = g.students.id;
        const studentName = `${g.students.first_name} ${g.students.last_name}`;
        const className = g.students.classes?.name || "N/A";

        if (!studentMetrics[sId]) {
          studentMetrics[sId] = { name: studentName, className, total: 0, count: 0 };
        }
        studentMetrics[sId].total += g.grade_value;
        studentMetrics[sId].count += 1;

        if (!subjectMajors[g.subject_name] || g.grade_value > subjectMajors[g.subject_name].score) {
          subjectMajors[g.subject_name] = {
            score: g.grade_value,
            studentName: studentName
          };
        }
      });

      const processedStudents = Object.values(studentMetrics).map((s: any) => ({
        ...s,
        average: s.total / s.count
      }));

      const haveAvg = processedStudents.filter((s: any) => s.average >= 10);
      const noAvg = processedStudents.filter((s: any) => s.average < 10);
      const top10 = [...processedStudents].sort((a, b) => b.average - a.average).slice(0, 10);
      const flop10 = [...processedStudents].sort((a, b) => a.average - b.average).slice(0, 10);

      const classStats: any = {};
      processedStudents.forEach((s: any) => {
        if (!classStats[s.className]) classStats[s.className] = { admit: 0, fail: 0 };
        if (s.average >= 10) classStats[s.className].admit++;
        else classStats[s.className].fail++;
      });

      setStats({
        global: { total: processedStudents.length, admit: haveAvg.length, fail: noAvg.length },
        top10,
        flop10,
        classStats,
        subjectMajors
      });

    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoading(false);
    }
  }, [period, selectedYearId]);

  useEffect(() => { 
    if (!yearLoading && selectedYearId) {
      fetchPerformanceData(); 
    }
  }, [fetchPerformanceData, yearLoading, selectedYearId]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6 antialiased text-slate-900 font-sans pb-24">
      
      {/* 1. EN-TÊTE ÉPURÉ & FILTRE DE PÉRIODE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Statistiques Académiques</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Performance Globale
          </h1>
        </div>
        
        <div className="relative w-full sm:w-72">
          <select 
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:border-blue-600 transition cursor-pointer appearance-none shadow-xs"
          >
            {allPeriods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col h-64 items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80">
          <Loader2 className="animate-spin text-blue-600" size={28} />
          <p className="font-bold text-slate-400 uppercase text-xs tracking-wider">Calcul des moyennes en cours...</p>
        </div>
      ) : !stats ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
          <Target className="mx-auto text-slate-300 mb-2" size={28} />
          <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">Aucune note enregistrée pour cette période.</p>
        </div>
      ) : (
        <>
          {/* 2. STATS GLOBALES (CARTES PLATES) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
            <div className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 bg-white space-y-1 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Effectif évalué</span>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                {stats.global.total} <span className="text-xs font-bold text-slate-400">élèves</span>
              </p>
            </div>

            <div className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 bg-white space-y-1 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Moyenne ≥ 10 (Admis)</span>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-black text-emerald-600 leading-tight">
                  {stats.global.admit}
                </p>
                <span className="text-xs font-extrabold text-emerald-600">
                  ({((stats.global.admit / stats.global.total) * 100).toFixed(0)}%)
                </span>
              </div>
            </div>

            <div className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 bg-white space-y-1 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Moyenne &lt; 10 (En difficulté)</span>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-black text-rose-600 leading-tight">
                  {stats.global.fail}
                </p>
                <span className="text-xs font-extrabold text-rose-600">
                  ({((stats.global.fail / stats.global.total) * 100).toFixed(0)}%)
                </span>
              </div>
            </div>
          </div>

          {/* 3. CLASSEMENTS TOP 10 & SOUTIEN */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <RankingCard title="Top 10 - Excellence" data={stats.top10} isTop={true} />
            <RankingCard title="Top 10 - À soutenir" data={stats.flop10} isTop={false} />
          </div>

          {/* 4. MAJORS PAR MATIÈRE */}
          <div className="space-y-3">
            <div className="border-b border-slate-200/80 pb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2">
                <Star className="text-amber-500 fill-amber-500" size={16} />
                <span>Premiers par discipline (Majors)</span>
              </h2>
              <span className="text-xs font-bold text-slate-400">
                {Object.keys(stats.subjectMajors).length} matière{Object.keys(stats.subjectMajors).length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(stats.subjectMajors).map(([subject, data]: any) => (
                <div key={subject} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">{subject}</span>
                    <p className="font-bold text-slate-900 text-xs truncate mt-0.5 capitalize">{data.studentName}</p>
                  </div>
                  <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg font-black text-xs shrink-0">
                    {data.score}/20
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 5. TAUX DE SUCCÈS PAR CLASSE (STYLE PLAT) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-600" />
                <span>Taux d'admission par classe</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">Pourcentage d'élèves ayant obtenu une moyenne supérieure ou égale à 10</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {Object.entries(stats.classStats).map(([name, data]: any) => {
                const total = data.admit + data.fail;
                const percent = total > 0 ? Math.round((data.admit / total) * 100) : 0;
                return (
                  <div key={name} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-slate-800 uppercase truncate pr-2">{name}</span>
                      <span className="text-base font-black text-slate-900">{percent}%</span>
                    </div>

                    <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${percent >= 50 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                        style={{ width: `${percent}%` }} 
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                      <span>{data.admit} admis</span>
                      <span>{data.fail} échec{data.fail > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

    </div>
  );
}

function RankingCard({ title, data, isTop }: { title: string; data: any[]; isTop: boolean }) {
  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
      <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
        {isTop ? (
          <Trophy size={16} className="text-emerald-600" />
        ) : (
          <AlertTriangle size={16} className="text-rose-600" />
        )}
        <h2 className="text-sm font-bold text-slate-900 uppercase">{title}</h2>
      </div>

      <div className="divide-y divide-slate-100">
        {data.length === 0 ? (
          <p className="text-xs text-slate-400 font-medium py-6 text-center">Aucune donnée disponible.</p>
        ) : (
          data.map((s: any, i: number) => (
            <div key={i} className="py-2.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-5 text-[11px] font-black shrink-0 ${isTop ? 'text-emerald-600' : 'text-rose-600'}`}>
                  #{i + 1}
                </span>
                <div className="truncate">
                  <p className="font-bold text-slate-900 truncate capitalize">{s.name}</p>
                  <span className="text-[10px] font-medium text-slate-400 block">{s.className}</span>
                </div>
              </div>

              <span className={`px-2.5 py-1 rounded-md font-black shrink-0 border ${
                isTop 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {s.average.toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}