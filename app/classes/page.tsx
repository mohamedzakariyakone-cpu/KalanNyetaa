"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { offlineFetch, offlineWrite } from '@/utils/offlineApi';
import { useYear } from '@/context/YearContext';
import { useCacheRefresh } from '@/hooks/useCacheRefresh';
import { 
  Trash2, Plus, School, Search, Loader2, ArrowUpRight, 
  Users, Lock, AlertCircle, RefreshCw
} from 'lucide-react';
import Link from 'next/link';

// Palettes Material UI douces pour chaque cycle
const CYCLES = [
  { 
    id: "Maternelle", 
    label: "Maternelle",
    dot: "bg-rose-500",
    activeClass: "bg-rose-600 text-white border-rose-600 shadow-xs",
    inactiveClass: "text-rose-950 bg-rose-50/70 border-rose-200/80 hover:bg-rose-100/70",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-rose-200/60 text-rose-900",
    subActive: "text-rose-100",
    subInactive: "text-rose-700/80"
  },
  { 
    id: "Premier Cycle", 
    label: "Premier Cycle (Primaire)",
    dot: "bg-amber-500",
    activeClass: "bg-amber-600 text-white border-amber-600 shadow-xs",
    inactiveClass: "text-amber-950 bg-amber-50/70 border-amber-200/80 hover:bg-amber-100/70",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-amber-200/60 text-amber-900",
    subActive: "text-amber-100",
    subInactive: "text-amber-700/80"
  },
  { 
    id: "Second Cycle", 
    label: "Second Cycle (Collège)",
    dot: "bg-emerald-500",
    activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-xs",
    inactiveClass: "text-emerald-950 bg-emerald-50/70 border-emerald-200/80 hover:bg-emerald-100/70",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-emerald-200/60 text-emerald-900",
    subActive: "text-emerald-100",
    subInactive: "text-emerald-700/80"
  },
  { 
    id: "Lycée", 
    label: "Lycée",
    dot: "bg-indigo-500",
    activeClass: "bg-indigo-600 text-white border-indigo-600 shadow-xs",
    inactiveClass: "text-indigo-950 bg-indigo-50/70 border-indigo-200/80 hover:bg-indigo-100/70",
    badgeActive: "bg-white/20 text-white",
    badgeInactive: "bg-indigo-200/60 text-indigo-900",
    subActive: "text-indigo-100",
    subInactive: "text-indigo-700/80"
  }
];

