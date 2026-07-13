"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { offlineFetch, offlineWrite } from '@/utils/offlineApi';
import { useYear } from '@/context/YearContext';
import { useCacheRefresh } from '@/hooks/useCacheRefresh';
import { Trash2, PlusCircle, School, Search, Loader2, ArrowUpRight, Users, Lock, AlertCircle, Layers, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const LEVELS = [
  { id: "Maternelle", label: "🧸 Maternelle", color: "bg-pink-50/60 text-pink-700 border-pink-100", dot: "bg-pink-500" },
  { id: "Premier Cycle", label: "📖 Premier Cycle (Primaire)", color: "bg-blue-50/60 text-blue-700 border-blue-100", dot: "bg-blue-500" },
  { id: "Second Cycle", label: "🏫 Second Cycle (Collège)", color: "bg-purple-50/60 text-purple-700 border-purple-100", dot: "bg-purple-500" },
  { id: "Lycée", label: "🔬 Lycée", color: "bg-indigo-50/60 text-indigo-700 border-indigo-100", dot: "bg-indigo-500" }
];

export default function ClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [className, setClassName] = useState('');
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { selectedYearId, selectedYear, isReadOnly, isLoading: yearLoading } = useYear();

  // Déclaration de fetchClasses acceptant un rafraîchissement forcé
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

    if (error) console.error('Erreur de récupération des classes:', error);
    
    setClasses(data || []);
    setLoading(false);
    setIsRefreshing(false);
  }, [selectedYearId, classes.length]);

  // Hook pour rafraîchir automatiquement quand le cache local est invalidé
  useCacheRefresh({
    cachePattern: /^classes:/,
    onInvalidate: () => fetchClasses(true),
    debounceMs: 150,
    refreshOnFocus: true,
    refreshOnVisibilityChange: true,
    refreshIntervalMs: 120000,
  });

  // ÉCOUTEUR : Capte l'événement global de réussite envoyé par OfflineSync
  useEffect(() => {
    const handleGlobalRefresh = () => {
      fetchClasses(true); 
    };

    window.addEventListener('global-sync-success', handleGlobalRefresh);
    return () => window.removeEventListener('global-sync-success', handleGlobalRefresh);
  }, [fetchClasses]);

  useEffect(() => { 
    if (!yearLoading && selectedYearId) fetchClasses(); 
  }, [fetchClasses, yearLoading, selectedYearId]);

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className || !level || !selectedYearId || isReadOnly) return;
    setSubmitting(true);

    const upperName = className.toUpperCase();

    const { error } = await offlineWrite({
      table: 'classes',
      action: 'INSERT',
      payload: { name: upperName, level, academic_year_id: selectedYearId },
      cacheKey: `classes:${selectedYearId}`,
      optimisticUpdate: () => {
        setClasses((prev) => [
          { id: `offline-${Date.now()}`, name: upperName, level, academic_year_id: selectedYearId, students: [] },
          ...prev,
        ]);
      },
    });

    if (error) {
      alert("Erreur : Cette classe existe déjà !");
    } else {
      setClassName(''); 
      setLevel('');
      // 🔄 ACTUALISATION FORCÉE IMMÉDIATE APRÈS ENREGISTREMENT TERMINÉ
      await fetchClasses(true);
    }
    setSubmitting(false);
  };

  const deleteClass = async (id: string, name: string) => {
    if (isReadOnly) return;
    if (window.confirm(`Voulez-vous vraiment supprimer la classe ${name} ?`)) {
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

  const classesByLevel = useMemo(() => {
    const filtered = classes.filter(cls =>
      cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.level.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groups: Record<string, any[]> = { "Maternelle": [], "Premier Cycle": [], "Second Cycle": [], "Lycée": [] };
    filtered.forEach(cls => {
      if (groups[cls.level] !== undefined) groups[cls.level].push(cls);
      else {
        if (!groups[cls.level]) groups[cls.level] = [];
        groups[cls.level].push(cls);
      }
    });
    return groups;
  }, [classes, searchTerm]);

  const totalStudents = useMemo(() => {
    return classes.reduce((acc, cls) => acc + (cls.students?.length || 0), 0);
  }, [classes]);

  if (yearLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-500 font-medium gap-2">
        <Loader2 className="animate-spin text-green-600" size={20} />
        <span className="text-sm">Chargement des paramètres...</span>
      </div>
    );
  }

  if (!selectedYearId) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-amber-50/60 border border-amber-100 p-6 rounded-2xl text-center text-amber-800">
        <AlertCircle size={28} className="mx-auto mb-3 text-amber-600" />
        <h2 className="text-base font-bold mb-1">Aucune année scolaire active</h2>
        <p className="text-xs opacity-90">Veuillez sélectionner une année scolaire dans le menu pour gérer la structure.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-8 antialiased text-slate-800">
      
      {/* Header épuré avec bouton Actualiser */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <School className="text-slate-400" size={24} /> Structure Pédagogique
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Année Académique : <span className="text-green-600 font-semibold">{typeof selectedYear === 'object' ? selectedYear?.label : selectedYear}</span>
          </p>
        </div>

        {/* Bloc actions & stats à droite */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {/* BOUTON ACTUALISER MANUEL */}
          <button
            onClick={() => fetchClasses(true)}
            disabled={isRefreshing || loading}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold uppercase tracking-wider shadow-2xs transition active:scale-95 disabled:opacity-60"
          >
            <RefreshCw size={12} className={`${isRefreshing ? 'animate-spin text-green-600' : 'text-slate-500'}`} />
            <span>{isRefreshing ? 'Mise à jour...' : 'Actualiser'}</span>
          </button>

          {/* Badges de statistiques légers */}
          <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 text-[11px] font-semibold text-slate-500">
            <span className="flex items-center gap-1"><Layers size={12}/> <strong>{classes.length}</strong> Classes</span>
            <span className="text-slate-200">|</span>
            <span className="flex items-center gap-1"><Users size={12}/> <strong>{totalStudents}</strong> Élèves</span>
          </div>
        </div>
      </div>

      {/* Alerte si lecture seule */}
      {isReadOnly && (
        <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 flex items-center gap-2.5 text-amber-800 text-xs">
          <Lock size={14} className="shrink-0 text-amber-600" />
          <p><strong>Mode lecture seule :</strong> Cette année scolaire est archivée. Modifications désactivées.</p>
        </div>
      )}

      {/* Layout Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Formulaire de création */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-xs lg:col-span-1 lg:sticky lg:top-6 order-1 lg:order-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 mb-1">
            Créer une classe
          </h2>
          <p className="text-[11px] text-slate-400 mb-4">Ajoutez une nouvelle section d'enseignement.</p>
          
          <form onSubmit={addClass} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 block pl-0.5">Nom complet</label>
              <input
                type="text"
                placeholder="Ex: 10ÈME LETTRES, CM2 B"
                className="w-full p-2.5 bg-slate-50/50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500/10 focus:border-green-500 outline-none text-xs font-bold uppercase transition disabled:opacity-50"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                disabled={isReadOnly}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 block pl-0.5">Niveau / Cycle</label>
              <select 
                className="w-full p-2.5 bg-slate-50/50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500/10 focus:border-green-500 outline-none text-xs font-medium cursor-pointer transition disabled:opacity-50"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                disabled={isReadOnly}
                required
              >
                <option value="">Sélectionner...</option>
                {LEVELS.map(l => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* BOUTON AVEC ÉTAT D'ENREGISTREMENT ET ACTUALISATION INTÉGRÉE */}
            <button 
              type="submit"
              disabled={submitting || isReadOnly}
              className={`w-full text-white py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 font-bold text-xs shadow-xs disabled:opacity-50 ${
                submitting ? 'bg-green-700' : 'bg-slate-900 hover:bg-green-700'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={14}/>
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <PlusCircle size={14} />
                  <span>{isReadOnly ? 'Verrouillé' : 'Enregistrer la classe'}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Section Affichage et Recherche */}
        <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
          
          {/* Barre de recherche */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Filtrer par nom de classe..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500/10 focus:border-green-500 text-xs transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading && classes.length === 0 ? (
            <div className="flex items-center gap-2 text-slate-400 py-12 justify-center bg-white rounded-xl border border-slate-100 text-xs">
              <Loader2 className="animate-spin text-green-600" size={16}/> Chargement de la structure...
            </div>
          ) : classes.length === 0 ? (
            <div className="bg-white text-center p-12 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
              Aucune classe configurée pour cette année scolaire.
            </div>
          ) : (
            <div className="space-y-8">
              {LEVELS.map(lvl => {
                const levelClasses = classesByLevel[lvl.id] || [];
                if (levelClasses.length === 0 && searchTerm) return null;

                return (
                  <div key={lvl.id} className="space-y-3">
                    
                    {/* En-tête de catégorie */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 pl-1">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-3 h-3 rounded-full ${lvl.dot} shrink-0`} />
                        <h2 className="text-sm md:text-base font-black text-slate-900 tracking-tight uppercase">
                          {lvl.label}
                        </h2>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {levelClasses.length} {levelClasses.length > 1 ? 'classes' : 'classe'}
                      </span>
                    </div>

                    {levelClasses.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic pl-5">Aucune classe indexée dans cette catégorie.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {levelClasses.map((cls) => (
                          <div key={cls.id} className="bg-white p-4 rounded-xl border border-slate-200/70 shadow-2xs hover:border-slate-300 transition-all flex flex-col group relative">
                            
                            {/* Actions de suppression */}
                            <button 
                              onClick={(e) => { e.preventDefault(); deleteClass(cls.id, cls.name); }}
                              disabled={isReadOnly}
                              className={`absolute top-4 right-4 transition-colors z-20 ${isReadOnly ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-red-600'}`}
                            >
                              {isReadOnly ? <Lock size={12} /> : <Trash2 size={13} />}
                            </button>

                            <div className="mb-3">
                              <h3 className="text-sm font-bold text-slate-900 group-hover:text-green-700 transition-colors uppercase tracking-tight">{cls.name}</h3>
                              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Code unique : {cls.id.substring(0, 8).toUpperCase()}</p>
                            </div>

                            <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-slate-100">
                              <div className="flex items-center gap-1 text-slate-500">
                                <Users size={12} className="text-slate-400" />
                                <span className="text-xs font-semibold text-slate-600">{cls.students?.length || 0} Élèves</span>
                              </div>
                              
                              <Link 
                                href={`/students?class=${cls.id}`}
                                className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-600 hover:text-green-700 hover:underline"
                              >
                                Accéder aux fiches <ArrowUpRight size={12} />
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}