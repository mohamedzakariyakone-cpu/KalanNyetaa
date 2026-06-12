'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, type ChangeEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { useYear } from '@/context/YearContext';
import {
  Search, ArrowUpRight, Loader2, Phone, X, Trash2, Plus, Lock, 
  AlertCircle, FileText, DollarSign, Award, GraduationCap, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import NumericInput from '@/components/NumericInput';

export default function StudentsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-4">
        <Loader2 className="animate-spin text-slate-900" size={32} />
        <p className="font-bold animate-pulse text-xs uppercase tracking-widest">Chargement du module élèves...</p>
      </div>
    }>
      <StudentsPageContent />
    </Suspense>
  );
}

type StudentRecord = {
  id: string | number;
  first_name?: string | null;
  last_name?: string | null;
  class_id?: string | number | null;
  annual_fee?: number | string | null;
  scolarite_totale?: number | string | null;
  scolarite_payee?: number | string | null;
  parent_phone?: string | null;
  address?: string | null;
  birth_date?: string | null;
  last_exam_avg?: number | string | null;
  classes?: { name?: string | null };
};

type ClassRecord = {
  id: string | number;
  name?: string | null;
  level?: string | null;
  academic_year_id?: string | number | null;
};

function StudentsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classFilter = searchParams.get('class');

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [currentClassInfo, setCurrentClassInfo] = useState<ClassRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [financialFilter, setFinancialFilter] = useState<'all' | 'paid' | 'debtor'>('all');
  const [academicFilter, setAcademicFilter] = useState<'all' | 'passed' | 'failed'>('all');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReenrolling, setIsReenrolling] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showMobileForm, setShowMobileForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [targetNextClassId, setTargetNextClassId] = useState('');
  const [nextYearClasses, setNextYearClasses] = useState<ClassRecord[]>([]);
  const [showReenrollmentSection, setShowReenrollmentSection] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', classId: classFilter || '', annualFee: '',
    parentPhone: '', address: '', birthDate: '', lastExamAvg: '0'
  });

  const { selectedYearId, selectedYear, years, isReadOnly, isLoading: yearLoading } = useYear();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const match = document.cookie.match(new RegExp('(^| )userRole=([^;]+)'));
      const role = match ? match[2] : localStorage.getItem('userRole');
      setUserRole(role);
    }
  }, []);

  const shouldHideFinancials = userRole === 'directeur' || userRole === 'caissier';

  useEffect(() => {
    if (classFilter) {
      setFormData(prev => ({ ...prev, classId: classFilter }));
    }
  }, [classFilter]);

  const normalizeYearLabel = (label: string) => {
    const match = label.match(/(\d{4})/);
    return match ? Number(match[1]) : NaN;
  };

  const sortedYears = useMemo(() => {
    return [...years].sort((a, b) => {
      if (a.start_date && b.start_date) {
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      }
      const yearA = normalizeYearLabel(a.label);
      const yearB = normalizeYearLabel(b.label);
      if (!isNaN(yearA) && !isNaN(yearB)) {
        return yearA - yearB;
      }
      return a.label.localeCompare(b.label);
    });
  }, [years]);

  const nextAcademicYear = useMemo(() => {
    if (!selectedYear || sortedYears.length === 0) return null;
    const currentIndex = sortedYears.findIndex((year) => year.id === selectedYear.id);
    if (currentIndex === -1 || currentIndex === sortedYears.length - 1) return null;
    return sortedYears[currentIndex + 1];
  }, [selectedYear, sortedYears]);

  useEffect(() => {
    setSelectedStudentIds([]);
    setSelectAll(false);
    setIsSelectionMode(false);
  }, [classFilter, selectedYearId, students.length]);

  const fetchNextYearClasses = useCallback(async () => {
    if (!nextAcademicYear) {
      setNextYearClasses([]);
      return;
    }

    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('academic_year_id', nextAcademicYear.id)
      .order('name');

    if (error) {
      console.error('Erreur lors de la récupération des prochaines classes :', error.message);
      setNextYearClasses([]);
      return;
    }

    setNextYearClasses(data || []);
  }, [nextAcademicYear]);

  useEffect(() => {
    if (!yearLoading) {
      fetchNextYearClasses();
    }
  }, [fetchNextYearClasses, yearLoading]);

  useEffect(() => {
    if (nextYearClasses.length && !targetNextClassId) {
      setTargetNextClassId(String(nextYearClasses[0]?.id || ''));
    }
  }, [nextYearClasses, targetNextClassId]);

  const fetchData = useCallback(async () => {
    if (!selectedYearId) return;
    
    setLoading(true);
    try {
      let query = supabase.from('students').select('*, classes(name)').eq('academic_year_id', selectedYearId);
      if (classFilter) query = query.eq('class_id', classFilter);
      const { data: stData } = await query.order('last_name', { ascending: true });
      setStudents(stData || []);

      const { data: clData } = await supabase.from('classes').select('*').eq('academic_year_id', selectedYearId).order('name');
      setClasses(clData || []);

      if (classFilter && clData) {
        const current = clData.find((c: ClassRecord) => String(c.id) === classFilter);
        setCurrentClassInfo(current || null);
      } else {
        setCurrentClassInfo(null);
      }

    } catch (error: unknown) {
      console.error('Erreur de synchronisation :', error);
    } finally {
      setLoading(false);
    }
  }, [classFilter, selectedYearId]);

  useEffect(() => { 
    if (!yearLoading && selectedYearId) {
      fetchData(); 
    }
  }, [fetchData, yearLoading, selectedYearId]);

  const stats = useMemo(() => {
    if (!students.length) return { total: 0, globalFee: 0, totalPaid: 0, totalDue: 0, generalAvg: 0, successCount: 0 };
    
    let totalFee = 0;
    let totalPaid = 0;
    let sumAvg = 0;
    let countAvg = 0;
    let success = 0;

    students.forEach(s => {
      totalFee += Number(s.scolarite_totale || s.annual_fee || 0);
      totalPaid += Number(s.scolarite_payee || 0);
      
      if (s.last_exam_avg !== undefined && s.last_exam_avg !== null) {
        sumAvg += Number(s.last_exam_avg);
        countAvg++;
        if (Number(s.last_exam_avg) >= 10) success++;
      }
    });

    return {
      total: students.length,
      globalFee: totalFee,
      totalPaid: totalPaid,
      totalDue: totalFee - totalPaid,
      generalAvg: countAvg > 0 ? sumAvg / countAvg : 0,
      successCount: success
    };
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const fullName = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase());
      
      const total = Number(student.scolarite_totale || student.annual_fee || 0);
      const paid = Number(student.scolarite_payee || 0);
      
      let matchesFinancial = true;
      if (financialFilter === 'paid') matchesFinancial = paid >= total && total > 0;
      if (financialFilter === 'debtor') matchesFinancial = paid < total;

      let matchesAcademic = true;
      if (academicFilter === 'passed') matchesAcademic = Number(student.last_exam_avg || 0) >= 10;
      if (academicFilter === 'failed') matchesAcademic = Number(student.last_exam_avg || 0) < 10;

      return matchesSearch && matchesFinancial && matchesAcademic;
    });
  }, [students, searchTerm, financialFilter, academicFilter]);

  const addStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.classId || isReadOnly) return;
    setIsSubmitting(true);
    
    const feeValue = parseFloat(formData.annualFee || '0');

    const { error } = await supabase.from('students').insert([{
      first_name: formData.firstName,
      last_name: formData.lastName,
      class_id: formData.classId,
      annual_fee: feeValue,
      scolarite_totale: feeValue,
      scolarite_payee: 0,
      parent_phone: formData.parentPhone || null,
      address: formData.address || null,
      birth_date: formData.birthDate || null,
      last_exam_avg: parseFloat(formData.lastExamAvg || '0'),
      academic_year_id: selectedYearId
    }]);

    if (!error) {
      setFormData({ firstName: '', lastName: '', classId: classFilter || '', annualFee: '', parentPhone: '', address: '', birthDate: '', lastExamAvg: '0' });
      setShowMobileForm(false);
      fetchData();
    }
    setIsSubmitting(false);
  };

  const handleDeleteStudent = async (id: string) => {
    if (isReadOnly) return;
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (!error) { 
      setConfirmDeleteId(null); 
      fetchData(); 
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      if (prev.includes(studentId)) {
        return prev.filter((id) => id !== studentId);
      }
      return [...prev, studentId];
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedStudentIds([]);
      setSelectAll(false);
      return;
    }
    const allIds = filteredStudents.map((student) => String(student.id));
    setSelectedStudentIds(allIds);
    setSelectAll(true);
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode((prev) => {
      if (prev) {
        setSelectedStudentIds([]);
        setSelectAll(false);
      }
      return !prev;
    });
  };

  const reEnrollSelectedStudents = async () => {
    if (!selectedYearId || !nextAcademicYear || !classFilter || selectedStudentIds.length === 0) return;
    if (isReadOnly) return;

    if (!targetNextClassId) {
      alert('Sélectionnez d’abord une classe cible pour l’année suivante.');
      return;
    }

    const nextClass = nextYearClasses.find((c) => String(c.id) === targetNextClassId);
    if (!nextClass) {
      alert('Classe cible introuvable pour l’année suivante. Veuillez sélectionner une autre classe.');
      return;
    }

    setIsReenrolling(true);
    const selectedStudents = students.filter((student) => selectedStudentIds.includes(String(student.id)));
    const inserts = selectedStudents.map((student) => ({
      first_name: student.first_name,
      last_name: student.last_name,
      class_id: nextClass.id,
      annual_fee: Number(student.annual_fee || student.scolarite_totale || 0),
      scolarite_totale: Number(student.scolarite_totale || student.annual_fee || 0),
      scolarite_payee: 0,
      parent_phone: student.parent_phone || null,
      address: student.address || null,
      birth_date: student.birth_date || null,
      last_exam_avg: student.last_exam_avg ?? null,
      academic_year_id: nextAcademicYear.id,
    }));

    const { error } = await supabase.from('students').insert(inserts);
    if (error) {
      console.error('Erreur de réinscription :', error.message);
      alert('Erreur lors de la réinscription. Vérifiez la console pour plus de détails.');
    } else {
      alert(`Réinscription de ${selectedStudents.length} élève(s) vers ${nextAcademicYear.label} réussie !`);
      setSelectedStudentIds([]);
      setSelectAll(false);
      fetchData();
    }
    setIsReenrolling(false);
  };

  const triggerPrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  if (yearLoading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-2xl text-slate-500 font-bold gap-3">
        <Loader2 className="animate-spin text-slate-900" size={24} />
        <span className="text-sm">Chargement de la configuration d&apos;année...</span>
      </div>
    );
  }

  if (!selectedYearId) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-8 rounded-3xl text-center text-amber-800 max-w-sm mx-auto mt-10">
        <AlertCircle size={36} className="mx-auto mb-4 text-amber-600" />
        <h2 className="text-base font-black mb-1 uppercase tracking-tight">Session scolaire manquante</h2>
        <p className="text-xs opacity-85">Activez une année scolaire pour manipuler les dossiers.</p>
      </div>
    );
  }

  return (
    // Protection globale contre le debordement horizontal sur mobile et occupation de toute la surface
    <div className="space-y-4 sm:space-y-6 pb-10 max-w-7xl mx-auto px-0 sm:px-6 w-full overflow-x-hidden print:p-0 print:bg-white">
      
      {/* HEADER : Adapté à la taille des écrans */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 px-3 sm:px-0 print:mb-6">
        <div>
          {classFilter && (
            <button 
              onClick={() => { router.push('/students'); setCurrentClassInfo(null); }}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 mb-1 transition-colors print:hidden"
            >
              <ArrowLeft size={14} /> Voir toutes les classes
            </button>
          )}
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${classFilter ? 'bg-indigo-600' : 'bg-emerald-600'}`} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {classFilter ? `Profil Classe Active` : `Registre Général`}
            </p>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-950 tracking-tight uppercase wrap-break-word">
            {classFilter && currentClassInfo ? `Classe : ${currentClassInfo.name}` : 'Registre des Élèves'}
          </h1>
        </div>
        
        {/* Actions d'entête responsives */}
        <div className="flex items-center justify-between sm:justify-end gap-2 print:hidden">
          <button
            onClick={triggerPrint}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-800 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs shadow-sm hover:bg-slate-50 transition-all flex-1 sm:flex-none"
          >
            <FileText size={15} className="text-slate-500" />
            <span>Exporter PDF</span>
          </button>

          <button 
            onClick={() => setShowMobileForm(!showMobileForm)}
            className="md:hidden h-9 w-9 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-md shrink-0"
          >
            {showMobileForm ? <X size={18} /> : <Plus size={18} />}
          </button>
        </div>
      </div>

      {isReadOnly && (
        <div className="mx-3 sm:mx-0 bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-2.5 text-amber-700 print:hidden">
          <Lock size={15} className="shrink-0" />
          <p className="text-[11px] sm:text-xs font-semibold">Mode consultation active. Les modifications sont bloquées.</p>
        </div>
      )}

      {/* BLOCS STATISTIQUES : Grid 2 colonnes sur Mobile, 4 sur PC */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 px-3 sm:px-0">
        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 sm:gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-900 shrink-0">
            <GraduationCap size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase truncate">Effectif</p>
            <p className="text-sm sm:text-lg font-black text-slate-900 leading-tight truncate">{stats.total} <span className="text-[10px] font-normal text-slate-400">élèves</span></p>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 sm:gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
            <DollarSign size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase truncate">Recouvré</p>
            <p className="text-sm sm:text-lg font-black text-emerald-600 leading-tight truncate">{shouldHideFinancials ? '••••••' : stats.totalPaid.toLocaleString()} <span className="text-[8px] font-bold text-emerald-400">FCFA</span></p>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 sm:gap-3">
          <div className="p-2 bg-rose-50 rounded-lg text-rose-600 shrink-0">
            <AlertCircle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase truncate">Restant dû</p>
            <p className="text-sm sm:text-lg font-black text-rose-600 leading-tight truncate">{shouldHideFinancials ? '••••••' : stats.totalDue.toLocaleString()} <span className="text-[8px] font-bold text-rose-400">FCFA</span></p>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 sm:gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 shrink-0">
            <Award size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase truncate">Moyenne</p>
            <p className="text-sm sm:text-lg font-black text-indigo-600 leading-tight truncate">
              {stats.generalAvg.toFixed(2)}/20
            </p>
          </div>
        </div>
      </div>

      {/* FILTRES AVANCÉS : Empilés proprement sur mobile */}
      <div className="mx-3 sm:mx-0 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm space-y-2.5 print:hidden">
        <div className="flex flex-col lg:flex-row gap-2.5">
          {/* Barre de Recherche */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Chercher par nom..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl outline-none font-bold text-xs text-slate-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Menus Déroulants Filtres */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            <select 
              className="p-2 bg-slate-50 border-0 rounded-xl font-bold text-xs text-slate-700 outline-none cursor-pointer w-full"
              value={financialFilter}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setFinancialFilter(e.target.value as 'all' | 'paid' | 'debtor')}
            >
              <option value="all">Scolarité (Tous)</option>
              <option value="paid">En règle</option>
              <option value="debtor">En dette</option>
            </select>

            <select 
              className="p-2 bg-slate-50 border-0 rounded-xl font-bold text-xs text-slate-700 outline-none cursor-pointer w-full"
              value={academicFilter}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setAcademicFilter(e.target.value as 'all' | 'passed' | 'failed')}
            >
              <option value="all">Résultats (Tous)</option>
              <option value="passed">Moyenne ≥ 10</option>
              <option value="failed">Moyenne &lt; 10</option>
            </select>

            {!classFilter && (
              <select 
                className="p-2 bg-indigo-50 border-0 rounded-xl font-black text-xs text-indigo-700 outline-none cursor-pointer col-span-2 sm:col-span-1 w-full"
                onChange={(e) => e.target.value ? router.push(`/students?class=${e.target.value}`) : null}
                defaultValue=""
              >
                <option value="">Isoler une classe...</option>
                {classes.map((c: ClassRecord) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {classFilter && (
        <div className="mx-3 sm:mx-0">
          {!showReenrollmentSection ? (
            <button
              onClick={() => setShowReenrollmentSection(true)}
              type="button"
              className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-black uppercase hover:bg-slate-50 transition print:hidden shadow-sm"
            >
              Ouverture des réinscriptions
            </button>
          ) : (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3 print:hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400 font-black">Réinscription de classe</p>
                    <button 
                      onClick={() => { setShowReenrollmentSection(false); setIsSelectionMode(false); setSelectedStudentIds([]); setSelectAll(false); }}
                      className="text-slate-400 hover:text-slate-600 sm:hidden"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p className="text-sm font-bold text-slate-700 mt-1">
                    {isSelectionMode
                      ? 'Sélectionnez les élèves, choisissez la classe cible et lancez la réinscription.'
                      : 'Activez la réinscription pour sélectionner des élèves et choisir leur classe de l’année suivante.'
                    }
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSelectionMode}
                    type="button"
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-black uppercase hover:bg-slate-50 transition"
                  >
                    {isSelectionMode ? 'Annuler réinscription' : 'Activer réinscription'}
                  </button>
                  {isSelectionMode && (
                    <button
                      onClick={reEnrollSelectedStudents}
                      type="button"
                      disabled={isReenrolling || selectedStudentIds.length === 0 || !nextAcademicYear || isReadOnly || !targetNextClassId}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isReenrolling ? 'En cours...' : `Réinscrire ${selectedStudentIds.length} élève(s)`}
                    </button>
                  )}
                </div>
              </div>

              {!nextAcademicYear ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-amber-800 text-xs font-semibold">
                  Aucune année scolaire suivante configurée pour la réinscription. Ajoutez une année dans les paramètres.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black uppercase text-slate-400">Année suivante</label>
                    <p className="text-sm font-bold text-slate-700">{nextAcademicYear.label}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black uppercase text-slate-400">Classe cible</label>
                    <select
                      value={targetNextClassId}
                      onChange={(e) => setTargetNextClassId(e.target.value)}
                      disabled={!isSelectionMode}
                      className="w-full p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-green-200"
                    >
                      <option value="">Sélectionner la classe cible...</option>
                      {nextYearClasses.map((c: ClassRecord) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {isSelectionMode && nextAcademicYear && nextYearClasses.length === 0 && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-amber-800 text-xs font-semibold">
                  Aucune classe configurée pour l’année {nextAcademicYear.label}. Créez d’abord les classes pour réinscrire les élèves.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* FORMULAIRE : Responsive (Block sur PC, affichage Toggleable sur Mobile) */}
      <div className={`${showMobileForm ? 'block mx-3' : 'hidden md:block'} bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm print:hidden`}>
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">Nouvelle Inscription</h2>
        <form onSubmit={addStudent} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Prénom</label>
              <input type="text" placeholder="Moussa" className="w-full p-2.5 bg-slate-50 rounded-lg outline-none font-bold text-xs text-slate-800" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} disabled={isReadOnly} required />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Nom</label>
              <input type="text" placeholder="Diarra" className="w-full p-2.5 bg-slate-50 rounded-lg outline-none font-bold text-xs text-slate-800" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} disabled={isReadOnly} required />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Naissance</label>
              <input type="date" className="w-full p-2.5 bg-slate-50 rounded-lg outline-none font-bold text-xs text-slate-600" value={formData.birthDate} onChange={(e) => setFormData({...formData, birthDate: e.target.value})} disabled={isReadOnly} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Classe</label>
              <select className="w-full p-2.5 bg-slate-50 rounded-lg outline-none font-bold text-xs text-slate-800" value={formData.classId} onChange={(e) => setFormData({...formData, classId: e.target.value})} disabled={isReadOnly || !!classFilter} required >
                <option value="">Sélectionner...</option>
                {classes.map((c: ClassRecord) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Téléphone Parent</label>
              <input type="text" placeholder="70000000" className="w-full p-2.5 bg-slate-50 rounded-lg outline-none font-bold text-xs text-slate-800" value={formData.parentPhone} onChange={(e) => setFormData({...formData, parentPhone: e.target.value})} disabled={isReadOnly} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Adresse</label>
              <input type="text" placeholder="Quartier..." className="w-full p-2.5 bg-slate-50 rounded-lg outline-none font-bold text-xs text-slate-800" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} disabled={isReadOnly} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Frais Annuels (FCFA)</label>
              <NumericInput
                placeholder="Montant total..."
                className="w-full p-2.5 bg-slate-50 rounded-lg outline-none font-bold text-slate-900 text-xs"
                value={formData.annualFee === '' ? undefined : Number(formData.annualFee)}
                onChange={(v) => setFormData({...formData, annualFee: v === undefined ? '' : String(v)})}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <button type="submit" disabled={isSubmitting || isReadOnly} className="w-full md:w-auto bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wide shadow-sm disabled:opacity-50">
            {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={14} /> : 'Valider l\'inscription'}
          </button>
        </form>
      </div>

      {/* 🖥️ AFFICHAGE ÉCRANS LARGES (PC / TABLETTES) : Tableau de bord natif */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden print:border-0 print:shadow-none">
        <div className="w-full overflow-x-auto no-scrollbar">
          <table className="w-full text-left min-w-187.5 print:min-w-full">
            <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-100 print:bg-slate-100">
              <tr>
                {classFilter && isSelectionMode && (
                  <th className="px-4 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                    />
                  </th>
                )}
                <th className="px-6 py-4">Nom complet & Classe</th>
                <th className="px-4 py-4 text-center">Contact Parent</th>
                <th className="px-4 py-4 text-right">Frais d&apos;Études</th>
                <th className="px-4 py-4 text-right">Payé (FCFA)</th>
                <th className="px-4 py-4 text-center">Moyenne</th>
                <th className="px-6 py-4 text-right print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-slate-900" size={20} /></td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-xs font-semibold text-slate-400">Aucun élève trouvé.</td></tr>
              ) : filteredStudents.map((s: StudentRecord) => {
                const totalFee = Number(s.scolarite_totale || s.annual_fee || 0);
                const paidFee = Number(s.scolarite_payee || 0);
                const examAvg = Number(s.last_exam_avg ?? 0);
                const isSettled = paidFee >= totalFee && totalFee > 0;

                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors print:break-inside-avoid">
                    {classFilter && isSelectionMode && (
                      <td className="px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(String(s.id))}
                          onChange={() => toggleStudentSelection(String(s.id))}
                          className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                        />
                      </td>
                    )}
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs uppercase shrink-0 print:border">
                          {s.first_name?.[0]}{s.last_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate uppercase">{s.last_name} <span className="capitalize font-semibold text-slate-700">{s.first_name}</span></p>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{s.classes?.name || 'Inconnu'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center font-medium text-slate-600 text-xs whitespace-nowrap">{s.parent_phone || '---'}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900 text-xs">{totalFee.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span className={`text-xs font-black ${isSettled ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {paidFee.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-black ${examAvg >= 10 ? 'text-emerald-700 bg-emerald-50 print:bg-transparent' : 'text-rose-700 bg-rose-50 print:bg-transparent'}`}>
                        {examAvg.toFixed(2)}/20
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap print:hidden">
                      <div className="flex justify-end gap-3 items-center">
                        <button onClick={() => !isReadOnly && setConfirmDeleteId(String(s.id))} disabled={isReadOnly} className={`transition-colors ${isReadOnly ? 'text-slate-100 cursor-not-allowed' : 'text-slate-300 hover:text-rose-600'}`}><Trash2 size={14} /></button>
                        <Link href={`/students/${s.id}`} className="h-8 w-8 bg-slate-900 text-white rounded-lg flex items-center justify-center shadow-sm active:scale-95"><ArrowUpRight size={15} /></Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📱 AFFICHAGE SMARTPHONE (MOBILE-ONLY) : Liste de fiches fluides et optimisées au toucher */}
      <div className="block md:hidden space-y-2.5 print:block">
        {loading ? (
          <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-slate-900" size={20} /></div>
        ) : filteredStudents.length === 0 ? (
          <p className="text-xs font-semibold text-slate-400 py-6 text-center">Aucun étudiant trouvé.</p>
        ) : filteredStudents.map((s: StudentRecord) => {
          const totalFee = Number(s.scolarite_totale || s.annual_fee || 0);
          const paidFee = Number(s.scolarite_payee || 0);
          const examAvg = Number(s.last_exam_avg ?? 0);
          const isSettled = paidFee >= totalFee && totalFee > 0;

          return (
            <div key={s.id} className="bg-white p-3.5 rounded-none border-b border-slate-100 shadow-none flex flex-col gap-2.5 print:break-inside-avoid print:border-b">
              {/* Entête de carte : Identité & Note */}
              <div className="flex items-center gap-3">
                {classFilter && isSelectionMode && (
                  <label className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(String(s.id))}
                      onChange={() => toggleStudentSelection(String(s.id))}
                      className="h-4 w-4 rounded border-slate-300 text-green-600"
                    />
                  </label>
                )}
                <div className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs uppercase shrink-0">
                  {s.first_name?.[0]}{s.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-xs sm:text-sm truncate uppercase">{s.last_name} {s.first_name}</p>
                  <p className="text-[10px] font-bold text-slate-400 truncate uppercase">{s.classes?.name || 'Sans Division'}</p>
                </div>
                <div className={`px-2 py-0.5 rounded font-black text-[10px] shrink-0 ${examAvg >= 10 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {examAvg.toFixed(1)}/20
                </div>
              </div>
              
              {/* Détails financiers tactiles */}
              <div className="grid grid-cols-2 bg-slate-50 p-2 rounded-lg text-[11px] gap-1">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Dû Annuel</span>
                  <span className="font-bold text-slate-900">{totalFee.toLocaleString()} F</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Total Payé</span>
                  <span className={`font-black ${isSettled ? 'text-emerald-600' : 'text-amber-600'}`}>{paidFee.toLocaleString()} F</span>
                </div>
              </div>

              {/* Pied de carte : Contact parent & Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <div className="flex items-center gap-1 text-slate-500 font-bold text-[10px]">
                  <Phone size={11} className="text-slate-400" />
                  <span>{s.parent_phone || '---'}</span>
                </div>
                <div className="flex items-center gap-4 print:hidden">
                  <button onClick={() => !isReadOnly && setConfirmDeleteId(String(s.id))} disabled={isReadOnly} className={`${isReadOnly ? 'text-slate-100' : 'text-slate-300 hover:text-rose-600'}`}><Trash2 size={14} /></button>
                  <Link href={`/students/${s.id}`} className="h-7 w-7 bg-slate-900 text-white rounded-lg flex items-center justify-center shadow-sm"><ArrowUpRight size={14} /></Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Impression CSS globale */}
      <style jsx global>{`
        @media print {
          body { background: white; color: black; font-size: 11px; }
          .print\\:hidden { display: none !important; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
          table { width: 100% !important; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #e2e8f0 !important; padding: 6px !important; }
        }
      `}</style>

      {/* Modal de confirmation de radiation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/20 backdrop-blur-sm print:hidden">
          <div className="bg-white p-5 rounded-xl shadow-xl w-full max-w-xs text-center border border-slate-100">
            <p className="font-black text-slate-900 text-xs uppercase mb-4">Confirmer la suppression ?</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleDeleteStudent(confirmDeleteId)} className="bg-rose-600 text-white py-2 rounded-lg font-bold text-xs uppercase">Supprimer</button>
              <button onClick={() => setConfirmDeleteId(null)} className="bg-slate-100 text-slate-500 py-2 rounded-lg font-bold text-xs uppercase">Annuler</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}