'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { offlineFetch, offlineWrite } from '@/utils/offlineApi';
import { useYear } from '@/context/YearContext';
import { useCacheRefresh } from '@/hooks/useCacheRefresh';
import { 
  Plus, Search, Phone, 
  Briefcase, Loader2, ExternalLink, GraduationCap, X, Trash2
} from 'lucide-react';
import Link from 'next/link';

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialty: '',
    status: 'Actif'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Hook pour l'année scolaire
  const { selectedYearId, isReadOnly, isLoading: yearLoading } = useYear();

  // Hook pour rafraîchir automatiquement quand le cache est invalidé
  useCacheRefresh({
    cachePattern: /^teachers:/,
    onInvalidate: () => fetchTeachers(),
    debounceMs: 150,
  });

  // Récupération des enseignants stabilisée via useCallback
  const fetchTeachers = useCallback(async () => {
    if (!selectedYearId) return;
    
    setLoading(true);
    const { data, error } = await offlineFetch<any[]>(`teachers:${selectedYearId}`, async () => {
      return await supabase
        .from('teachers')
        .select('*')
        .eq('academic_year_id', selectedYearId)
        .order('created_at', { ascending: false });
    });
    
    if (error) {
      console.error("Erreur de récupération :", error);
    }
    setTeachers(data || []);
    setLoading(false);
  }, [selectedYearId]);

  useEffect(() => { 
    if (!yearLoading && selectedYearId) {
      fetchTeachers(); 
    }
  }, [fetchTeachers, yearLoading, selectedYearId]);

  const addTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    
    setIsSubmitting(true);
    
    const payload = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      specialty: formData.specialty,
      status: formData.status,
      academic_year_id: selectedYearId,
      attendance_status: 'present',
      last_attendance_update: new Date().toISOString().split('T')[0]
    };
    
    const { error } = await offlineWrite({
      table: 'teachers',
      action: 'INSERT',
      payload: payload,
      cacheKey: `teachers:${selectedYearId}`,
      optimisticUpdate: () => {
        setTeachers((prev) => [
          { 
            id: `offline-${Date.now()}`, 
            ...payload 
          },
          ...prev,
        ]);
      }
    });

    if (!error) {
      setFormData({ firstName: '', lastName: '', email: '', phone: '', specialty: '', status: 'Actif' });
      setShowAddForm(false);
    } else {
      console.error(error);
      alert("Erreur lors de l'enregistrement de l'enseignant.");
    }
    setIsSubmitting(false);
  };

  const handleDeleteTeacher = async (id: string) => {
    if (isReadOnly) return;
    
    setDeletingId(id);
    const { error } = await offlineWrite({
      table: 'teachers',
      action: 'DELETE',
      payload: {},
      options: { keyColumn: 'id', keyValue: id },
      cacheKey: `teachers:${selectedYearId}`,
      optimisticUpdate: () => {
        setTeachers((prev) => prev.filter((teacher) => String(teacher.id) !== id));
      }
    });
    
    if (!error) {
      setConfirmDeleteId(null);
    } else {
      console.error(error);
      alert("Erreur lors de la suppression. Vérifiez les contraintes de clés étrangères (logs existants, etc.).");
    }
    setDeletingId(null);
  };

  // Filtrage optimisé et insensible à la casse
  const filteredTeachers = teachers.filter(t => 
    `${t.first_name || ''} ${t.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.specialty || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto px-4 sm:px-6 w-full text-slate-900 font-sans antialiased">
      
      {/* --- HEADER ÉPURÉ & PLAT --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Personnel Enseignant</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 capitalize">
            Corps Enseignant
          </h1>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200/80 text-xs font-bold text-slate-700">
            <span>Effectif : </span>
            <span className="text-blue-600 text-sm font-black">{teachers.length}</span>
            <span className="text-slate-400 font-normal"> enseignant{teachers.length > 1 ? 's' : ''}</span>
          </div>

          {!isReadOnly && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              {showAddForm ? <X size={15} /> : <Plus size={15} />}
              <span>{showAddForm ? 'Fermer' : 'Ajouter un enseignant'}</span>
            </button>
          )}
        </div>
      </div>

      {/* --- FORMULAIRE D'AJOUT PLAT --- */}
      {showAddForm && !isReadOnly && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 space-y-4 animate-in fade-in duration-150">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase">Nouvel Enseignant</h2>
              <p className="text-xs text-slate-500 font-medium">Inscription d'un membre du corps professoral</p>
            </div>
            <button 
              onClick={() => setShowAddForm(false)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={addTeacher} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Prénom</label>
                <input 
                  type="text" 
                  placeholder="Ex: Moussa" 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs text-slate-900 focus:border-blue-600 focus:bg-white transition" 
                  value={formData.firstName} 
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nom</label>
                <input 
                  type="text" 
                  placeholder="Ex: Diarra" 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs text-slate-900 focus:border-blue-600 focus:bg-white transition" 
                  value={formData.lastName} 
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Spécialité / Discipline</label>
                <input 
                  type="text" 
                  placeholder="Ex: Mathématiques, Histoire..." 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs text-blue-600 focus:border-blue-600 focus:bg-white transition" 
                  value={formData.specialty} 
                  onChange={(e) => setFormData({...formData, specialty: e.target.value})} 
                  required 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Numéro de Téléphone</label>
                <input 
                  type="text" 
                  placeholder="Ex: 70 00 00 00" 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs text-slate-900 focus:border-blue-600 focus:bg-white transition" 
                  value={formData.phone} 
                  onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Statut Contractuel</label>
                <select 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition cursor-pointer" 
                  value={formData.status} 
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="Actif">Permanent (Actif)</option>
                  <option value="Vacataire">Vacataire</option>
                  <option value="Stagiaire">Stagiaire</option>
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  type="submit" 
                  disabled={isSubmitting || isReadOnly} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-xs transition disabled:opacity-40 shadow-xs"
                >
                  {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={16} /> : "Valider l'enregistrement"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* --- BARRE DE RECHERCHE SIMPLE & PLATE --- */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold" />
          <input 
            type="text" 
            placeholder="Rechercher par nom ou discipline..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs text-slate-900 focus:border-blue-600 focus:bg-white transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2"
          >
            Effacer
          </button>
        )}
      </div>

      {/* --- REGISTRE DES ENSEIGNANTS : CARTES PLATES SANS BADGE DE STATUT --- */}
      {loading ? (
        <div className="flex justify-center p-16">
          <Loader2 className="animate-spin text-blue-600" size={28} />
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80">
          <GraduationCap size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">Aucun enseignant trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeachers.map((teacher) => (
            <div 
              key={teacher.id} 
              className="bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-blue-200 transition flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm uppercase shrink-0">
                    {teacher.first_name?.[0] || ''}{teacher.last_name?.[0] || ''}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-slate-900 capitalize truncate">
                      {teacher.first_name} {teacher.last_name}
                    </h3>
                    <p className="text-xs font-bold text-blue-600 flex items-center gap-1.5 mt-0.5 truncate">
                      <Briefcase size={13} className="shrink-0" />
                      <span>{teacher.specialty || 'Généraliste'}</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs text-slate-600 font-medium">
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700">{teacher.phone || 'Non renseigné'}</span>
                  </div>
                </div>
              </div>

              {/* Actions de pied de carte */}
              <div className="pt-3 border-t border-slate-100">
                {confirmDeleteId === teacher.id ? (
                  <div className="flex items-center justify-between gap-2 p-1.5 bg-rose-50 rounded-xl border border-rose-100">
                    <span className="text-[11px] font-bold text-rose-700 pl-1">Confirmer ?</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDeleteTeacher(teacher.id)}
                        disabled={deletingId === teacher.id}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                      >
                        {deletingId === teacher.id ? <Loader2 className="animate-spin" size={13} /> : 'Oui'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deletingId === teacher.id}
                        className="px-3 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition"
                      >
                        Non
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link 
                      href={`/teachers/${teacher.id}`} 
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-50/60 hover:bg-blue-100/80 text-blue-700 border border-blue-100 py-2 px-3 rounded-xl font-bold text-xs transition text-center"
                    >
                      <span>Fiche Enseignant</span>
                      <ExternalLink size={13} />
                    </Link>

                    {!isReadOnly && (
                      <button
                        onClick={() => setConfirmDeleteId(teacher.id)}
                        className="p-2 border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        title="Supprimer l'enseignant"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}