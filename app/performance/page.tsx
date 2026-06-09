"use client";

import { Suspense, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { useYear } from '@/context/YearContext';
import { 
  Trophy, AlertTriangle, TrendingUp, Users, 
  BookOpen, Target, Loader2, Award, Star, Search, ChevronDown, Lock
} from 'lucide-react';

export default function PerformancePage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500 gap-4">
        <Loader2 className="animate-spin text-green-600" size={40} />
        <p className="font-black animate-pulse text-xs uppercase tracking-widest">Analyse des données...</p>
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

  // Hook pour l'année scolaire
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-10 space-y-8 md:space-y-10 bg-[#f8fafc]">
      
      {/* HEADER ADAPTIF */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-6 bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter text-slate-950">Performance</h1>
          <p className="text-slate-400 font-bold mt-1 uppercase text-[9px] md:text-[10px] tracking-widest flex items-center gap-2">
            <Target size={14} className="text-green-600" /> {period}
          </p>
        </div>
        
        <div className="relative">
          <select 
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full md:w-72 pl-10 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl appearance-none font-black text-slate-700 focus:border-green-500 outline-none transition-all cursor-pointer text-xs md:text-sm"
          >
            {allPeriods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col h-64 items-center justify-center gap-4">
          <Loader2 className="animate-spin text-green-600" size={32} />
          <p className="font-black text-slate-400 uppercase text-[10px] tracking-widest animate-pulse">Calcul en cours...</p>
        </div>
      ) : !stats ? (
        <div className="text-center py-16 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 px-6">
          <p className="text-slate-400 font-bold italic text-lg md:text-xl">Aucune donnée pour cette période</p>
        </div>
      ) : (
        <>
          {/* STATS GLOBALES ADAPTIVES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex md:flex-col items-center md:items-start gap-4 md:gap-0">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-xl md:rounded-2xl flex items-center justify-center text-white md:mb-4 shrink-0"><Users size={20} /></div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Effectif</p>
                  <h3 className="text-2xl md:text-4xl font-black text-slate-900">{stats.global.total}</h3>
                </div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex md:flex-col items-center md:items-start gap-4 md:gap-0">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-500 rounded-xl md:rounded-2xl flex items-center justify-center text-white md:mb-4 shrink-0"><Award size={20} /></div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Admis</p>
                  <div className="flex items-baseline gap-2">
                      <h3 className="text-2xl md:text-4xl font-black text-slate-900">{stats.global.admit}</h3>
                      <span className="text-emerald-600 font-bold text-[10px] md:text-sm">({((stats.global.admit/stats.global.total)*100).toFixed(0)}%)</span>
                  </div>
                </div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex md:flex-col items-center md:items-start gap-4 md:gap-0">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-rose-500 rounded-xl md:rounded-2xl flex items-center justify-center text-white md:mb-4 shrink-0"><AlertTriangle size={20} /></div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Échecs</p>
                  <div className="flex items-baseline gap-2">
                      <h3 className="text-2xl md:text-4xl font-black text-slate-900">{stats.global.fail}</h3>
                      <span className="text-rose-600 font-bold text-[10px] md:text-sm">({((stats.global.fail/stats.global.total)*100).toFixed(0)}%)</span>
                  </div>
                </div>
            </div>
          </div>

          {/* TOP & FLOP */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
            <RankingCard title="Top 10 - Excellence" data={stats.top10} color="emerald" icon={<Trophy size={20} />} />
            <RankingCard title="Top 10 - Soutien" data={stats.flop10} color="rose" icon={<AlertTriangle size={20} />} />
          </div>

          {/* MAJORS RESPONSIVE */}
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3">
              <Star className="text-amber-500 fill-amber-500" size={20} /> Majors
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {Object.entries(stats.subjectMajors).map(([subject, data]: any) => (
                <div key={subject} className="bg-white p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 flex md:flex-col items-center justify-between md:justify-center text-center shadow-sm">
                  <div className="text-left md:text-center">
                    <p className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 mb-1">{subject}</p>
                    <p className="font-black text-slate-900 text-xs md:text-sm mb-0 md:mb-3 truncate max-w-[140px] md:max-w-full">{data.studentName}</p>
                  </div>
                  <span className="bg-amber-100 text-amber-700 px-3 py-1 md:px-4 md:py-1 rounded-full font-black text-[10px] md:text-xs shrink-0">{data.score}/20</span>
                </div>
              ))}
            </div>
          </div>

          {/* PERFORMANCE PAR CLASSE */}
          <div className="bg-slate-900 p-6 md:p-12 rounded-[2.5rem] md:rounded-[4rem] text-white">
            <h2 className="text-xl md:text-3xl font-black italic mb-8 md:text-center">Taux par Classe</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(stats.classStats).map(([name, data]: any) => {
                const percent = Math.round((data.admit / (data.admit + data.fail)) * 100);
                return (
                  <div key={name} className="bg-slate-800/40 p-6 md:p-8 rounded-3xl border border-slate-700/50">
                    <p className="text-slate-500 text-[9px] md:text-[10px] font-black uppercase mb-3 tracking-widest">{name}</p>
                    <div className="flex justify-between items-end mb-4">
                      <span className="text-3xl md:text-5xl font-black tracking-tighter">{percent}%</span>
                      <span className="text-green-400 font-bold text-[10px] uppercase mb-1">Succès</span>
                    </div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-green-500 h-full transition-all duration-1000" style={{ width: `${percent}%` }} />
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

function RankingCard({ title, data, color, icon }: any) {
  const isEmerald = color === 'emerald';
  return (
    <div className="bg-white p-5 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-100 shadow-sm">
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <div className={`p-2.5 rounded-xl ${isEmerald ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{icon}</div>
        <h2 className="text-lg md:text-xl font-black italic text-slate-900">{title}</h2>
      </div>
      <div className="space-y-2.5">
        {data.map((s: any, i: number) => (
          <div key={i} className={`flex items-center justify-between p-3.5 md:p-4 rounded-xl md:rounded-2xl border-l-4 ${isEmerald ? 'bg-emerald-50/20 border-emerald-500' : 'bg-rose-50/20 border-rose-500'}`}>
            <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
              <span className={`font-black text-xs md:text-sm shrink-0 ${isEmerald ? 'text-emerald-600' : 'text-rose-600'}`}>#{i+1}</span>
              <div className="truncate">
                <p className="font-black text-slate-900 text-xs md:text-sm truncate">{s.name}</p>
                <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{s.className}</p>
              </div>
            </div>
            <span className={`px-3 py-1 md:px-4 md:py-1 rounded-lg md:rounded-xl font-black text-xs md:text-sm bg-white shadow-sm border shrink-0 ${isEmerald ? 'text-emerald-600 border-emerald-100' : 'text-rose-600 border-rose-100'}`}>
              {s.average.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}