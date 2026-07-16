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

  // --- RÉCUPÉRATION DIRECTE SUPABASE (SANS CACHE / OFFLINE) ---
  const fetchTeacherData = async () => {
    setLoading(true);
    try {
      // 1. Récupérer le profil du professeur
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

      // 2. Récupérer l'historique des logs
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

  // --- STATISTIQUES EN TEMPS RÉEL SUR L'ÉTAT LOCAL ---
  const totalAbsences = logs ? logs.filter(l => l.log_type === 'absence').length : 0;
  const totalRetards = logs ? logs.filter(l => l.log_type === 'retard').length : 0;

  let performanceBadge = { text: "Profil Stable", color: "bg-slate-800 text-slate-300 border-slate-700" };
  if (totalAbsences >= 5) {
    performanceBadge = { text: "⚠️ Souvent Absent", color: "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse" };
  } else if (totalRetards >= 5) {
    performanceBadge = { text: "⏳ Souvent en Retard", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
  } else if (logs && logs.filter(l => l.log_type === 'presence').length > 10 && totalAbsences === 0) {
    performanceBadge = { text: "🛡️ Très Exemplaire", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
  }

  // --- FORMATAGE ---
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

  // Utilitaire réutilisable pour mettre à jour le profil professeur
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

  // --- POINTAGES ET ACTIONS RAPIDES (DIRECTE SUPABASE SÉCURISÉE) ---
  const handleDeclareEvent = async (type: 'presence' | 'absence' | 'retard' | 'remarque', desc?: string) => {
    setIsUpdating(true);
    const defaultDesc = {
      presence: 'Présence validée en classe.',
      retard: 'Retard signalé par la direction.',
      absence: 'Absence constatée.',
      remarque: desc || 'Nouvelle remarque enregistrée.'
    };

    try {
      // Construction dynamique du payload pour éviter de forcer à null des clés étrangères strictes
      const logPayload: any = {
        teacher_id: teacherId,
        log_type: type,
        description: desc || defaultDesc[type],
      };

      if (teacher?.school_id) logPayload.school_id = teacher.school_id;
      if (teacher?.academic_year_id) logPayload.academic_year_id = teacher.academic_year_id;

      // 1. Insertion directe du Log dans Supabase
      const { error: logError } = await supabase
        .from('teacher_logs')
        .insert([logPayload]);

      if (logError) {
        console.error("Détails d'insertion Log:", logError.message, logError.details);
        throw logError;
      }

      // 2. Préparation et mise à jour directe du statut du prof
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

      // Utilise la fonction utilitaire `executeUpdate` pour profiter
      // de l'optimistic update et du mécanisme offline/queue.
      const { error: updateError } = await executeUpdate(updates);

      if (updateError) {
        console.error("Détails mise à jour profil:", updateError);
        throw updateError;
      }

      // 3. Rechargement propre et direct des états
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

  // --- MISE À JOUR DIRECTE DES CARTES BENTO ---
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
      console.error("Erreur de mise à jour Bento:", err);
      alert(`Erreur : ${err?.message || "Impossible de mettre à jour cette information."}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // --- TÉLÉVERSEMENT PHOTO DIRECT ---
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
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">
          Chargement du profil...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-24 px-4 sm:px-6 space-y-6 pt-4 font-sans">
      
      {/* RETOUR */}
      <Link href="/teachers" className="flex items-center gap-2 text-slate-400 hover:text-slate-900 text-[10px] font-black uppercase tracking-widest italic">
        <ArrowLeft size={14} /> Retour au personnel
      </Link>

      {/* --- DESIGN PREMIUM HEADER BLOC NOIR INTENSE --- */}
      <div className="bg-slate-950 rounded-[2.5rem] p-6 md:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
          
          {/* Avatar avec déclencheur de téléversement photo */}
          <div className="relative shrink-0 group">
            <div className="h-24 w-24 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-3xl flex items-center justify-center text-3xl font-black italic shadow-lg overflow-hidden relative">
              {teacher.avatar_url ? (
                <img src={teacher.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                `${teacher.first_name[0]}${teacher.last_name[0]}`
              )}
              {uploadingPhoto && <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={18} /></div>}
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 p-2 bg-indigo-600 hover:bg-indigo-500 border-4 border-slate-950 text-white rounded-xl transition-all shadow-md"
            >
              <Camera size={12} />
            </button>
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
          </div>

          <div className="text-center sm:text-left space-y-2 flex-1 w-full">
            <div className="flex flex-wrap justify-center sm:justify-start gap-2">
              <span className="bg-indigo-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest italic">{teacher.status || 'Actif'}</span>
              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${performanceBadge.color}`}>
                {performanceBadge.text}
              </span>
              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest italic border ${
                teacher.attendance_status === 'presence' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                teacher.attendance_status === 'absence' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                ● {teacher.attendance_status || 'Non pointé'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight italic">
              {teacher.first_name} <span className="text-indigo-400">{teacher.last_name}</span>
            </h1>
            
            <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-[11px] text-slate-400 font-bold italic pt-1">
              <span className="flex items-center gap-1.5"><Briefcase size={13} className="text-indigo-400"/> {teacher.specialty || 'Généraliste'}</span>
              {teacher.phone && <span className="flex items-center gap-1.5"><Phone size={13} className="text-indigo-400"/> {teacher.phone}</span>}
              {teacher.email && <span className="flex items-center gap-1.5"><Mail size={13} className="text-indigo-400"/> {teacher.email}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* --- SECTION POINTAGE RAPIDE PREMIUM --- */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <ShieldCheck size={16} className="text-indigo-600" /> Validation & Pointage Quotidien
          </h3>
          <p className="text-xs text-slate-400 font-medium">Chaque clic valide et inscrit définitivement une ligne datée dans l'historique du professeur.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <button 
            onClick={() => handleDeclareEvent('presence')}
            disabled={isUpdating}
            className={`p-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95 ${
              teacher.attendance_status === 'presence' ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            {isUpdating ? <Loader2 className="animate-spin" size={16} /> : <><Check size={16} /> Valider Présence</>}
          </button>

          <button 
            onClick={() => handleDeclareEvent('retard')}
            disabled={isUpdating}
            className={`p-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95 ${
              teacher.attendance_status === 'retard' ? 'bg-amber-600 text-white shadow-amber-200' : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
          >
            {isUpdating ? <Loader2 className="animate-spin" size={16} /> : <><Clock size={16} /> Signaler Retard</>}
          </button>

          <button 
            onClick={() => handleDeclareEvent('absence')}
            disabled={isUpdating}
            className={`p-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95 ${
              teacher.attendance_status === 'absence' ? 'bg-rose-600 text-white shadow-rose-200' : 'bg-rose-500 hover:bg-rose-600 text-white'
            }`}
          >
            {isUpdating ? <Loader2 className="animate-spin" size={16} /> : <><X size={16} /> Signaler Absence</>}
          </button>

          <button 
            onClick={() => { setActiveModal('remarque'); setInputValue(''); }}
            className="p-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95"
          >
            <MessageSquare size={16} /> Rédiger Remarque
          </button>
        </div>
      </div>

      {/* --- BLOC CARTES BENTO REPOSITIONNÉES ET CLIQUABLES --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div onClick={() => { setActiveModal('salary'); setInputValue(formatMoney(teacher.salary || '')); }} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between">
              <div className="h-9 w-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4"><Banknote size={18}/></div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Rémunération</p>
                <h4 className="text-sm sm:text-base font-black text-slate-900 truncate">{teacher.salary ? `${formatMoney(teacher.salary)} FCFA` : 'À définir'}</h4>
              </div>
          </div>

          <div onClick={() => { setActiveModal('hours'); setInputValue(teacher.weekly_hours?.toString() || '0'); }} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between">
              <div className="h-9 w-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4"><Clock size={18}/></div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Charge Horaire</p>
                <h4 className="text-sm sm:text-base font-black text-slate-900 truncate">{teacher.weekly_hours || 0} H / Semaine</h4>
              </div>
          </div>

          <div onClick={() => { setActiveModal('classes'); setInputValue(teacher.assigned_classes || ''); }} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between">
              <div className="h-9 w-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4"><Layers size={18}/></div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Groupes Assignés</p>
                <h4 className="text-sm sm:text-base font-black text-slate-900 truncate">{teacher.assigned_classes || 'Aucun'}</h4>
              </div>
          </div>

          <div onClick={() => { setActiveModal('availability'); setInputValue(teacher.availability || ''); }} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between">
              <div className="h-9 w-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4"><Calendar size={18}/></div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Disponibilité</p>
                <h4 className="text-sm sm:text-base font-black text-slate-900 truncate">{teacher.availability || 'À définir'}</h4>
              </div>
          </div>
      </div>

      {/* --- GRILLE : COMPTEURS RAPIDES & TIMELINE HISTORIQUE --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-xs">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Retards Logs</p>
            <h3 className={`text-3xl font-black mt-1 ${totalRetards > 3 ? 'text-amber-500' : 'text-slate-900'}`}>{totalRetards}</h3>
          </div>
          <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-xs">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Absences Logs</p>
            <h3 className={`text-3xl font-black mt-1 ${totalAbsences > 2 ? 'text-rose-500' : 'text-slate-900'}`}>{totalAbsences}</h3>
          </div>
        </div>

        {/* Historique Linéaire */}
        <div className="md:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <History size={16} className="text-indigo-600" /> Historique Linéaire Temporel (Logs)
          </h3>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">Aucun événement validé dans l'historique pour le moment.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                        log.log_type === 'presence' ? 'bg-emerald-100 text-emerald-700' :
                        log.log_type === 'absence' ? 'bg-rose-100 text-rose-700' :
                        log.log_type === 'retard' ? 'bg-amber-100 text-amber-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {log.log_type}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {new Date(log.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-700 leading-relaxed">{log.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* --- SECTION HISTORIQUE COMPORTEMENT DIRECTEUR --- */}
      <div 
        onClick={() => { setActiveModal('behavior_remarque'); setInputValue(teacher.behavior_remarque || ''); }} 
        className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs cursor-pointer hover:border-indigo-300 transition-all group"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center"><MessageSquare size={18} /></div>
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Observations & Comportement</h3>
              <p className="text-[11px] text-slate-400 font-medium">Notes exclusives de la direction sur l'attitude du prof.</p>
            </div>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:text-indigo-600 transition-colors"><Edit3 size={14} /></div>
        </div>

        <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 relative min-h-[4.5rem] flex items-center">
          {teacher.behavior_remarque ? (
            <p className="text-xs font-semibold text-slate-700 italic leading-relaxed">"{teacher.behavior_remarque}"</p>
          ) : (
            <p className="text-xs font-semibold text-slate-400 italic">Aucune remarque enregistrée. Cliquez pour ajouter un commentaire.</p>
          )}
        </div>
        {teacher.behavior_updated_at && (
          <p className="text-[10px] font-bold text-slate-400 mt-2 text-right italic">
            Dernière mise à jour : {new Date(teacher.behavior_updated_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* --- DOSSIER ET ACTIONS SYSTEME --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 min-h-[200px] flex flex-col justify-between">
              <div className="flex justify-between items-center mb-4 italic">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2"><FileBadge size={18} className="text-indigo-600"/> Dossier Professionnel</h3>
                  <button className="text-[9px] font-black uppercase text-indigo-600 px-3.5 py-1.5 bg-indigo-50 rounded-full">Ajouter</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 border-dashed flex items-center gap-3">
                      <div className="h-9 w-9 bg-white rounded-xl flex items-center justify-center"><FileBadge size={16} className="text-slate-300"/></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">CV & Diplômes</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 border-dashed flex items-center gap-3">
                      <div className="h-9 w-9 bg-white rounded-xl flex items-center justify-center"><FileBadge size={16} className="text-slate-300"/></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Contrat Signé</p>
                  </div>
              </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl text-white space-y-4 flex flex-col justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 italic">Actions Système</h3>
              <div className="space-y-2 w-full">
                  <button className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-between transition-all group">
                      <span className="text-xs font-black uppercase italic">Générer Fiche de paie</span>
                      <ChevronRight size={16} className="text-slate-600 group-hover:text-white" />
                  </button>
                  <button className="w-full p-4 bg-white/5 hover:bg-rose-950/20 rounded-2xl flex items-center justify-between transition-all text-rose-400">
                      <span className="text-xs font-black uppercase italic">Suspendre le profil</span>
                      <Trash2 size={16} />
                  </button>
              </div>
          </div>
      </div>

      {/* --- MODAL DE MISE À JOUR ADAPTÉ --- */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 p-2 bg-slate-50 rounded-full"><X size={16} /></button>
            <h3 className="text-base font-black italic mb-1 capitalize">Mise à jour</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-4">Champ : {activeModal}</p>
            
            <div className="space-y-4">
              {activeModal === 'behavior_remarque' || activeModal === 'remarque' ? (
                <textarea 
                  rows={4}
                  placeholder="Saisissez la remarque ou l'observation..."
                  className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-medium text-xs focus:ring-2 focus:ring-indigo-500 transition-all resize-none shadow-inner"
                  value={inputValue}
                  onChange={handleInputChange}
                  autoFocus
                />
              ) : (
                <input 
                  type="text" 
                  placeholder="Saisissez la nouvelle valeur..."
                  className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                  value={inputValue}
                  onChange={handleInputChange}
                  autoFocus
                />
              )}

              <button 
                onClick={activeModal === 'remarque' || activeModal === 'behavior_remarque' ? () => handleDeclareEvent('remarque', inputValue) : handleGenericModalSave}
                disabled={isUpdating || ((activeModal === 'behavior_remarque' || activeModal === 'remarque') && !inputValue.trim())}
                className="w-full bg-slate-950 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isUpdating ? <Loader2 className="animate-spin" size={16} /> : <><Check size={14}/> Enregistrer la modification</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}