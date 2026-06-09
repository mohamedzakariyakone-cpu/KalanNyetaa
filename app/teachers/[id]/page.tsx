'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { 
  ArrowLeft, Phone, Mail, Calendar, Briefcase, 
  Loader2, Trash2, Edit3, Banknote, BookOpen, 
  Layers, ChevronRight, Settings2, Plus, Check,
  Clock, CalendarDays, GraduationCap, FileBadge
} from 'lucide-react';
import Link from 'next/link';

export default function TeacherProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [teacher, setTeacher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  
  const [inputValue, setInputValue] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => { fetchTeacher(); }, [id]);

  const fetchTeacher = async () => {
    const { data, error } = await supabase.from('teachers').select('*').eq('id', id).single();
    if (error) router.push('/teachers');
    else setTeacher(data);
    setLoading(false);
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    let columnToUpdate = {};
    
    // Mapping des champs vers la base de données
    if (activeModal === 'salary') columnToUpdate = { salary: inputValue };
    if (activeModal === 'classes') columnToUpdate = { assigned_classes: inputValue };
    if (activeModal === 'hours') columnToUpdate = { weekly_hours: parseInt(inputValue) || 0 };
    if (activeModal === 'availability') columnToUpdate = { availability: inputValue };

    const { error } = await supabase.from('teachers').update(columnToUpdate).eq('id', id);

    if (!error) {
      await fetchTeacher();
      setActiveModal(null);
      setInputValue('');
    }
    setIsUpdating(false);
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-green-600" size={40} /></div>;

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-10 px-4">
      
      {/* --- NAVIGATION --- */}
      <Link href="/teachers" className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors font-black text-[10px] uppercase tracking-widest italic">
        <ArrowLeft size={16} /> Retour au personnel
      </Link>

    {/* --- HEADER PREMIUM --- */}
    <div className="bg-slate-950 rounded-[3.5rem] p-6 md:p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-green-600/20 blur-[120px] rounded-full" />
        <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
            <div className="h-36 w-36 bg-gradient-to-br from-white/20 to-white/5 rounded-[3rem] border border-white/10 flex items-center justify-center text-6xl font-black italic shadow-2xl">
                {teacher.first_name[0]}{teacher.last_name[0]}
            </div>
            <div className="flex-1 text-center md:text-left space-y-4">
                <div className="space-y-2">
                    <span className="bg-green-600 px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest italic">{teacher.status}</span>
                    <h1 className="text-3xl sm:text-6xl font-black tracking-tighter italic uppercase leading-none">
                        {teacher.first_name} <span className="text-green-500">{teacher.last_name}</span>
                    </h1>
                </div>
                <div className="flex flex-wrap justify-center md:justify-start gap-8 text-slate-400 font-bold text-sm italic mt-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/5"><Briefcase size={16} className="text-green-400" /> {teacher.specialty}</div>
                    <div className="flex items-center gap-2"><Phone size={16} className="text-green-400" /> {teacher.phone || 'N/A'}</div>
                    <div className="flex items-center gap-2"><CalendarDays size={16} className="text-green-400" /> Arrivée: {new Date(teacher.created_at).toLocaleDateString()}</div>
                </div>
            </div>
        </div>
      </div>

      {/* --- GRILLE D'INFOS BENTO --- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* CARTE : SALAIRE */}
          <div onClick={() => { setActiveModal('salary'); setInputValue(teacher.salary || ''); }} className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
              <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Banknote size={24}/></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rémunération</p>
              <h4 className="text-2xl font-black text-slate-900">{teacher.salary ? `${teacher.salary} FCFA` : 'À définir'}</h4>
          </div>

          {/* CARTE : HEURES SEMAINE */}
          <div onClick={() => { setActiveModal('hours'); setInputValue(teacher.weekly_hours?.toString() || '0'); }} className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
              <div className="h-12 w-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Clock size={24}/></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Charge Horaire</p>
              <h4 className="text-2xl font-black text-slate-900">{teacher.weekly_hours || 0} H / Semaine</h4>
          </div>

          {/* CARTE : CLASSES */}
          <div onClick={() => { setActiveModal('classes'); setInputValue(teacher.assigned_classes || ''); }} className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
              <div className="h-12 w-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Layers size={24}/></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Groupes Assignés</p>
              <h4 className="text-2xl font-black text-slate-900 truncate">{teacher.assigned_classes || 'Aucun'}</h4>
          </div>

          {/* CARTE : DISPONIBILITÉ */}
          <div onClick={() => { setActiveModal('availability'); setInputValue(teacher.availability || ''); }} className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
              <div className="h-12 w-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Calendar size={24}/></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Disponibilité</p>
              <h4 className="text-xl font-black text-slate-900 truncate">{teacher.availability || 'À définir'}</h4>
          </div>
      </div>

      {/* --- SECTION INFOS SECONDAIRES --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-6 md:p-10 rounded-[3rem] border border-slate-100 min-h-[300px]">
              <div className="flex justify-between items-center mb-8 italic">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><FileBadge size={20} className="text-green-600"/> Dossier Professionnel</h3>
                  <button className="text-[10px] font-black uppercase text-green-600 px-4 py-2 bg-green-50 rounded-full">Ajouter un document</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 border-dashed flex items-center gap-4">
                      <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm"><FileBadge size={18} className="text-slate-300"/></div>
                      <p className="text-xs font-black text-slate-400 uppercase">CV & Diplômes</p>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 border-dashed flex items-center gap-4">
                      <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm"><FileBadge size={18} className="text-slate-300"/></div>
                      <p className="text-xs font-black text-slate-400 uppercase">Contrat Signé</p>
                  </div>
              </div>
          </div>

          <div className="bg-slate-900 p-6 md:p-10 rounded-[3rem] text-white space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 italic">Actions Système</h3>
              <div className="space-y-3">
                  <button className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-between transition-all group">
                      <span className="text-xs font-black uppercase italic">Générer Fiche de paie</span>
                      <ChevronRight size={16} className="text-slate-600 group-hover:text-white" />
                  </button>
                  <button className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-between transition-all group text-rose-400">
                      <span className="text-xs font-black uppercase italic">Suspendre le profil</span>
                      <Trash2 size={16} />
                  </button>
              </div>
          </div>
      </div>

      {/* --- MODAL DE MISE À JOUR --- */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-12 shadow-2xl relative animate-in fade-in zoom-in duration-300">
                <button onClick={() => setActiveModal(null)} className="absolute top-8 right-8 p-3 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"><Plus className="rotate-45" /></button>
                <h2 className="text-3xl font-black italic mb-2 capitalize">Mise à jour</h2>
                <p className="text-slate-400 font-medium mb-10 italic">Modification du champ : <span className="text-green-600 font-black uppercase">[{activeModal}]</span></p>
                
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-4 italic">Nouvelle valeur</label>
                        <input 
                          type="text" 
                          placeholder={activeModal === 'hours' ? 'Ex: 20' : 'Entrez les infos...'} 
                          className="w-full p-6 bg-slate-50 rounded-[2rem] border-none outline-none font-bold text-xl focus:ring-2 focus:ring-green-500 transition-all shadow-inner" 
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          autoFocus
                        />
                    </div>
                    <button 
                      onClick={handleUpdate}
                      disabled={isUpdating}
                      className="w-full bg-slate-950 text-white p-6 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-green-600 transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95"
                    >
                        {isUpdating ? <Loader2 className="animate-spin" /> : <><Check size={20}/> Confirmer la modification</>}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}