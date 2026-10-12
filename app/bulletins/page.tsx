'use client';

import { Fragment, useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { offlineFetch, offlineWrite } from '@/utils/offlineApi';
import { useCacheRefresh } from '@/hooks/useCacheRefresh';
import { useYear } from '@/context/YearContext';
import { 
  Settings, PenTool, BarChart3, FileText, Plus, Trash2, 
  Download, Trophy, Search, ChevronLeft, ChevronRight,
  Filter, ArrowRight, Maximize2, Minimize2
} from 'lucide-react';

export default function EngineScolaire() {
  const { selectedYearId, isReadOnly, isLoading: yearLoading, selectedYear } = useYear();

  const [tab, setTab] = useState<'saisie' | 'resultats' | 'config'>('saisie');
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [period, setPeriod] = useState('1er Trimestre');
  const [year, setYear] = useState(selectedYear?.label || '2025-2026');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [rawGrades, setRawGrades] = useState<any[]>([]);
  const [searchSaisie, setSearchSaisie] = useState('');
  const [searchBulletins, setSearchBulletins] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubCoeff, setNewSubCoeff] = useState('1');
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [savedGrades, setSavedGrades] = useState<Set<string>>(new Set());
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const [school, setSchool] = useState<any>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);

  useCacheRefresh({
    cachePattern: /^(class_subjects:|student_grades:)/,
    onInvalidate: () => {
      if (selectedClassId) {
        loadClassData();
      }
    },
    debounceMs: 150,
    refreshOnFocus: true,
    refreshOnVisibilityChange: true,
    refreshIntervalMs: 120000,
  });

  const isSecondCycle = useMemo(() => {
    const currentClass = classes.find(c => c.id === selectedClassId);
    if (!currentClass) return false;
    const name = currentClass.name.toLowerCase();
    return name.includes('7') || name.includes('8') || name.includes('9') || name.includes('10') || name.includes('11') || name.includes('12');
  }, [selectedClassId, classes]);

  useEffect(() => {
    async function getClasses() {
      if (!selectedYearId) return;
      const { data, error } = await offlineFetch<any[]>(`bulletins_classes:${selectedYearId}`, async () => {
        return await supabase.from('classes').select('*').eq('academic_year_id', selectedYearId);
      });
      if (error) console.error('Erreur récupération classes hors ligne :', error);
      setClasses(data || []);
    }
    if (!yearLoading && selectedYearId) {
      getClasses();
    }
  }, [selectedYearId, yearLoading]);

  useEffect(() => {
    async function fetchSchool() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('school_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.school_id) {
          const { data, error } = await offlineFetch<any>(`bulletins_school:${profile.school_id}`, async () => {
            return await supabase
              .from('schools')
              .select('*')
              .eq('id', profile.school_id)
              .maybeSingle();
          });
          if (error) throw error;
          if (data) {
            setSchool(data);
          }
        }
      } catch (error) {
        console.error('Erreur récupération école:', error);
      } finally {
        setLoadingSchool(false);
      }
    }
    fetchSchool();
  }, []);

  useEffect(() => {
    if (selectedClassId) loadClassData();
  }, [selectedClassId, period, year]);

  async function loadClassData() {
    if (!selectedYearId) return;
    setLoading(true);

    const { data: sub, error: subError } = await offlineFetch<any[]>(`bulletins_subjects:${selectedClassId}:${selectedYearId}`, async () => {
      return await supabase.from('class_subjects').select('*').eq('class_id', selectedClassId).eq('academic_year_id', selectedYearId);
    });

    const { data: stu, error: stuError } = await offlineFetch<any[]>(`bulletins_students:${selectedClassId}:${selectedYearId}`, async () => {
      return await supabase.from('students').select('*').eq('class_id', selectedClassId).eq('academic_year_id', selectedYearId);
    });

    const { data: grd, error: grdError } = await offlineFetch<any[]>(`bulletins_grades:${selectedClassId}:${period}:${year}`, async () => {
      return await supabase.from('student_grades')
        .select('*')
        .eq('class_id', selectedClassId)
        .eq('period', period)
        .eq('academic_year', year);
    });

    if (subError) console.error('Erreur récupération matières hors ligne :', subError);
    if (stuError) console.error('Erreur récupération élèves hors ligne :', stuError);
    if (grdError) console.error('Erreur récupération notes hors ligne :', grdError);

    setSubjects(sub || []);
    setStudents(stu || []);
    setRawGrades(grd || []);
    setCurrentStudentIndex(0);
    setSavedGrades(new Set());
    setLoading(false);
  }

  const addSubject = async () => {
    if (!selectedClassId || !newSubName || isReadOnly || !selectedYearId) return;
    const { error } = await offlineWrite({
      table: 'class_subjects',
      action: 'INSERT',
      payload: {
        class_id: selectedClassId,
        subject_name: newSubName,
        coefficient: parseFloat(newSubCoeff),
        academic_year_id: selectedYearId
      },
      cacheKey: `bulletins_subjects:${selectedClassId}:${selectedYearId}`,
      optimisticUpdate: () => {
        setSubjects((prev) => [
          { id: `offline-${Date.now()}`, class_id: selectedClassId, subject_name: newSubName, coefficient: parseFloat(newSubCoeff), academic_year_id: selectedYearId },
          ...prev,
        ]);
      }
    });

    if (!error) {
      setNewSubName('');
      loadClassData();
    }
  };

  const deleteSubject = async (id: string) => {
    if (isReadOnly) return;
    const { error } = await offlineWrite({
      table: 'class_subjects',
      action: 'DELETE',
      payload: {},
      options: { keyColumn: 'id', keyValue: id },
      cacheKey: `bulletins_subjects:${selectedClassId}:${selectedYearId}`,
      optimisticUpdate: () => {
        setSubjects((prev) => prev.filter((s) => String(s.id) !== id));
      }
    });
    if (!error) loadClassData();
  };

  const filteredStudentsSaisie = useMemo(() => {
    return students.filter(s => `${s.last_name} ${s.first_name}`.toLowerCase().includes(searchSaisie.toLowerCase()));
  }, [students, searchSaisie]);

  const displayedSubjects = useMemo(() => {
    if (selectedSubjectFilter === 'all') return subjects;
    return subjects.filter(s => s.id === selectedSubjectFilter);
  }, [subjects, selectedSubjectFilter]);

  const bulletinData = useMemo(() => {
    const data = students
      .map(student => {
        let totalPondere = 0;
        let totalCoeffs = 0;
        const detailNotes = subjects.map(sub => {
          const matchingGrade = rawGrades.find(g => g.student_id === student.id && g.subject_name === sub.subject_name);
          const noteClasse = matchingGrade ? parseFloat(matchingGrade.grade_value) || 0 : 0;
          const noteCompo = matchingGrade ? parseFloat(matchingGrade.compo_value) || 0 : 0;
          let moyenneMatiere = 0;
          if (isSecondCycle) {
            moyenneMatiere = (noteClasse + (noteCompo * 2)) / 3;
          } else {
            moyenneMatiere = noteCompo;
          }
          totalPondere += (moyenneMatiere * sub.coefficient);
          totalCoeffs += sub.coefficient;
          return {
            name: sub.subject_name,
            noteClasse,
            noteCompo,
            moyenneMatiere: parseFloat(moyenneMatiere.toFixed(2)),
            coeff: sub.coefficient,
            points: moyenneMatiere * sub.coefficient
          };
        });
        const moyenne = totalCoeffs > 0 ? totalPondere / totalCoeffs : 0;
        return {
          ...student,
          notes: detailNotes,
          moyenne: parseFloat(moyenne.toFixed(2)),
          totalPoints: totalPondere,
          totalCoeffs
        };
      })
      .sort((a, b) => b.moyenne - a.moyenne)
      .map((s, i) => ({ ...s, rang: i + 1 }));
    return data.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchBulletins.toLowerCase()));
  }, [students, subjects, rawGrades, isSecondCycle, searchBulletins]);

  const getMention = (m: number) => {
    const ratio = m / (isSecondCycle ? 20 : 10);
    if (ratio >= 0.8) return "Très Bien";
    if (ratio >= 0.7) return "Bien";
    if (ratio >= 0.6) return "Assez Bien";
    if (ratio >= 0.5) return "Passable";
    return "Insuffisant";
  };

  const getAppreciation = (note: number) => {
    const ratio = note / (isSecondCycle ? 20 : 10);
    if (ratio >= 0.9) return "Excellent travail";
    if (ratio >= 0.8) return "Très bien";
    if (ratio >= 0.7) return "Bien";
    if (ratio >= 0.6) return "Assez bien";
    if (ratio >= 0.5) return "Passable, des efforts à faire";
    if (ratio >= 0.4) return "Insuffisant, doit travailler plus";
    if (ratio >= 0.25) return "Faible, attention";
    return "Très faible";
  };

  const applyScaleToFit = (el: HTMLElement) => {
    el.style.transform = '';
    el.style.transformOrigin = '';
    el.style.lineHeight = '';
    el.style.fontSize = '';
    let needsAttach = !el.isConnected;
    if (needsAttach) {
      document.body.appendChild(el);
    }
    const h = el.scrollHeight;
    if (needsAttach) {
      document.body.removeChild(el);
    }
    const mmToPx = (mm: number) => mm * (96 / 25.4);
    const TARGET_HEIGHT_PX = mmToPx(297) - 20;
    if (h > TARGET_HEIGHT_PX) {
      const scale = Math.max(0.5, TARGET_HEIGHT_PX / h);
      el.style.transformOrigin = 'top left';
      el.style.transform = `scale(${scale})`;
      el.style.lineHeight = '1.05';
      el.style.fontSize = `calc(1rem * ${scale})`;
      return () => {
        el.style.transform = '';
        el.style.transformOrigin = '';
        el.style.lineHeight = '';
        el.style.fontSize = '';
      };
    }
    return () => {};
  };

  const downloadPDF = async (student: any) => {
    const [{ jsPDF }, html2canvas] = await Promise.all([
      import('jspdf').then(m => ({ jsPDF: (m as any).jsPDF || (m as any).default?.jsPDF || (m as any).default })),
      import('html2canvas').then(m => (m as any).default || m)
    ]);
    const element = document.getElementById(`bulletin-pdf-${student.id}`);
    if (!element) return;
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.display = 'block';
    clone.style.width = '210mm';
    clone.style.boxSizing = 'border-box';
    clone.style.position = 'fixed';
    clone.style.left = '-9999px';
    document.body.appendChild(clone);
    const reset = applyScaleToFit(clone);
    try {
      const canvas = await (html2canvas as any)(clone, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new (jsPDF as any)({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidthMM = pdf.internal.pageSize.getWidth();
      const pageHeightMM = pdf.internal.pageSize.getHeight();
      const imgProps = (pdf as any).getImageProperties(imgData);
      let pdfW = pageWidthMM;
      let pdfH = (imgProps.height * pdfW) / imgProps.width;
      if (pdfH > pageHeightMM) {
        const scale = pageHeightMM / pdfH;
        pdfW = pdfW * scale;
        pdfH = pageHeightMM;
      }
      const x = (pageWidthMM - pdfW) / 2;
      const y = 0;
      pdf.addImage(imgData, 'JPEG', x, y, pdfW, pdfH);
      const filename = `Bulletin_${student.first_name}_${student.last_name}_${period}.pdf`;
      pdf.save(filename);
    } finally {
      reset();
      document.body.removeChild(clone);
    }
  };

  const downloadAllInOnePDF = async () => {
    if (bulletinData.length === 0) return;
    setLoading(true);
    try {
      const [{ jsPDF }, html2canvas] = await Promise.all([
        import('jspdf').then(m => ({ jsPDF: (m as any).jsPDF || (m as any).default?.jsPDF || (m as any).default })),
        import('html2canvas').then(m => (m as any).default || m)
      ]);
      const pdf = new (jsPDF as any)({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const mmToPx = (mm: number) => mm * (96 / 25.4);
      const pageWidthMM = pdf.internal.pageSize.getWidth();
      for (let i = 0; i < bulletinData.length; i++) {
        const student = bulletinData[i];
        const element = document.getElementById(`bulletin-pdf-${student.id}`);
        if (!element) continue;
        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.display = 'block';
        clone.style.width = '210mm';
        clone.style.boxSizing = 'border-box';
        clone.style.padding = '16px';
        clone.style.fontSize = '12px';
        clone.style.lineHeight = '1.1';
        try {
          Array.from(clone.querySelectorAll('img')).forEach((img: any) => {
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
          });
        } catch (_) {}
        clone.style.position = 'fixed';
        clone.style.left = '-9999px';
        document.body.appendChild(clone);
        const resetScale = applyScaleToFit(clone);
        const canvas = await (html2canvas as any)(clone, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const imgProps = (pdf as any).getImageProperties(imgData);
        const pxToMm = (px: number) => (px * 25.4) / 96;
        const imgWmm = pxToMm(imgProps.width);
        const imgHmm = pxToMm(imgProps.height);
        const pageMarginMM = 10;
        const maxW = pageWidthMM - pageMarginMM * 2;
        const maxH = pdf.internal.pageSize.getHeight() - pageMarginMM * 2;
        let renderW = Math.min(imgWmm, maxW);
        let renderH = (imgHmm * renderW) / imgWmm;
        if (renderH > maxH) {
          renderH = maxH;
          renderW = (imgWmm * renderH) / imgHmm;
        }
        const x = (pageWidthMM - renderW) / 2;
        const y = pageMarginMM;
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', x, y, renderW, renderH);
        try {
          resetScale();
        } catch (_) {}
        document.body.removeChild(clone);
      }
      const className = classes.find(c => c.id === selectedClassId)?.name || 'Classe';
      pdf.save(`Bulletins_Complets_${className}_${period}.pdf`);
    } catch (error) {
      console.error("Erreur lors de la génération du PDF groupé", error);
    }
    setLoading(false);
  };

  const saveGrade = async (
    studentId: string,
    subjectName: string,
    field: 'grade_value' | 'compo_value',
    value: string
  ) => {
    if (value.trim() === '') return;

    const val = parseFloat(value);
    const maxGrade = isSecondCycle ? 20 : 10;
    if (isNaN(val) || val < 0 || val > maxGrade) return;

    const existingGrade = rawGrades.find(
      (g) =>
        String(g.student_id) === String(studentId) &&
        g.subject_name === subjectName &&
        g.period === period &&
        String(g.academic_year) === String(year)
    );

    const gradeKey = `${studentId}-${subjectName}-${field}`;
    const cacheKey = `bulletins_grades:${selectedClassId}:${period}:${year}`;

    if (existingGrade?.id && !String(existingGrade.id).startsWith('temp-')) {
      const { error } = await offlineWrite({
        table: 'student_grades',
        action: 'UPDATE',
        payload: { [field]: val },
        options: { keyColumn: 'id', keyValue: existingGrade.id },
        cacheKey: cacheKey,
        optimisticUpdate: () => {
          setRawGrades((prev) =>
            prev.map((g) => (g.id === existingGrade.id ? { ...g, [field]: val } : g))
          );
        },
      });

      if (!error) {
        setSavedGrades((prev) => new Set(prev).add(gradeKey));
        setTimeout(() => {
          setSavedGrades((prev) => {
            const next = new Set(prev);
            next.delete(gradeKey);
            return next;
          });
        }, 800);
      } else {
        console.error('Erreur UPDATE note :', error);
      }
    } else {
      const newGradePayload: any = {
        student_id: studentId,
        class_id: selectedClassId,
        subject_name: subjectName,
        period: period,
        academic_year: year,
        academic_year_id: selectedYearId,
        [field]: val,
      };

      if (school?.id) {
        newGradePayload.school_id = school.id;
      }

      const tempId = `temp-${Date.now()}`;

      const { error } = await offlineWrite({
        table: 'student_grades',
        action: 'INSERT',
        payload: [newGradePayload],
        cacheKey: cacheKey,
        optimisticUpdate: () => {
          setRawGrades((prev) => [...prev, { id: tempId, ...newGradePayload }]);
        },
      });

      if (!error) {
        setSavedGrades((prev) => new Set(prev).add(gradeKey));
        setTimeout(() => {
          setSavedGrades((prev) => {
            const next = new Set(prev);
            next.delete(gradeKey);
            return next;
          });
        }, 800);
        loadClassData();
      } else {
        console.error('Erreur INSERT note :', error);
      }
    }
  };

  const handleMatrixKeyDown = (
    e: React.KeyboardEvent, 
    studentIdx: number, 
    subIdx: number, 
    field: 'grade' | 'compo'
  ) => {
    const numStudents = filteredStudentsSaisie.length;
    const numSubjects = displayedSubjects.length;

    let targetStudentIdx = studentIdx;
    let targetSubIdx = subIdx;
    let targetField = field;

    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      if (studentIdx < numStudents - 1) {
        targetStudentIdx = studentIdx + 1;
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (studentIdx > 0) {
        targetStudentIdx = studentIdx - 1;
      }
    } else if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
      if (e.key === 'ArrowRight') e.preventDefault();
      if (isSecondCycle && field === 'grade') {
        targetField = 'compo';
      } else if (subIdx < numSubjects - 1) {
        targetSubIdx = subIdx + 1;
        targetField = isSecondCycle ? 'grade' : 'compo';
      }
    } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
      if (e.key === 'ArrowLeft') e.preventDefault();
      if (isSecondCycle && field === 'compo') {
        targetField = 'grade';
      } else if (subIdx > 0) {
        targetSubIdx = subIdx - 1;
        targetField = isSecondCycle ? 'compo' : 'compo';
      }
    } else {
      return;
    }

    const nextStudent = filteredStudentsSaisie[targetStudentIdx];
    const nextSub = displayedSubjects[targetSubIdx];
    if (nextStudent && nextSub) {
      const targetKey = `${nextStudent.id}-${nextSub.subject_name}-${targetField}`;
      inputRefs.current[targetKey]?.focus();
      inputRefs.current[targetKey]?.select();
    }
  };

  const activeMobileStudent = filteredStudentsSaisie[currentStudentIndex];

  return (
    <div className="w-full text-slate-900 font-sans antialiased pb-24">
      
      {/* 1. EN-TÊTE ÉPURÉ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 border-b border-slate-200/80 pb-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            {loadingSchool ? (
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 animate-pulse">
                <BarChart3 size={20} />
              </div>
            ) : school?.logo_url ? (
              <img src={school.logo_url} alt="Logo" className="w-10 h-10 rounded-xl object-cover border border-slate-200" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <BarChart3 size={20} />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Bulletins de Notes</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 capitalize">
                {school?.name || 'Gestion des Évaluations'}
              </h1>
            </div>
          </div>

          {/* Onglets de contrôle */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 self-start sm:self-auto shadow-xs">
            {[
              { id: 'saisie', icon: PenTool, label: 'Saisie Notes' },
              { id: 'resultats', icon: Trophy, label: 'Bulletins' },
              { id: 'config', icon: Settings, label: 'Matières' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setTab(item.id as any)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  tab === item.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <item.icon size={14} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">

        {/* 2. BARRE DE SÉLECTION CLASSE & PÉRIODE */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Classe</label>
              <select
                onChange={(e) => setSelectedClassId(e.target.value)}
                value={selectedClassId}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-600 transition cursor-pointer"
              >
                <option value="">Sélectionner une classe...</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Période d'évaluation</label>
              <select
                onChange={(e) => setPeriod(e.target.value)}
                value={period}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-600 transition cursor-pointer"
              >
                <option>1er Trimestre</option>
                <option>2e Trimestre</option>
                <option>3e Trimestre</option>
                <option>Examen Final</option>
                <option>composition du mois de janvier</option>
                <option>composition du mois de février</option>
                <option>composition du mois de mars</option>
                <option>composition du mois d'avril</option>
                <option>composition du mois de mai</option>
                <option>composition du mois de juin</option>
                <option>composition du mois de juillet</option>
                <option>composition du mois d'août</option>
                <option>composition du mois de septembre</option>
                <option>composition du mois d'octobre</option>
                <option>composition du mois de décembre</option>
              </select>
            </div>
          </div>
        </div>

        {!selectedClassId && (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <BarChart3 className="mx-auto text-slate-300 mb-2" size={28} />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Sélectionnez une classe ci-dessus pour gérer les notes et bulletins.
            </p>
          </div>
        )}

        {/* ========================================================== */}
        {/* ONGLET 1 : SAISIE DES NOTES OPTIMISÉE (PC MATRICE + MOBILE) */}
        {/* ========================================================== */}
        {tab === 'saisie' && selectedClassId && (
          <div className={isExpanded ? 'fixed inset-0 z-[100] w-screen h-screen bg-white p-4 sm:p-6 overflow-y-auto space-y-4' : 'space-y-4'}>
            
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold" size={15} />
                <input
                  type="text"
                  value={searchSaisie}
                  onChange={(e) => setSearchSaisie(e.target.value)}
                  placeholder="Filtrer un élève par nom ou prénom..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400 shrink-0 hidden sm:block" />
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-600 transition cursor-pointer"
                >
                  <option value="all">Toutes les matières ({subjects.length})</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.subject_name}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition shadow-xs shrink-0"
                  title={isExpanded ? "Réduire l'affichage" : "Agrandir en plein écran"}
                >
                  {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  <span className="hidden sm:inline">{isExpanded ? 'Réduire' : 'Agrandir'}</span>
                </button>
              </div>
            </div>

            {/* VUE TABLETTE & PC : MATRICE SPREADSHEET PRO AVEC NAVIGATION FLÈCHES/ENTRÉE */}
            <div className={`hidden md:block bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs ${isExpanded ? 'border-2 border-blue-600/40' : ''}`}>
              {filteredStudentsSaisie.length === 0 ? (
                <div className="p-12 text-center text-xs font-bold text-slate-400">
                  Aucun élève trouvé dans cette classe.
                </div>
              ) : (
                <div className={`overflow-x-auto relative ${isExpanded ? 'max-h-[calc(100vh-160px)]' : 'max-h-[600px]'}`}>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-20 bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 sticky left-0 bg-slate-50 z-30 min-w-[200px] border-r border-slate-200">
                          Élève
                        </th>
                        {displayedSubjects.map(sub => (
                          <th key={sub.id} className="py-2.5 px-3 text-center border-r border-slate-200 min-w-[130px]" colSpan={isSecondCycle ? 2 : 1}>
                            <div className="font-extrabold text-slate-900 truncate">{sub.subject_name}</div>
                            <span className="text-[9px] font-semibold text-blue-600">Coeff. {sub.coefficient}</span>
                          </th>
                        ))}
                      </tr>
                      {isSecondCycle && (
                        <tr className="bg-slate-100/60 text-[9px] text-slate-500 border-b border-slate-200">
                          <th className="py-1 px-4 sticky left-0 bg-slate-100 z-30 border-r border-slate-200"></th>
                          {displayedSubjects.map(sub => (
                            <Fragment key={`sub-cols-${sub.id}`}>
                              <th className="py-1 text-center font-bold">Classe</th>
                              <th className="py-1 text-center font-bold border-r border-slate-200 text-blue-700">Compo</th>
                            </Fragment>
                          ))}
                        </tr>
                      )}
                    </thead>

                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredStudentsSaisie.map((student, studentIdx) => (
                        <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                          
                          <td className="py-2.5 px-4 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                            <span className="capitalize block truncate">{student.last_name} {student.first_name}</span>
                          </td>

                          {displayedSubjects.map((sub, subIdx) => {
                            const grade = rawGrades.find(g => g.student_id === student.id && g.subject_name === sub.subject_name);
                            const keyClasse = `${student.id}-${sub.subject_name}-grade_value`;
                            const keyCompo = `${student.id}-${sub.subject_name}-compo_value`;

                            return (
                              <Fragment key={`${student.id}-${sub.id}`}>
                                {isSecondCycle && (
                                  <td className="p-1.5 text-center">
                                    <input
                                      ref={(el) => {
                                        if (el) inputRefs.current[`${student.id}-${sub.subject_name}-grade`] = el;
                                      }}
                                      type="number"
                                      step="0.25"
                                      min="0"
                                      max="20"
                                      inputMode="decimal"
                                      defaultValue={grade?.grade_value ?? ''}
                                      onBlur={(e) => saveGrade(student.id, sub.subject_name, 'grade_value', e.target.value)}
                                      onKeyDown={(e) => handleMatrixKeyDown(e, studentIdx, subIdx, 'grade')}
                                      className={`w-14 h-8 text-center font-bold text-xs rounded-lg border outline-none transition ${
                                        savedGrades.has(keyClasse)
                                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                                          : 'border-slate-200 bg-slate-50/60 focus:bg-white focus:border-blue-600'
                                      }`}
                                      placeholder="—"
                                    />
                                  </td>
                                )}

                                <td className="p-1.5 text-center border-r border-slate-200">
                                  <input
                                    ref={(el) => {
                                      if (el) inputRefs.current[`${student.id}-${sub.subject_name}-compo`] = el;
                                    }}
                                    type="number"
                                    step="0.25"
                                    min="0"
                                    max={isSecondCycle ? "20" : "10"}
                                    inputMode="decimal"
                                    defaultValue={grade?.compo_value ?? ''}
                                    onBlur={(e) => saveGrade(student.id, sub.subject_name, 'compo_value', e.target.value)}
                                    onKeyDown={(e) => handleMatrixKeyDown(e, studentIdx, subIdx, 'compo')}
                                    className={`w-14 h-8 text-center font-bold text-xs rounded-lg border outline-none transition ${
                                      savedGrades.has(keyCompo)
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                                        : 'border-slate-200 bg-blue-50/40 text-blue-900 focus:bg-white focus:border-blue-600'
                                    }`}
                                    placeholder="—"
                                  />
                                </td>
                              </Fragment>
                            );
                          })}

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* VUE MOBILE : FICHE FLUIDE ET CLAVIER OPTIMISÉ */}
            <div className="md:hidden space-y-4">
              {filteredStudentsSaisie.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs font-bold text-slate-400">
                  Aucun élève trouvé
                </div>
              ) : activeMobileStudent && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                  
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                        {activeMobileStudent.first_name?.[0]}{activeMobileStudent.last_name?.[0]}
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 capitalize leading-tight">
                          {activeMobileStudent.first_name} {activeMobileStudent.last_name}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-bold block">
                          Élève {currentStudentIndex + 1} sur {filteredStudentsSaisie.length}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentStudentIndex(Math.max(0, currentStudentIndex - 1))}
                        disabled={currentStudentIndex === 0}
                        className="p-2 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-30"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() => setCurrentStudentIndex(Math.min(filteredStudentsSaisie.length - 1, currentStudentIndex + 1))}
                        disabled={currentStudentIndex === filteredStudentsSaisie.length - 1}
                        className="p-2 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-30"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {displayedSubjects.map(sub => {
                      const grade = rawGrades.find(g => g.student_id === activeMobileStudent.id && g.subject_name === sub.subject_name);
                      return (
                        <div key={sub.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-800 truncate">{sub.subject_name}</span>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Coeff. {sub.coefficient}</span>
                          </div>

                          <div className="flex gap-2.5">
                            {isSecondCycle && (
                              <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Classe /20</label>
                                <input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  max="20"
                                  inputMode="decimal"
                                  defaultValue={grade?.grade_value ?? ''}
                                  onBlur={(e) => saveGrade(activeMobileStudent.id, sub.subject_name, 'grade_value', e.target.value)}
                                  className="w-full h-11 bg-white border border-slate-300 text-center font-bold text-base text-slate-900 rounded-lg outline-none focus:border-blue-600"
                                  placeholder="—"
                                />
                              </div>
                            )}

                            <div className="flex-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                {isSecondCycle ? 'Composition /20' : 'Note d\'examen /10'}
                              </label>
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                max={isSecondCycle ? "20" : "10"}
                                inputMode="decimal"
                                defaultValue={grade?.compo_value ?? ''}
                                onBlur={(e) => saveGrade(activeMobileStudent.id, sub.subject_name, 'compo_value', e.target.value)}
                                className="w-full h-11 bg-white border border-slate-300 text-center font-bold text-base text-blue-600 rounded-lg outline-none focus:border-blue-600"
                                placeholder="—"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentStudentIndex(Math.min(filteredStudentsSaisie.length - 1, currentStudentIndex + 1))}
                    disabled={currentStudentIndex === filteredStudentsSaisie.length - 1}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <span>Passer à l'élève suivant</span>
                    <ArrowRight size={15} />
                  </button>

                </div>
              )}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* ONGLET 2 : RESULTATS & BULLETINS                         */}
        {/* ======================================================== */}
        {tab === 'resultats' && selectedClassId && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {bulletinData.length} bulletin{bulletinData.length > 1 ? 's' : ''} délibéré{bulletinData.length > 1 ? 's' : ''}
              </span>
              <button
                onClick={downloadAllInOnePDF}
                disabled={loading || bulletinData.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-40 shadow-xs"
              >
                <Download size={14} />
                <span>{loading ? 'Génération du PDF...' : 'Télécharger tous les bulletins'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bulletinData.map((s) => (
                <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 capitalize">
                        {s.first_name} {s.last_name}
                      </h3>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                      Rang : {s.rang} / {students.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Moyenne Générale</span>
                      <span className="text-2xl font-black text-blue-600 mt-0.5 block">
                        {s.moyenne} <span className="text-xs font-normal text-slate-400">/{isSecondCycle ? 20 : 10}</span>
                      </span>
                    </div>

                    <div className={`p-3 rounded-xl border flex flex-col justify-center ${
                      s.moyenne >= (isSecondCycle ? 10 : 5)
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50/50 border-rose-200 text-rose-800'
                    }`}>
                      <span className="text-[10px] font-bold uppercase block opacity-70">Mention</span>
                      <span className="text-sm font-black mt-0.5 block">{getMention(s.moyenne)}</span>
                    </div>
                  </div>

                  <div className="max-h-[140px] overflow-y-auto space-y-1.5 divide-y divide-slate-100">
                    {s.notes.map((n: any) => (
                      <div key={n.name} className="flex justify-between items-center pt-1.5 text-xs">
                        <span className="font-semibold text-slate-700 truncate pr-2">{n.name}</span>
                        <span className="font-bold text-slate-900">{n.moyenneMatiere}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => downloadPDF(s)}
                    className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <FileText size={14} className="text-blue-600" />
                    <span>Télécharger le bulletin</span>
                  </button>

                  {/* Template PDF Masqué Strictement Préservé */}
                  <div style={{ position: 'absolute', top: '-10000px', left: 0 }}>
                    <div
                      id={`bulletin-pdf-${s.id}`}
                      style={{
                        padding: '40px',
                        background: 'white',
                        color: '#0f172a',
                        fontFamily: '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif',
                        width: '210mm',
                        minHeight: '297mm',
                        boxSizing: 'border-box',
                        pageBreakAfter: 'always',
                        breakAfter: 'page',
                        pageBreakInside: 'avoid'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '35px' }}>
                        <div>
                          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '900', color: '#4f46e5', letterSpacing: '-0.5px' }}>
                            {school?.name || 'Ecole'}
                          </h1>
                          <h2 style={{ margin: '8px 0 0 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', fontWeight: 'bold' }}>
                            {school?.academie ? `${school.academie}` : ''} {school?.rive ? `• ${school.rive}` : ''}
                          </h2>
                          <h3 style={{ margin: '4px 0 0 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8' }}>
                            {school?.cap ? ` ${school.cap}` : ''}
                          </h3>
                          <h3 style={{ margin: '6px 0 0 0', fontSize: '10px', color: '#94a3b8' }}>
                            {school?.address || ''}{school?.city ? `, ${school.city}` : ''}{school?.phone ? ` • ${school.phone}` : ''}
                          </h3>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-block', background: '#4f46e5', color: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                            Bulletin de Notes
                          </div>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                            Période : <span style={{ color: '#4f46e5' }}>{period}</span>
                          </p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                            Année Scolaire : {year}
                          </p>
                        </div>
                      </div>

                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '35px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: '0 0 4px 0', fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '1px' }}>
                            Identité de l'élève
                          </p>
                          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase' }}>
                            {s.first_name} {s.last_name}
                          </h2>
                          <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                            <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                              <strong style={{ color: '#0f172a' }}>Classe :</strong> {classes.find(c => c.id === selectedClassId)?.name}
                            </p>
                            <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                              <strong style={{ color: '#0f172a' }}>Régime :</strong> {isSecondCycle ? "Second Cycle" : "Premier Cycle"}
                            </p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', background: 'white', padding: '12px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          <p style={{ margin: '0 0 4px 0', fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700' }}>
                            Rang de l'élève
                          </p>
                          <p style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: '#4f46e5' }}>
                            {s.rang} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: '600' }}>/ {students.length}</span>
                          </p>
                        </div>
                      </div>

                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                        <thead>
                          <tr>
                            <th style={{ background: '#f1f5f9', color: '#334155', padding: '12px 15px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0', borderTopLeftRadius: '8px' }}>
                              Matière
                            </th>
                            <th style={{ background: '#f1f5f9', color: '#334155', padding: '12px 15px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0' }}>
                              Coeff
                            </th>
                            {isSecondCycle && (
                              <th style={{ background: '#f1f5f9', color: '#334155', padding: '12px 15px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0' }}>
                                Classe
                              </th>
                            )}
                            {isSecondCycle && (
                              <th style={{ background: '#f1f5f9', color: '#334155', padding: '12px 15px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0' }}>
                                Compo
                              </th>
                            )}
                            <th style={{ background: '#f1f5f9', color: '#334155', padding: '12px 15px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0' }}>
                              Moy/{isSecondCycle ? '20' : '10'}
                            </th>
                            <th style={{ background: '#f1f5f9', color: '#334155', padding: '12px 15px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0' }}>
                              Pondéré
                            </th>
                            <th style={{ background: '#f1f5f9', color: '#334155', padding: '12px 15px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0', borderTopRightRadius: '8px' }}>
                              Appréciation
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.notes.map((n: any, idx: number) => (
                            <tr key={n.name} style={{ background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                              <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                                {n.name}
                              </td>
                              <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                {n.coeff}
                              </td>
                              {isSecondCycle && (
                                <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                  {n.noteClasse}
                                </td>
                              )}
                              {isSecondCycle && (
                                <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                  {n.noteCompo}
                                </td>
                              )}
                              <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                                {n.moyenneMatiere}
                              </td>
                              <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                {n.points.toFixed(2)}
                              </td>
                              <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '12px', fontStyle: 'italic', color: '#475569' }}>
                                {getAppreciation(n.moyenneMatiere)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '50px' }}>
                        <div style={{ width: '380px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                              Total Pondéré
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                              {s.totalPoints.toFixed(2)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <span style={{ fontSize: '15px', color: '#0f172a', fontWeight: '800', textTransform: 'uppercase' }}>
                              Moyenne Générale
                            </span>
                            <span style={{ fontSize: '26px', fontWeight: '900', color: '#4f46e5' }}>
                              {s.moyenne}
                              <span style={{ fontSize: '14px', color: '#94a3b8' }}>/{isSecondCycle ? '20' : '10'}</span>
                            </span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                background: s.moyenne >= (isSecondCycle ? 10 : 5) ? '#dcfce7' : '#fee2e2',
                                color: s.moyenne >= (isSecondCycle ? 10 : 5) ? '#166534' : '#991b1b',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '800',
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                              }}
                            >
                              Mention : {getMention(s.moyenne)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ width: '35%' }}>
                          <p style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Signature des parents
                          </p>
                        </div>
                        <div style={{ width: '35%', textAlign: 'right' }}>
                          <p style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Le Directeur des Études
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ONGLET 3 : CONFIGURATION DES MATIÈRES                    */}
        {/* ======================================================== */}
        {tab === 'config' && selectedClassId && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 space-y-6 shadow-xs">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase">Matières de la classe</h2>
              <p className="text-xs text-slate-500 font-medium">Définissez les disciplines enseignées et leurs coefficients respectifs</p>
            </div>

            {!isReadOnly && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pb-5 border-b border-slate-100 items-end">
                <div className="sm:col-span-6 space-y-1">
                  <label className="text-xs font-bold text-slate-700">Intitulé de la matière</label>
                  <input
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    type="text"
                    placeholder="Ex: Mathématiques, Histoire, Anglais..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-xs font-bold text-slate-700">Coefficient</label>
                  <input
                    value={newSubCoeff}
                    onChange={(e) => setNewSubCoeff(e.target.value)}
                    type="number"
                    step="1"
                    placeholder="1"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>
                <div className="sm:col-span-3">
                  <button
                    onClick={addSubject}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Plus size={15} />
                    <span>Ajouter la matière</span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {subjects.length === 0 ? (
                <p className="text-xs font-medium text-slate-400 py-6 text-center">Aucune matière configurée pour le moment.</p>
              ) : (
                subjects.map(s => (
                  <div key={s.id} className="flex justify-between items-center p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl hover:bg-slate-50 transition">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{s.subject_name}</p>
                      <span className="text-xs font-bold text-blue-600">Coefficient : {s.coefficient}</span>
                    </div>
                    {!isReadOnly && (
                      <button
                        onClick={() => deleteSubject(s.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Supprimer la matière"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}