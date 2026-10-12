'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { offlineWrite } from '@/utils/offlineApi';
import { 
  ArrowLeft, Phone, Mail, Briefcase, Loader2, Trash2, 
  Banknote, Layers, Calendar, ChevronRight, Check, 
  Clock, X, MessageSquare, ShieldCheck, History, Camera, FileBadge, Edit3
} from 'lucide-react';
import Link from 'next/link';

export default function TeacherProfilePage() {
  const { id } = useParams();
  const teacherId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [teacher, setTeacher] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (teacherId) {
      fetchTeacherData();
    }
  }, [teacherId]);

  const fetchTeacherData = async () => {
    setLoading(true);
    try {
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', teacherId)
        .single();

      if (teacherError || !teacherData) {
        console.error("Erreur profil:", teacherError);
        router.push('/teachers');
        return;
      }

      const { data: logsData, error: logsError } = await supabase
        .from('teacher_logs')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false });

      if (logsError) {
        console.error("Erreur logs:", logsError);
      }

      setTeacher(teacherData);
      setLogs(logsData || []);
    } catch (err) {
      console.error("Erreur globale de chargement:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalAbsences = logs ? logs.filter(l => l.log_type === 'absence').length : 0;
  const totalRetards = logs ? logs.filter(l => l.log_type === 'retard').length : 0;

  const formatMoney = (value: any) => {
    if (!value) return '';
    const num = parseInt(value.toString().replace(/\s/g, ''), 10);
    if (isNaN(num)) return value;
    return new Intl.NumberFormat('fr-FR').format(num).replace(/,/g, ' ');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (activeModal === 'salary') {
      const cleanValue = val.replace(/\D/g, '');
      if (cleanValue === '') {
        setInputValue('');
        return;
      }
      setInputValue(new Intl.NumberFormat('fr-FR').format(parseInt(cleanValue, 10)).replace(/,/g, ' '));
    } else {
      setInputValue(val);
    }
  };

  const executeUpdate = async (fields: Record<string, any>) => {
    return await offlineWrite({
      table: 'teachers',
      action: 'UPDATE',
      payload: fields,
      options: { keyColumn: 'id', keyValue: teacherId },
      cacheKey: `teacher:${teacherId}`,
      optimisticUpdate: () => {
        setTeacher((prev: any) => ({ ...prev, ...fields }));
      },
    });
  };

  const handleDeclareEvent = async (type: 'presence' | 'absence' | 'retard' | 'remarque', desc?: string) => {
    setIsUpdating(true);
    const defaultDesc = {
      presence: 'Présence validée en classe.',
      retard: 'Retard signalé par la direction.',
      absence: 'Absence constatée.',
      remarque: desc || 'Nouvelle remarque enregistrée.'
    };

    try {
      const logPayload: any = {
        teacher_id: teacherId,
        log_type: type,
        description: desc || defaultDesc[type],
      };

      if (teacher?.school_id) logPayload.school_id = teacher.school_id;
      if (teacher?.academic_year_id) logPayload.academic_year_id = teacher.academic_year_id;

      const { error: logError } = await supabase
        .from('teacher_logs')
        .insert([logPayload]);

      if (logError) throw logError;

      const updates: any = {};
      if (type !== 'remarque') {
        updates.attendance_status = type;
        updates.last_attendance_update = new Date().toISOString().split('T')[0];
      } else {
        const { data: userData } = await supabase.auth.getUser();
        updates.behavior_remarque = desc;
        updates.behavior_updated_at = new Date().toISOString();
        if (userData?.user?.id) {
          updates.behavior_updated_by = userData.user.id;
        }
      }

      const { error: updateError } = await executeUpdate(updates);
      if (updateError) throw updateError;

      await fetchTeacherData();
      setInputValue('');
      setActiveModal(null);
    } catch (err: any) {
      console.error("Échec du pointage:", err);
      alert(`Erreur : ${err?.message || "Impossible d'enregistrer l'action."}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGenericModalSave = async () => {
    setIsUpdating(true);
    let fields: Record<string, any> = {};

    if (activeModal === 'salary') fields = { salary: inputValue.replace(/\s/g, '') };
    else if (activeModal === 'classes') fields = { assigned_classes: inputValue };
    else if (activeModal === 'hours') fields = { weekly_hours: parseInt(inputValue) || 0 };
    else if (activeModal === 'availability') fields = { availability: inputValue };

    try {
      const { error } = await supabase
        .from('teachers')
        .update(fields)
        .eq('id', teacherId);

      if (error) throw error;

      await fetchTeacherData();
      setActiveModal(null);
      setInputValue('');
    } catch (err: any) {
      console.error("Erreur de mise à jour:", err);
      alert(`Erreur : ${err?.message || "Impossible de mettre à jour cette information."}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `teacher-${teacherId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('teacher-avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('teacher-avatars').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('teachers')
        .update({ avatar_url: publicUrl })
        .eq('id', teacherId);

      if (updateError) throw updateError;

      await fetchTeacherData();
    } catch (err: any) {
      console.error(err);
      alert(`Erreur photo : ${err?.message || "Impossible de téléverser la photo."}`);
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading || !teacher) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-blue-600" size={28} />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Chargement du dossier enseignant...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-20 px-4 sm:px-6 space-y-6 pt-2 font-sans text-slate-900 antialiased">
      
      {/* 1. LIEN DE RETOUR */}
      <Link 
        href="/teachers" 
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600 transition"
      >
        <ArrowLeft size={14} />
        <span>Retour au corps enseignant</span>
      </Link>

      {/* 2. EN-TÊTE DU PROFIL : PLAT, GRANDES POLICES & SANS BADGES SUPERFLUS */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          
          {/* Avatar avec déclencheur photo */}
          <div className="relative shrink-0">
            <div className="h-20 w-20 sm:h-24 sm:w-24 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl sm:text-3xl uppercase overflow-hidden">
              {teacher.avatar_url ? (
                <img src={teacher.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                `${teacher.first_name?.[0] || ''}${teacher.last_name?.[0] || ''}`
              )}
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                  <Loader2 className="animate-spin text-white" size={20} />
                </div>
              )}
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 p-2 bg-slate-900 hover:bg-blue-600 text-white rounded-xl transition shadow-xs border-2 border-white"
              title="Changer la photo"
            >
              <Camera size={13} />
            </button>
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
          </div>

          {/* Informations principales de l'enseignant */}
          <div className="text-center sm:text-left space-y-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950 capitalize">
                {teacher.first_name} {teacher.last_name}
              </h1>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                teacher.attendance_status === 'presence' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                teacher.attendance_status === 'absence' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                ● {teacher.attendance_status === 'presence' ? 'Présent' : teacher.attendance_status === 'absence' ? 'Absent' : teacher.attendance_status === 'retard' ? 'En retard' : 'Non pointé'}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-6 gap-y-1.5 text-sm sm:text-base font-bold text-slate-600 pt-1">
              <span className="inline-flex items-center gap-2 text-blue-600">
                <Briefcase size={15} className="shrink-0" />
                <span>{teacher.specialty || 'Généraliste'}</span>
              </span>
              {teacher.phone && (
                <span className="inline-flex items-center gap-2">
                  <Phone size={15} className="text-slate-400 shrink-0" />
                  <span className="text-slate-800">{teacher.phone}</span>
                </span>
              )}
              {teacher.email && (
                <span className="inline-flex items-center gap-2">
                  <Mail size={15} className="text-slate-400 shrink-0" />
                  <span className="text-slate-800">{teacher.email}</span>
                </span>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* 3. BARRE DE POINTAGE RAPIDE (ACTIONS PLATES) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3.5">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <ShieldCheck size={16} className="text-blue-600" /> Validation & Pointage Quotidien
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Chaque action met à jour le statut et consigne une ligne dans l'historique officiel.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <button 
            onClick={() => handleDeclareEvent('presence')}
            disabled={isUpdating}
            className={`py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 disabled:opacity-40 ${
              teacher.attendance_status === 'presence' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            {isUpdating ? <Loader2 className="animate-spin" size={15} /> : <><Check size={15} /> Valider Présence</>}
          </button>

          <button 
            onClick={() => handleDeclareEvent('retard')}
            disabled={isUpdating}
            className={`py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 disabled:opacity-40 ${
              teacher.attendance_status === 'retard' 
                ? 'bg-amber-600 text-white' 
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            {isUpdating ? <Loader2 className="animate-spin" size={15} /> : <><Clock size={15} /> Signaler Retard</>}
          </button>

          <button 
            onClick={() => handleDeclareEvent('absence')}
            disabled={isUpdating}
            className={`py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 disabled:opacity-40 ${
              teacher.attendance_status === 'absence' 
                ? 'bg-rose-600 text-white' 
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
            }`}
          >
            {isUpdating ? <Loader2 className="animate-spin" size={15} /> : <><X size={15} /> Signaler Absence</>}
          </button>

          <button 
            onClick={() => { setActiveModal('remarque'); setInputValue(''); }}
            className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
          >
            <MessageSquare size={15} /> Remarque
          </button>
        </div>
      </div>

      {/* 4. BLOC CARTES BENTO PLATES (CLIQUABLES POUR MODIFICATION) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div 
          onClick={() => { setActiveModal('salary'); setInputValue(formatMoney(teacher.salary || '')); }} 
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-300 transition cursor-pointer flex flex-col justify-between space-y-3"
        >
          <div className="h-9 w-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Banknote size={17} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Rémunération</span>
            <p className="text-base sm:text-lg font-black text-slate-900 truncate mt-0.5">
              {teacher.salary ? `${formatMoney(teacher.salary)} F` : 'Non définie'}
            </p>
          </div>
        </div>

        <div 
          onClick={() => { setActiveModal('hours'); setInputValue(teacher.weekly_hours?.toString() || '0'); }} 
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-300 transition cursor-pointer flex flex-col justify-between space-y-3"
        >
          <div className="h-9 w-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Clock size={17} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Charge Horaire</span>
            <p className="text-base sm:text-lg font-black text-slate-900 truncate mt-0.5">
              {teacher.weekly_hours || 0} H / Semaine
            </p>
          </div>
        </div>

        <div 
          onClick={() => { setActiveModal('classes'); setInputValue(teacher.assigned_classes || ''); }} 
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-300 transition cursor-pointer flex flex-col justify-between space-y-3"
        >
          <div className="h-9 w-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Layers size={17} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Groupes Assignés</span>
            <p className="text-base sm:text-lg font-black text-slate-900 truncate mt-0.5">
              {teacher.assigned_classes || 'Aucun'}
            </p>
          </div>
        </div>

        <div 
          onClick={() => { setActiveModal('availability'); setInputValue(teacher.availability || ''); }} 
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-300 transition cursor-pointer flex flex-col justify-between space-y-3"
        >
          <div className="h-9 w-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Calendar size={17} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Disponibilité</span>
            <p className="text-base sm:text-lg font-black text-slate-900 truncate mt-0.5">
              {teacher.availability || 'Complète'}
            </p>
          </div>
        </div>
      </div>

      {/* 5. HISTORIQUE LINÉAIRE ET OBSERVATIONS */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Colonne gauche : Synthèses de pointages (4 cols) */}
        <div className="md:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total des retards</span>
            <p className={`text-2xl sm:text-3xl font-black ${totalRetards > 3 ? 'text-amber-600' : 'text-slate-950'}`}>
              {totalRetards}
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total des absences</span>
            <p className={`text-2xl sm:text-3xl font-black ${totalAbsences > 2 ? 'text-rose-600' : 'text-slate-950'}`}>
              {totalAbsences}
            </p>
          </div>

          {/* Observations de la direction */}
          <div 
            onClick={() => { setActiveModal('behavior_remarque'); setInputValue(teacher.behavior_remarque || ''); }} 
            className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:border-blue-300 transition cursor-pointer space-y-2.5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase text-slate-800">Observations Direction</span>
              <Edit3 size={13} className="text-blue-600" />
            </div>
            {teacher.behavior_remarque ? (
              <p className="text-xs font-semibold text-slate-700 leading-relaxed italic">
                "{teacher.behavior_remarque}"
              </p>
            ) : (
              <p className="text-xs font-medium text-slate-400 italic">
                Aucune note enregistrée. Cliquez pour ajouter un commentaire.
              </p>
            )}
            {teacher.behavior_updated_at && (
              <span className="text-[10px] font-medium text-slate-400 block pt-1">
                Mis à jour le {new Date(teacher.behavior_updated_at).toLocaleDateString('fr-FR')}
              </span>
            )}
          </div>
        </div>

        {/* Colonne droite : Journal des logs linéaires (8 cols) */}
        <div className="md:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <History size={16} className="text-blue-600" /> Historique d'assiduité & événements
            </h3>
            <span className="text-xs font-bold text-slate-400">{logs.length} ligne(s)</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium py-10 text-center">
                Aucun événement consigné pour le moment.
              </p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        log.log_type === 'presence' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        log.log_type === 'absence' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        log.log_type === 'retard' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {log.log_type}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {new Date(log.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-800 leading-snug">{log.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* 6. MODAL DE MISE À JOUR PLAT */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase">Mise à jour</h3>
                <p className="text-xs text-slate-500 font-medium">Modification du champ : {activeModal}</p>
              </div>
              <button 
                onClick={() => setActiveModal(null)} 
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {activeModal === 'behavior_remarque' || activeModal === 'remarque' ? (
                <textarea 
                  rows={4}
                  placeholder="Saisissez la remarque..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-blue-600 transition resize-none"
                  value={inputValue}
                  onChange={handleInputChange}
                  autoFocus
                />
              ) : (
                <input 
                  type="text" 
                  placeholder="Saisissez la nouvelle valeur..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-600 transition"
                  value={inputValue}
                  onChange={handleInputChange}
                  autoFocus
                />
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button 
                  onClick={activeModal === 'remarque' || activeModal === 'behavior_remarque' ? () => handleDeclareEvent('remarque', inputValue) : handleGenericModalSave}
                  disabled={isUpdating || ((activeModal === 'behavior_remarque' || activeModal === 'remarque') && !inputValue.trim())}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40"
                >
                  {isUpdating ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                  <span>Enregistrer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}