"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { useYear } from '@/context/YearContext';
import { Loader2, Users, Calendar, AlertCircle, CheckCircle2, Clock, UserX, Save } from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
  academic_year_id: number;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface AttendanceState {
  [studentId: string]: {
    status: 'present' | 'absence_non_justifiee' | 'retard';
    duration_hours: number;
    description: string;
    isAlreadySaved?: boolean;
  };
}

export default function AttendancePage() {
  const { selectedYearId } = useYear();
  
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceState>({});
  
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [incidentDate, setIncidentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const UUID_REGEX = useMemo(
    () => new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i'),
    []
  );

  const getCleanYearId = useCallback((): number | null => {
    if (selectedYearId === undefined || selectedYearId === null) return null;
    const parsed = parseInt(String(selectedYearId), 10);
    return isNaN(parsed) ? null : parsed;
  }, [selectedYearId]);

  const getErrorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

  // 1. Récupération des classes liées à l'année active
   
  useEffect(() => {
    const fetchClasses = async () => {
      const currentYearId = getCleanYearId();
      if (!currentYearId) {
        setClasses([]);
        setSelectedClass('');
        return;
      }

      setLoadingClasses(true);
      setError('');
      try {
        const { data, error: err } = await supabase
          .from('classes')
          .select('id, name, academic_year_id')
          .eq('academic_year_id', currentYearId)
          .order('name');

        if (err) throw err;
        setClasses(data || []);
      } catch (err: unknown) {
        console.error("Erreur classes:", err);
        setError(getErrorMessage(err) || "Impossible de charger les classes.");
      } finally {
        setLoadingClasses(false);
      }
    };

    fetchClasses();
  }, [selectedYearId, getCleanYearId]);

  // 2. Récupération des élèves ET de leur état actuel en BDD pour ce jour précis
   
  useEffect(() => {
    const fetchStudentsAndAttendance = async () => {
      if (!selectedClass || !UUID_REGEX.test(selectedClass)) {
        setStudents([]);
        setAttendance({});
        return;
      }
      
      setLoadingStudents(true);
      setError('');
      try {
        // Étape A : Récupérer tous les élèves de la classe
        const { data: studentsData, error: studentsErr } = await supabase
          .from('students')
          .select('id, first_name, last_name')
          .eq('class_id', selectedClass)
          .order('last_name', { ascending: true });

        if (studentsErr) throw studentsErr;
        const currentStudents = studentsData || [];
        setStudents(currentStudents);

        // Étape B : Récupérer les signalements existants pour cette classe à cette date exacte
        const { data: savedAttendance, error: attendanceErr } = await supabase
          .from('student_attendance')
          .select('student_id, attendance_status, duration_hours, description')
          .eq('class_id', selectedClass)
          .eq('date_checked', incidentDate);

        if (attendanceErr) throw attendanceErr;

        // Étape C : Fusionner les données (Tout le monde est 'present' sauf s'il y a un log en BDD)
        const initialAttendance: AttendanceState = {};
        
        currentStudents.forEach((student: { id: string | number; }) => {
          const existingRecord = savedAttendance?.find((record: { student_id: string | number; }) => record.student_id === student.id);
          
          if (existingRecord) {
            initialAttendance[student.id] = {
              status: existingRecord.attendance_status as 'absence_non_justifiee' | 'retard',
              duration_hours: existingRecord.duration_hours,
              description: existingRecord.description || '',
              isAlreadySaved: true
            };
          } else {
            initialAttendance[student.id] = {
              status: 'present',
              duration_hours: 1,
              description: '',
              isAlreadySaved: false
            };
          }
        });

        setAttendance(initialAttendance);

      } catch (err: unknown) {
        console.error("Erreur chargement élèves/états:", err);
        setError(getErrorMessage(err) || "Erreur lors de la synchronisation de la liste.");
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudentsAndAttendance();
  }, [selectedClass, incidentDate, UUID_REGEX]);

  const handleStatusChange = (studentId: string, status: 'present' | 'absence_non_justifiee' | 'retard') => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
        description: prev[studentId]?.description || (status === 'absence_non_justifiee' ? 'Absence constatée' : status === 'retard' ? 'En retard' : '')
      }
    }));
  };

  const handleDetailsChange = (studentId: string, field: 'duration_hours' | 'description', value: string | number) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: field === 'duration_hours' ? Number(value) : String(value)
      }
    }));
  };

  // 3. Enregistrement intelligent
  const saveAttendance = async () => {
    if (!selectedClass || !UUID_REGEX.test(selectedClass)) {
      setError("Sélectionnez une classe valide.");
      return;
    }
    
    const currentYearId = getCleanYearId();
    if (!currentYearId) {
        setError("L&apos;année scolaire courante est introuvable.");
      return;
    }
    
    const logsToSave = Object.entries(attendance)
      .filter(([, data]) => data.status !== 'present')
      .map(([studentId, data]) => ({
        student_id: studentId,
        class_id: selectedClass,
        academic_year_id: currentYearId,
        attendance_status: data.status,
        date_checked: incidentDate,
        duration_hours: data.duration_hours ? parseInt(String(data.duration_hours), 10) : 1,
        description: data.description.trim() || (data.status === 'absence_non_justifiee' ? 'Absence' : 'Retard')
      }));

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Correction ici : Utilisation de commentaires JS standards (//) au lieu des tirets SQL (--)
      await supabase
        .from('student_attendance')
        .delete()
        .eq('class_id', selectedClass)
        .eq('date_checked', incidentDate);

      if (logsToSave.length > 0) {
        const { error: insertError } = await supabase
          .from('student_attendance')
          .insert(logsToSave);

        if (insertError) throw insertError;
      }

      setSuccess(`Registre mis à jour avec succès pour le ${new Date(incidentDate).toLocaleDateString('fr-FR')} !`);
      
      setAttendance(prev => {
        const updated: AttendanceState = {};
        Object.keys(prev).forEach(id => {
          updated[id] = {
            ...prev[id],
            isAlreadySaved: prev[id].status !== 'present'
          };
        });
        return updated;
      });

      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      console.error("Échec persistance Supabase :", err);
      setError(getErrorMessage(err) || "Erreur de communication avec Supabase.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Suivi d&apos;Assiduité Continu</h1>
            <p className="text-xs font-bold text-slate-400 mt-0.5">
              Les anomalies restent affichées en temps réel sur la page
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-2xs">
            <Calendar size={14} className="text-slate-400" />
            <input 
              type="date" 
              value={incidentDate}
              onChange={(e) => setIncidentDate(e.target.value)}
              className="text-xs font-black text-slate-700 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
            />
          </div>
        </div>

        {/* Messages */}
        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
            <p className="text-emerald-800 text-xs font-black uppercase tracking-wider">{success}</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="text-rose-500 shrink-0" size={20} />
            <p className="text-rose-800 text-xs font-black uppercase tracking-wider">{error}</p>
          </div>
        )}

        {/* Filtre Classe */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="w-full sm:w-72">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1 block mb-1">Classe ciblée</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              disabled={loadingClasses}
              className="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs text-slate-800 border-none focus:ring-2 focus:ring-[#1763FF]/10 transition cursor-pointer"
            >
              <option value="">{loadingClasses ? "Chargement..." : "-- Choisir la classe --"}</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Workspace */}
        {!selectedClass ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
            <Users className="mx-auto text-slate-300 mb-3" size={36} />
            <p className="text-xs font-black text-slate-400 uppercase tracking-wide">Sélectionnez une classe pour voir l&apos;état du jour</p>
          </div>
        ) : loadingStudents ? (
          <div className="flex justify-center items-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Loader2 className="animate-spin text-[#1763FF]" size={32} />
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wide">Aucun élève trouvé.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {students.map((student) => {
                  const currentInfo = attendance[student.id] || { status: 'present', duration_hours: 1, description: '' };
                  const currentStatus = currentInfo.status;
                  
                  return (
                    <div key={student.id} className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${currentInfo.isAlreadySaved ? 'bg-slate-50/70' : 'hover:bg-slate-50/50'}`}>
                      
                      <div className="min-w-[200px]">
                        <p className="text-xs font-black text-slate-800 uppercase tracking-wide">
                          {student.last_name} {student.first_name}
                        </p>
                        {currentInfo.isAlreadySaved && (
                          <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest bg-emerald-50 px-1.5 py-0.5 rounded-sm">Sauvegardé en BDD</span>
                        )}
                      </div>

                      {/* Sélecteurs de présence */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.id, 'present')}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${
                            currentStatus === 'present'
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          Présent
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.id, 'absence_non_justifiee')}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1.5 ${
                            currentStatus === 'absence_non_justifiee'
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <UserX size={12} /> Absent
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.id, 'retard')}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1.5 ${
                            currentStatus === 'retard'
                              ? 'bg-amber-500 text-white shadow-2xs'
                              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <Clock size={12} /> Retard
                        </button>
                      </div>

                      {/* Inputs pour absence ou retard */}
                      {currentStatus !== 'present' && (
                        <div className="flex flex-1 items-center gap-2 md:max-w-md w-full animate-fade-in">
                          <input 
                            type="number" 
                            placeholder="Durée"
                            value={currentInfo.duration_hours || ''}
                            onChange={(e) => handleDetailsChange(student.id, 'duration_hours', e.target.value)}
                            className="w-24 p-2 bg-slate-50 border-none rounded-lg text-xs font-mono font-black text-center text-slate-800"
                          />
                          <input 
                            type="text" 
                            placeholder="Motif ou remarque..."
                            value={currentInfo.description || ''}
                            onChange={(e) => handleDetailsChange(student.id, 'description', e.target.value)}
                            className="flex-1 p-2 bg-slate-50 border-none rounded-lg text-xs font-bold text-slate-800 placeholder:text-slate-300"
                          />
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={saveAttendance}
                disabled={saving}
                className="px-6 py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition shadow-md disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                Mettre à jour le registre Supabase
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}