export default function ClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [className, setClassName] = useState('');
  const [selectedCycle, setSelectedCycle] = useState('Premier Cycle');
  const [activeCycleFilter, setActiveCycleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);

  const { selectedYearId, selectedYear, isReadOnly, isLoading: yearLoading } = useYear();

  const fetchClasses = useCallback(async (forceRefresh = false) => {
    if (!selectedYearId) return;
    
    if (forceRefresh) setIsRefreshing(true);
    if (classes.length === 0) setLoading(true);

    const { data, error } = await offlineFetch<any[]>(
      `classes:${selectedYearId}`, 
      async () => {
        return await supabase
          .from('classes')
          .select('*, students(id)')
          .eq('academic_year_id', selectedYearId)
          .order('name');
      },
      forceRefresh ? { forceRefresh: true } : undefined
    );

    if (error) console.error('Erreur récupération classes:', error);
    
    setClasses(data || []);
    setLoading(false);
    setIsRefreshing(false);
  }, [selectedYearId, classes.length]);

  useCacheRefresh({
    cachePattern: /^classes:/,
    onInvalidate: () => fetchClasses(true),
    debounceMs: 150,
    refreshOnFocus: true,
    refreshOnVisibilityChange: true,
    refreshIntervalMs: 120000,
  });

  useEffect(() => {
    const handleGlobalRefresh = () => fetchClasses(true);
    window.addEventListener('global-sync-success', handleGlobalRefresh);
    return () => window.removeEventListener('global-sync-success', handleGlobalRefresh);
  }, [fetchClasses]);

  useEffect(() => { 
    if (!yearLoading && selectedYearId) fetchClasses(); 
  }, [fetchClasses, yearLoading, selectedYearId]);

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className || !selectedCycle || !selectedYearId || isReadOnly) return;
    setSubmitting(true);

    const upperName = className.toUpperCase().trim();

    const { error } = await offlineWrite({
      table: 'classes',
      action: 'INSERT',
      payload: { name: upperName, level: selectedCycle, academic_year_id: selectedYearId },
      cacheKey: `classes:${selectedYearId}`,
      optimisticUpdate: () => {
        setClasses((prev) => [
          { id: `offline-${Date.now()}`, name: upperName, level: selectedCycle, academic_year_id: selectedYearId, students: [] },
          ...prev,
        ]);
      },
    });

    if (error) {
      alert("Erreur : Cette classe existe déjà !");
    } else {
      setClassName(''); 
      setShowAddSection(false);
      await fetchClasses(true);
    }
    setSubmitting(false);
  };

  const deleteClass = async (id: string, name: string) => {
    if (isReadOnly) return;
    if (window.confirm(`Confirmez-vous la suppression définitive de ${name} ?`)) {
      const { error } = await offlineWrite({
        table: 'classes',
        action: 'DELETE',
        payload: {},
        options: { keyColumn: 'id', keyValue: id },
        cacheKey: `classes:${selectedYearId}`,
        optimisticUpdate: () => {
          setClasses((prev) => prev.filter((cls) => String(cls.id) !== id));
        },
      });

      if (error) {
        alert("Impossible de supprimer cette classe.");
      } else {
        await fetchClasses(true);
      }
    }
  };

  const cycleMetrics = useMemo(() => {
    const metrics: Record<string, { count: number; students: number }> = {
      all: { count: classes.length, students: 0 }
    };

    CYCLES.forEach(c => {
      metrics[c.id] = { count: 0, students: 0 };
    });

    classes.forEach(c => {
      const studentCount = c.students?.length || 0;
      metrics.all.students += studentCount;

      if (metrics[c.level]) {
        metrics[c.level].count += 1;
        metrics[c.level].students += studentCount;
      }
    });

    return metrics;
  }, [classes]);

  const filteredClasses = useMemo(() => {
    return classes.filter(cls => {
      const matchSearch = cls.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCycle = activeCycleFilter === 'all' || cls.level === activeCycleFilter;
      return matchSearch && matchCycle;
    });
  }, [classes, searchTerm, activeCycleFilter]);

  const totalStudents = useMemo(() => {
    return classes.reduce((acc, cls) => acc + (cls.students?.length || 0), 0);
  }, [classes]);

  if (yearLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-500 font-bold gap-2">
        <Loader2 className="animate-spin text-blue-600" size={22} />
        <span className="text-sm">Chargement des données...</span>
      </div>
    );
  }

  if (!selectedYearId) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white border border-amber-200 p-6 rounded-2xl text-center text-amber-900 shadow-xs">
        <AlertCircle size={32} className="mx-auto mb-3 text-amber-600" />
        <h2 className="text-base font-bold mb-1">Aucune session active</h2>
        <p className="text-xs text-slate-600 font-medium">Sélectionnez une année scolaire dans le menu supérieur.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6 antialiased text-slate-900">
      
      {/* 1. EN-TÊTE ÉPURÉ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Organisation de l'établissement</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Structure des Classes
          </h1>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => fetchClasses(true)}
            disabled={isRefreshing || loading}
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl transition disabled:opacity-50"
            title="Rafraîchir"
          >
            <RefreshCw size={15} className={isRefreshing ? "animate-spin text-blue-600" : ""} />
          </button>

          {!isReadOnly && (
            <button
              onClick={() => {
                setShowAddSection(!showAddSection);
                if (activeCycleFilter !== 'all') setSelectedCycle(activeCycleFilter);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <Plus size={15} />
              <span>{showAddSection ? "Fermer" : "Ajouter une classe"}</span>
            </button>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-2 text-xs font-bold text-amber-900">
          <Lock size={15} className="text-amber-700 shrink-0" />
          <span>Année scolaire en lecture seule. La création et la suppression sont désactivées.</span>
        </div>
      )}

      {/* 2. FORMULAIRE INLINE COMPACT (SUR DEMANDE) */}
      {showAddSection && !isReadOnly && (
        <form onSubmit={addClass} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-3 animate-in fade-in duration-150">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Création rapide d'une section</h3>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-6 space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Intitulé de la classe</label>
              <input
                type="text"
                placeholder="Ex: 8ÈME ANNÉE B, 11ÈME SCIENCES..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:bg-white focus:border-blue-600 transition"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="sm:col-span-4 space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Cycle d'enseignement</label>
              <select
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-600 transition cursor-pointer"
                value={selectedCycle}
                onChange={(e) => setSelectedCycle(e.target.value)}
                required
              >
                {CYCLES.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin" size={15} /> : "Enregistrer"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 3. DISPOSITION MASTER-DETAIL : CARTE DES CYCLES MATERIAL UI & REGISTRE SOBRE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Colonne Gauche : Card des cycles avec couleurs Material UI */}
        <div className="lg:col-span-4 space-y-2">
          <div className="bg-white border border-slate-200 rounded-2xl p-2.5 space-y-2 shadow-xs">
            <div className="px-2 pt-1 pb-1 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cycles scolaires</span>
              <span className="text-[11px] font-bold text-slate-600">{classes.length} classes</span>
            </div>

            {/* Bouton Toutes les classes (Style Neutre Material) */}
            <button
              onClick={() => setActiveCycleFilter('all')}
              className={`w-full p-3 rounded-xl text-left flex items-center justify-between border transition-all ${
                activeCycleFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'text-slate-800 bg-slate-50/80 border-slate-200/70 hover:bg-slate-100'
              }`}
            >
              <div>
                <span className="text-xs font-bold block">Toutes les classes</span>
                <span className={`text-[11px] font-semibold block mt-0.5 ${activeCycleFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
                  {cycleMetrics.all.students} élèves au total
                </span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-lg font-bold ${
                activeCycleFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-800'
              }`}>
                {cycleMetrics.all.count}
              </span>
            </button>

            {/* Boutons colorés selon Material UI pour chaque cycle */}
            {CYCLES.map(c => {
              const isActive = activeCycleFilter === c.id;
              const data = cycleMetrics[c.id] || { count: 0, students: 0 };

              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCycleFilter(c.id)}
                  className={`w-full p-3 rounded-xl text-left flex items-center justify-between border transition-all ${
                    isActive ? c.activeClass : c.inactiveClass
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-white' : c.dot}`} />
                      <span className="text-xs font-bold truncate block">{c.label}</span>
                    </div>
                    <span className={`text-[11px] font-semibold block mt-0.5 pl-4 ${isActive ? c.subActive : c.subInactive}`}>
                      {data.students} élève{data.students > 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-lg font-bold shrink-0 ${
                    isActive ? c.badgeActive : c.badgeInactive
                  }`}>
                    {data.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Colonne Droite : Registre des classes (Uniforme, propre et plat) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Barre de filtre textuel */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Filtrer une classe par son nom..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600 transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Registre des sections (Design sobre sans couleur individuelle superflue) */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            {loading && classes.length === 0 ? (
              <div className="p-10 text-center text-xs font-bold text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="animate-spin text-blue-600" size={18} />
                Chargement des sections...
              </div>
            ) : filteredClasses.length === 0 ? (
              <div className="p-10 text-center text-xs font-bold text-slate-400">
                Aucune classe enregistrée dans ce filtre.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredClasses.map((cls) => {
                  const studentCount = cls.students?.length || 0;

                  return (
                    <div
                      key={cls.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition"
                    >
                      <div className="min-w-0 space-y-1">
                        <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
                          {cls.name}
                        </h4>
                        <span className="text-xs text-slate-500 font-medium block">
                          Cycle : {cls.level}
                        </span>
                      </div>

                      <div className="flex items-center gap-3.5 shrink-0">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                          <Users size={13} className="text-slate-400" />
                          <span>{studentCount} élève{studentCount > 1 ? 's' : ''}</span>
                        </span>

                        <Link
                          href={`/students?class=${cls.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition px-2.5 py-1.5 rounded-lg hover:bg-blue-50"
                        >
                          <span>Fiches</span>
                          <ArrowUpRight size={14} />
                        </Link>

                        {!isReadOnly && (
                          <button
                            onClick={() => deleteClass(cls.id, cls.name)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Supprimer la classe"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}