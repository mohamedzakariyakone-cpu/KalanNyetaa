'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  ShieldAlert, User, Calendar, AlertTriangle, 
  PlusCircle, Search, Loader2, History 
} from 'lucide-react';

export default function DisciplinePage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulaire
  const [studentId, setStudentId] = useState('');
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState('Bas');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // On récupère les incidents avec le nom de l'élève
    const { data: incData } = await supabase
      .from('discipline')
      .select('*, students(first_name, last_name, classes(name))')
      .order('incident_date', { ascending: false });
    
    // On récupère les élèves pour le menu déroulant
    const { data: stData } = await supabase.from('students').select('id, first_name, last_name');

    setIncidents(incData || []);
    setStudents(stData || []);
    setLoading(false);
  };

  const addIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const { error } = await supabase.from('discipline').insert([{
      student_id: studentId,
      reason: reason,
      severity: severity
    }]);

    if (!error) {
      setReason(''); setStudentId('');
      fetchData();
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-10">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ShieldAlert size={36} className="text-orange-500" /> Gestion de la Conduite
          </h1>
          <p className="text-slate-500 font-medium mt-2">Suivi disciplinaire et rapports d'incidents en temps réel.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        
        {/* FORMULAIRE (Surveillant) */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm h-fit xl:sticky top-10">
          <h2 className="text-xl font-bold mb-6 text-slate-900 flex items-center gap-2">
            <PlusCircle size={20} className="text-green-600" /> Signaler un incident
          </h2>
          <form onSubmit={addIncident} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Élève concerné</label>
              <select 
                className="w-full p-3.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-medium"
                value={studentId} onChange={(e) => setStudentId(e.target.value)} required
              >
                <option value="">Sélectionner l'élève...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Motif de l'incident</label>
              <textarea 
                placeholder="Ex: Retard répété, Absence injustifiée..."
                className="w-full p-3.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-medium h-32 resize-none"
                value={reason} onChange={(e) => setReason(e.target.value)} required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Gravité</label>
              <div className="flex gap-2">
                {['Bas', 'Moyen', 'Grave'].map((lvl) => (
                  <button
                    key={lvl} type="button"
                    onClick={() => setSeverity(lvl)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      severity === lvl 
                      ? (lvl === 'Grave' ? 'bg-red-600 text-white' : lvl === 'Moyen' ? 'bg-orange-500 text-white' : 'bg-green-600 text-white')
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <button 
              type="submit" disabled={isSubmitting}
              className="w-full bg-slate-950 text-white p-4 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-slate-200"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : 'Enregistrer le rapport'}
            </button>
          </form>
        </div>

        {/* HISTORIQUE DES INCIDENTS (Flux) */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center gap-2 font-bold text-slate-900 mb-2">
            <History size={20} /> Derniers signalements
          </div>
          
          {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="animate-spin text-green-600" /></div>
          ) : incidents.length === 0 ? (
            <div className="bg-white p-20 text-center rounded-[2rem] border border-dashed text-slate-400 font-medium">
                Aucun incident signalé récemment.
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map((inc) => (
                <div key={inc.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4 group hover:border-green-100 transition-all">
                  <div className={`p-3 rounded-xl flex-shrink-0 ${
                    inc.severity === 'Grave' ? 'bg-red-50 text-red-600' : inc.severity === 'Moyen' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
                  }`}>
                    <AlertTriangle size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-slate-900">{inc.students.first_name} {inc.students.last_name}</h4>
                        <p className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full inline-block mb-2">
                          {inc.students.classes.name}
                        </p>
                      </div>
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">
                        {new Date(inc.incident_date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-slate-600 text-sm font-medium leading-relaxed">{inc.reason}</p>
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