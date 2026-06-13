'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { offlineFetch, offlineWrite } from '@/utils/offlineApi';
import { useYear } from '@/context/YearContext';
import { Trash2, PlusCircle, School, Search, Loader2, ArrowUpRight, Users, Lock, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function ClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [className, setClassName] = useState('');
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Hook pour l'année scolaire
  const { selectedYearId, selectedYear, isReadOnly, isLoading: yearLoading } = useYear();

  const fetchClasses = useCallback(async () => {
    if (!selectedYearId) return;

    // Suppression du setLoading(true) bloquant s'il y a déjà des données affichées à l'écran
    if (classes.length === 0) {
      setLoading(true);
    }

    const { data, error } = await offlineFetch<any[]>(`classes:${selectedYearId}`, async () => {
      return await supabase
        .from('classes')
        .select('*, students(id)')
        .eq('academic_year_id', selectedYearId)
        .order('name');
    });

    if (error) {
      console.error('Erreur de récupération des classes hors ligne :', error);
    }

    setClasses(data || []);
    setLoading(false);
  }, [selectedYearId, classes.length]);

  useEffect(() => { 
    if (!yearLoading && selectedYearId) {
      fetchClasses(); 
    }
  }, [fetchClasses, yearLoading, selectedYearId]);

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className || !level || !selectedYearId || isReadOnly) return;
    setSubmitting(true);

    const { error } = await offlineWrite({
      table: 'classes',
      action: 'INSERT',
      payload: {
        name: className.toUpperCase(),
        level,
        academic_year_id: selectedYearId,
      },
      cacheKey: `classes:${selectedYearId}`,
      optimisticUpdate: () => {
        setClasses((prev) => [
          { id: `offline-${Date.now()}`, name: className.toUpperCase(), level, academic_year_id: selectedYearId, students: [] },
          ...prev,
        ]);
      },
    });

    if (error) {
      alert("Erreur : Cette classe existe déjà !");
    } else {
      setClassName(''); setLevel('');
      fetchClasses();
    }
    setSubmitting(false);
  };

  const deleteClass = async (id: string, name: string) => {
    if (isReadOnly) return;
    const confirmed = window.confirm(`Voulez-vous vraiment supprimer la classe ${name} ?`);
    if (confirmed) {
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
        alert("Impossible de supprimer : Des élèves sont peut-être liés à cette classe.");
      } else {
        fetchClasses();
      }
    }
  };

  const filteredClasses = classes.filter(cls =>
    cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.level.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // État de chargement de l'année scolaire
  if (yearLoading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-3xl border border-slate-100 shadow-sm text-slate-500 font-bold gap-3">
        <Loader2 className="animate-spin text-green-600" size={24} />
        <span>Chargement des paramètres de l'année scolaire...</span>
      </div>
    );
  }

  // Affichage si aucune année n'est sélectionnée
  if (!selectedYearId) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-8 rounded-3xl text-center text-amber-800">
        <AlertCircle size={36} className="mx-auto mb-4 text-amber-600 animate-bounce" />
        <h2 className="text-lg font-black mb-1">Aucune année scolaire sélectionnée</h2>
        <p className="text-sm opacity-85 max-w-md mx-auto">
          Veuillez sélectionner ou activer une année scolaire dans le menu latéral avant de gérer les classes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-8">
        <div>
          <p className="text-sm font-medium text-green-600">Configuration</p>
          <h1 className="text-4xl font-extrabold tracking-tighter text-slate-950 flex items-center gap-3">
            <School className="text-slate-400" size={36} /> Structure de l'école
          </h1>
          <p className="text-slate-600 mt-2 max-w-lg">Gérez les classes et niveaux d'enseignement de votre établissement.</p>
          {selectedYear && !selectedYear.is_current && (
            <p className="text-[10px] font-bold text-amber-600 mt-2 flex items-center gap-1">
              <AlertCircle size={12} /> Année historique - Lecture seule
            </p>
          )}
        </div>
      </div>

      {/* Alerte si lecture seule */}
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-700">
          <Lock size={18} />
          <div>
            <p className="font-bold text-sm">Mode lecture seule</p>
            <p className="text-xs opacity-75">Vous consultez une année scolaire archivée. Les modifications ne sont pas autorisées.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 items-start">
        
        {/* Formulaire d'ajout (Col 1) */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 xl:col-span-1 xl:sticky top-10">
          <h2 className="text-xl font-bold mb-1 text-slate-950">Nouvelle Classe</h2>
          <p className="text-sm text-slate-500 mb-6">Enregistrez une section d'enseignement.</p>
          
          <form onSubmit={addClass} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom de la classe</label>
              <input
                type="text"
                placeholder="ex: 10ÈME LETTRES, CM2 B"
                className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none transition uppercase font-bold disabled:opacity-50"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                disabled={isReadOnly}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Niveau d'enseignement</label>
              <select 
                className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none bg-white transition cursor-pointer font-medium disabled:opacity-50"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                disabled={isReadOnly}
                required
              >
                <option value="">Sélectionner...</option>
                <option value="Maternelle">🧸 Maternelle</option>
                <option value="Premier Cycle">📖 Premier Cycle (Primaire)</option>
                <option value="Second Cycle">🏫 Second Cycle (Collège)</option>
                <option value="Lycée">🔬 Lycée</option>
              </select>
            </div>

            <button 
              type="submit"
              disabled={submitting || isReadOnly}
              className="w-full bg-slate-950 text-white p-4 rounded-xl hover:bg-green-600 transition-all flex items-center justify-center gap-2 font-black text-xs uppercase shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="animate-spin" size={20}/> : <PlusCircle size={20} />}
              {isReadOnly ? 'Lecture seule' : 'Créer la classe'}
            </button>
          </form>
        </div>

        {/* Liste des classes (Col 2-3) */}
        <div className="xl:col-span-2 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher une classe..." 
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-100 rounded-2xl shadow-inner outline-none focus:ring-2 focus:ring-green-100"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* L'indicateur de chargement global ne bloque la vue que si l'état local contient 0 classe */}
          {loading && classes.length === 0 ? (
            <div className="flex items-center gap-3 text-slate-500 p-6"><Loader2 className="animate-spin text-green-600"/> Chargement des classes...</div>
          ) : filteredClasses.length === 0 ? (
            <div className="bg-white text-center p-12 rounded-3xl border border-dashed border-slate-200 text-slate-500">Aucune classe enregistrée.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredClasses.map((cls) => (
                <div key={cls.id} className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col group hover:border-green-500 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                  
                  {/* Bouton de suppression discret en haut à droite */}
                  <button 
                    onClick={(e) => { e.preventDefault(); deleteClass(cls.id, cls.name); }}
                    disabled={isReadOnly}
                    className={`absolute top-4 right-4 transition-colors z-20 ${isReadOnly ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-red-500'}`}
                  >
                    {isReadOnly ? <Lock size={16} /> : <Trash2 size={16} />}
                  </button>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200 group-hover:bg-green-600 group-hover:text-white transition-all">
                      <School size={20} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-950 tracking-tight">{cls.name}</h3>
                      <span className="text-[10px] text-green-600 font-black uppercase tracking-widest">{cls.level}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Users size={14} />
                      <span className="text-xs font-bold">{cls.students?.length || 0} élèves</span>
                    </div>
                    
                    {/* LIEN VERS LES ÉLÈVES DE CETTE CLASSE */}
                    <Link 
                      href={`/students?class=${cls.id}`}
                      className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-green-600 hover:text-green-800 transition-colors"
                    >
                      Voir la liste <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}