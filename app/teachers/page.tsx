'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { useYear } from '@/context/YearContext';
import { 
  UserCheck, Plus, Search, Mail, Phone, 
  Briefcase, Loader2, ExternalLink, GraduationCap, X, UserPlus, Trash2
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

  // Hook pour l'année scolaire
  const { selectedYearId, isReadOnly, isLoading: yearLoading } = useYear();

  // Utilisation de useCallback pour stabiliser la fonction
  const fetchTeachers = useCallback(async () => {
    if (!selectedYearId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('academic_year_id', selectedYearId)
      .order('created_at', { ascending: false });
    
    if (error) console.error("Erreur:", error);
    else setTeachers(data || []);
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
    
    const { error } = await supabase.from('teachers').insert([{
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      specialty: formData.specialty,
      status: formData.status,
      academic_year_id: selectedYearId
    }]);

    if (!error) {
      setFormData({ firstName: '', lastName: '', email: '', phone: '', specialty: '', status: 'Actif' });
      await fetchTeachers(); // RECHARGE la liste immédiatement
    } else {
      alert("Erreur lors de l'enregistrement.");
    }
    setIsSubmitting(false);
  };

  const handleDeleteTeacher = async (id: string) => {
    if (isReadOnly) return;
    
    setDeletingId(id);
    const { error } = await supabase.from('teachers').delete().eq('id', id);
    if (!error) {
      setConfirmDeleteId(null);
      await fetchTeachers();
    } else {
      console.error(error);
      alert("Erreur lors de la suppression. Vérifiez les contraintes de la base.");
    }
    setDeletingId(null);
  };

  const filteredTeachers = teachers.filter(t => 
    `${t.first_name} ${t.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-10 max-w-7xl mx-auto">
      {/* --- HEADER (Style Éléves) --- */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 bg-green-600 rounded-full" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-600">Administration</p>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-slate-950 italic">
            Corps Enseignant
          </h1>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Experts</p>
            <p className="text-2xl font-black text-slate-950">{teachers.length}</p>
        </div>
      </div>

      {/* --- FORMULAIRE (Design "Fiche Élève") --- */}
      <div className="bg-white p-6 md:p-8 rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/50">
        <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-slate-950 rounded-xl text-white shadow-lg">
                <UserPlus size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Nouvel Enseignant</h2>
        </div>

        <form onSubmit={addTeacher} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Prénom</label>
                <input type="text" placeholder="Moussa" className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-green-500 outline-none font-bold" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} required />
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nom</label>
                <input type="text" placeholder="Diarra" className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-green-500 outline-none font-bold" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} required />
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Spécialité / Matière</label>
                <input type="text" placeholder="Mathématiques" className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-green-500 outline-none font-bold text-green-600" value={formData.specialty} onChange={(e) => setFormData({...formData, specialty: e.target.value})} required />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Téléphone</label>
                <input type="text" placeholder="+223 ..." className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-green-500 outline-none font-bold" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="space-y-1.5 text-sm font-black">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Statut Contractuel</label>
                <select className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-green-500 outline-none font-bold cursor-pointer" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                    <option value="Actif">Permanent (Actif)</option>
                    <option value="Vacataire">Vacataire</option>
                    <option value="Stagiaire">Stagiaire</option>
                </select>
            </div>
            <div className="flex items-end">
                <button type="submit" disabled={isSubmitting || isReadOnly} className={`w-full text-white p-4 rounded-2xl font-black text-xs uppercase transition-all shadow-xl disabled:opacity-50 ${isReadOnly ? 'bg-gray-400 cursor-not-allowed' : 'bg-slate-950 hover:bg-green-600'}`}>
                    {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : "Enregistrer le Professeur"}
                </button>
            </div>
          </div>
        </form>
      </div>

      {/* --- RECHERCHE --- */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Filtrer par nom ou matière..." 
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-3xl shadow-sm outline-none focus:ring-2 focus:ring-green-500 font-bold"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* --- LISTE DES PROFS (Design Cards Élégantes) --- */}
      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin text-green-600" size={40} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredTeachers.map((teacher) => (
            <div key={teacher.id} className="group bg-white p-6 md:p-8 rounded-[3.5rem] border border-slate-50 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div className="h-16 w-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl group-hover:bg-green-600 transition-colors">
                  {teacher.first_name[0]}{teacher.last_name[0]}
                </div>
                <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest ${
                  teacher.status === 'Actif' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-100'
                }`}>
                  {teacher.status}
                </span>
              </div>

              <h3 className="text-2xl font-black text-slate-950 mb-1 leading-tight">{teacher.first_name} <br/> {teacher.last_name}</h3>
              <p className="text-green-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 mb-6">
                <Briefcase size={12} fill="currentColor" /> {teacher.specialty}
              </p>

              <div className="space-y-3 border-t border-slate-50 pt-6">
                <div className="flex items-center gap-3 text-slate-500 text-xs font-bold">
                  <div className="p-1.5 bg-slate-50 rounded-lg"><Phone size={12} className="text-slate-400" /></div>
                  {teacher.phone || 'Non renseigné'}
                </div>
              </div>

              {/* Actions: suppression avec confirmation */}
              <div className="mt-6">
                {confirmDeleteId === teacher.id ? (
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-[10px] font-black uppercase text-rose-500">Sûr ?</span>
                    <button
                      onClick={() => handleDeleteTeacher(teacher.id)}
                      disabled={deletingId === teacher.id}
                      className="px-4 py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-rose-700 transition-all disabled:opacity-50"
                    >
                      {deletingId === teacher.id ? <Loader2 className="animate-spin" size={14} /> : 'Oui'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={deletingId === teacher.id}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase hover:bg-slate-300 transition-all"
                    >
                      Non
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setConfirmDeleteId(teacher.id)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase hover:bg-rose-100 transition-all"
                    >
                      <Trash2 size={14} /> Supprimer
                    </button>
                    <Link href={`/teachers/${teacher.id}`} className="w-full sm:w-auto mt-0 sm:mt-0 bg-slate-50 text-slate-900 py-3 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-950 hover:text-white transition-all flex items-center justify-center gap-2">
                      Dossier Enseignant <ExternalLink size={14} />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredTeachers.length === 0 && (
        <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <GraduationCap size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-500 font-black uppercase text-xs tracking-widest">Aucun enseignant trouvé</p>
        </div>
      )}
    </div>
  );
}