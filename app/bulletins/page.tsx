'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { offlineFetch, offlineWrite } from '@/utils/offlineApi';
import { useYear } from '@/context/YearContext';
import { Settings, PenTool, BarChart3, FileText, Plus, Save, Trash2, Download, Trophy, Target, Search, Menu, X, ChevronDown, ChevronUp, Check, ChevronLeft, ChevronRight, Lock } from 'lucide-react';

export default function EngineScolaire() {
  // Hook pour l'année scolaire - DOIT être appelé avant tout usage de selectedYear
  const { selectedYearId, isReadOnly, isLoading: yearLoading, selectedYear } = useYear();

  const [tab, setTab] = useState<'config' | 'saisie' | 'resultats' | 'stats'>('saisie');
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [savedGrades, setSavedGrades] = useState<Set<string>>(new Set());
  const [scrollPosition, setScrollPosition] = useState(0);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const [school, setSchool] = useState<any>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);

  // Mise à jour de la logique : Second cycle = 7, 8, 9
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
      if (error) console.error('Erreur de récupération des classes hors ligne :', error);
      setClasses(data || []);
    }
    if (!yearLoading && selectedYearId) {
      getClasses();
    }
  }, [selectedYearId, yearLoading]);

  // Récupérer les données de l'école
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
        console.error('Erreur lors de la récupération de l\'école:', error);
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

    if (subError) console.error('Erreur de récupération des matières hors ligne :', subError);
    if (stuError) console.error('Erreur de récupération des élèves hors ligne :', stuError);
    if (grdError) console.error('Erreur de récupération des notes hors ligne :', grdError);

    setSubjects(sub || []);
    setStudents(stu || []);
    setRawGrades(grd || []);
    setCurrentStudentIndex(0);
    setSavedGrades(new Set());
    setScrollPosition(0);
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
    return students.filter(s => ` ${s.last_name} ${s.first_name}`.toLowerCase().includes(searchSaisie.toLowerCase()));
  }, [students, searchSaisie]);

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

  const saveGrade = async (studentId: string, subjectName: string, field: 'grade_value' | 'compo_value', value: string) => {
    const val = parseFloat(value);
    const maxGrade = isSecondCycle ? 20 : 10;
    if (isNaN(val) || val < 0 || val > maxGrade) return;
    const { error } = await offlineWrite({
      table: 'student_grades',
      action: 'UPSERT',
      payload: {
        student_id: studentId,
        class_id: selectedClassId,
        subject_name: subjectName,
        period: period,
        academic_year: year,
        [field]: val
      },
      cacheKey: `bulletins_grades:${selectedClassId}:${period}:${year}`
    });
    if (!error) {
      const key = `${studentId}-${subjectName}-${field}`;
      setSavedGrades(prev => new Set(prev).add(key));
      setTimeout(() => {
        setSavedGrades(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }, 1000);
      loadClassData();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, studentIndex: number, subjectIndex: number, field: 'grade' | 'compo') => {
    const student = filteredStudentsSaisie[studentIndex];
    const subject = subjects[subjectIndex];
    
    if (!student || !subject) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (studentIndex < filteredStudentsSaisie.length - 1) {
          setCurrentStudentIndex(studentIndex + 1);
          setTimeout(() => {
            const nextKey = `${filteredStudentsSaisie[studentIndex + 1].id}-${subject.subject_name}-${field === 'grade' ? 'grade' : 'compo'}`;
            inputRefs.current[nextKey]?.focus();
          }, 0);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (studentIndex > 0) {
          setCurrentStudentIndex(studentIndex - 1);
          setTimeout(() => {
            const prevKey = `${filteredStudentsSaisie[studentIndex - 1].id}-${subject.subject_name}-${field === 'grade' ? 'grade' : 'compo'}`;
            inputRefs.current[prevKey]?.focus();
          }, 0);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (field === 'grade' && isSecondCycle) {
          const compoKey = `${student.id}-${subject.subject_name}-compo`;
          inputRefs.current[compoKey]?.focus();
        } else if (subjectIndex < subjects.length - 1) {
          const nextSubject = subjects[subjectIndex + 1];
          const nextKey = `${student.id}-${nextSubject.subject_name}-${isSecondCycle ? 'grade' : 'compo'}`;
          inputRefs.current[nextKey]?.focus();
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (field === 'compo' && isSecondCycle) {
          const gradeKey = `${student.id}-${subject.subject_name}-grade`;
          inputRefs.current[gradeKey]?.focus();
        } else if (subjectIndex > 0) {
          const prevSubject = subjects[subjectIndex - 1];
          const prevKey = `${student.id}-${prevSubject.subject_name}-${isSecondCycle ? 'compo' : 'compo'}`;
          inputRefs.current[prevKey]?.focus();
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (studentIndex < filteredStudentsSaisie.length - 1) {
          setCurrentStudentIndex(studentIndex + 1);
          setTimeout(() => {
            const nextKey = `${filteredStudentsSaisie[studentIndex + 1].id}-${subjects[0]?.subject_name}-${isSecondCycle ? 'grade' : 'compo'}`;
            inputRefs.current[nextKey]?.focus();
          }, 0);
        }
        break;
    }
  };

  const scrollGrid = (direction: 'left' | 'right') => {
    if (!gridContainerRef.current) return;
    const scrollAmount = 400;
    const newPosition = direction === 'left' 
      ? Math.max(0, scrollPosition - scrollAmount)
      : scrollPosition + scrollAmount;
    gridContainerRef.current.scrollLeft = newPosition;
    setScrollPosition(newPosition);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* HEADER */}
      {!fullscreenMode && (
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                {loadingSchool ? (
                  <div className="bg-indigo-600 p-2 sm:p-2.5 rounded-lg text-white animate-pulse">
                    <BarChart3 size={20} className="sm:w-6 sm:h-6" />
                  </div>
                ) : school?.logo_url ? (
                  <img src={school.logo_url} alt="Logo" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="bg-indigo-600 p-2 sm:p-2.5 rounded-lg text-white">
                    <BarChart3 size={20} className="sm:w-6 sm:h-6" />
                  </div>
                )}
                <div className="hidden sm:block">
                  <h1 className="text-lg sm:text-xl font-black tracking-tight uppercase italic">
                    {loadingSchool ? (
                      <span className="text-gray-400">Chargement...</span>
                    ) : school?.name ? (
                      <>{school.name.toUpperCase()}</>
                    ) : (
                      <>KalanNyetaa <span className="text-indigo-600">ACADEMY</span></>
                    )}
                  </h1>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                    {isSecondCycle ? "Lycée" : "Fondamental"}
                  </p>
                </div>
                <div className="sm:hidden">
                  <h1 className="text-sm font-black uppercase">BULLETINS</h1>
                </div>
              </div>

              {/* TABS - Desktop */}
              <div className="hidden md:flex bg-slate-100 p-1 rounded-lg gap-1">
                {[
                  { id: 'config', icon: Settings, label: 'Config' },
                  { id: 'saisie', icon: PenTool, label: 'Saisie' },
                  { id: 'resultats', icon: Trophy, label: 'Bulletins' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold uppercase transition-all ${
                      tab === item.id
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-indigo-600'
                    }`}
                  >
                    <item.icon size={14} />
                    <span className="hidden sm:inline">{item.label}</span>
                  </button>
                ))}
              </div>

              {/* TABS - Mobile */}
              <div className="md:hidden">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
              <div className="md:hidden mt-3 flex gap-2 pb-2">
                {[
                  { id: 'config', icon: Settings, label: 'Config' },
                  { id: 'saisie', icon: PenTool, label: 'Saisie' },
                  { id: 'resultats', icon: Trophy, label: 'Bulletins' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setTab(item.id as any);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-md text-xs font-bold uppercase transition-all ${
                      tab === item.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <item.icon size={14} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>
      )}

      {/* MAIN CONTENT */}
      <main className={`${fullscreenMode ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6'}`}>
        {/* FILTERS */}
        {!fullscreenMode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-2">Classe</label>
              <select
                onChange={(e) => setSelectedClassId(e.target.value)}
                value={selectedClassId}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option value="">Sélectionner...</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-2">Période</label>
              <select
                onChange={(e) => setPeriod(e.target.value)}
                value={period}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
        )}

        {/* SEARCH BAR - Conditional */}
        {!fullscreenMode && (tab === 'saisie' || tab === 'resultats') && selectedClassId && (
          <div className="mb-6 bg-white p-3 sm:p-4 rounded-xl border border-indigo-200 shadow-sm">
            <label className="text-[10px] font-bold uppercase text-indigo-600 block mb-2">
              {tab === 'saisie' ? 'Rechercher un élève' : 'Rechercher un bulletin'}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={tab === 'saisie' ? searchSaisie : searchBulletins}
                onChange={(e) => tab === 'saisie' ? setSearchSaisie(e.target.value) : setSearchBulletins(e.target.value)}
                placeholder="Nom ou prénom..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        )}

        {/* TAB: CONFIGURATION */}
        {tab === 'config' && selectedClassId && (
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-lg">
            <h2 className="text-lg sm:text-xl font-bold uppercase mb-6 text-slate-900">Matières</h2>

            {/* Add Subject Form */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 pb-6 border-b border-slate-200">
              <input
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                type="text"
                placeholder="Nom de la matière"
                className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              <input
                value={newSubCoeff}
                onChange={(e) => setNewSubCoeff(e.target.value)}
                type="number"
                step="1"
                placeholder="Coefficient"
                className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              <button
                onClick={addSubject}
                className="bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 py-2.5"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Ajouter</span>
              </button>
            </div>

            {/* Subjects List */}
            <div className="space-y-2">
              {subjects.map(s => (
                <div key={s.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-indigo-300 transition-all">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{s.subject_name}</p>
                    <p className="text-xs text-indigo-600 font-bold">Coeff: {s.coefficient}</p>
                  </div>
                  <button
                    onClick={() => deleteSubject(s.id)}
                    className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: SAISIE NOTES */}
        {tab === 'saisie' && selectedClassId && (
          <div>
            {/* Fullscreen Toggle Button - Mobile Only */}
            <div className="md:hidden mb-4 flex gap-2">
              <button
                onClick={() => setFullscreenMode(!fullscreenMode)}
                className={`flex-1 py-2.5 rounded-lg font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 ${
                  fullscreenMode
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-white text-slate-900 border border-slate-200 shadow-sm'
                }`}
              >
                {fullscreenMode ? 'Mode Normal' : 'Mode Plein Écran'}
              </button>
            </div>

            {/* MOBILE: Cartes Uniques */}
            <div className="md:hidden space-y-4">
              {filteredStudentsSaisie.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center">
                  <p className="text-slate-500 font-bold">Aucun élève trouvé</p>
                </div>
              ) : (
                <>
                  {/* Indicateur de progression */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">
                      Élève {currentStudentIndex + 1} / {filteredStudentsSaisie.length}
                    </span>
                    <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-300"
                        style={{ width: `${((currentStudentIndex + 1) / filteredStudentsSaisie.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Carte de l'élève actuel */}
                  {filteredStudentsSaisie.map((student, studentIdx) => (
                    <div
                      key={student.id}
                      className={`transition-all duration-300 ${
                        studentIdx === currentStudentIndex ? 'block' : 'hidden'
                      }`}
                    >
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-lg">
                        {/* Header */}
                        <div className="mb-4 pb-4 border-b border-slate-200">
                          <h3 className="text-lg font-bold uppercase text-slate-900">
                            {student.first_name}
                          </h3>
                          <p className="text-sm text-slate-600">{student.last_name}</p>
                        </div>

                        {/* Notes */}
                        <div className="space-y-4 mb-6">
                          {subjects.map((sub, subIdx) => {
                            const grade = rawGrades.find(g => g.student_id === student.id && g.subject_name === sub.subject_name);
                            return (
                              <div key={sub.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <p className="text-xs font-bold text-slate-500 uppercase mb-3">
                                  {sub.subject_name}
                                </p>
                                <div className="flex gap-3 items-center">
                                  {isSecondCycle && (
                                    <div className="flex-1 relative">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                        Classe
                                      </label>
                                      <input
                                        ref={(el) => {
                                          if (el) inputRefs.current[`${student.id}-${sub.subject_name}-grade`] = el;
                                        }}
                                        type="number"
                                        step="0.25"
                                        max="20"
                                        defaultValue={grade?.grade_value || ''}
                                        onBlur={(e) => saveGrade(student.id, sub.subject_name, 'grade_value', e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, studentIdx, subIdx, 'grade')}
                                        className={`w-full h-12 bg-white border-2 text-center font-bold text-slate-700 rounded-lg text-lg shadow-inner focus:border-indigo-500 outline-none transition-all ${
                                          savedGrades.has(`${student.id}-${sub.subject_name}-grade_value`)
                                            ? 'border-green-500 bg-green-50'
                                            : 'border-slate-200'
                                        }`}
                                        placeholder="00"
                                      />
                                      {savedGrades.has(`${student.id}-${sub.subject_name}-grade_value`) && (
                                        <Check size={16} className="absolute top-8 right-2 text-green-600" />
                                      )}
                                    </div>
                                  )}
                                  <div className="flex-1 relative">
                                    <label className={`text-[10px] font-bold uppercase block mb-1 ${
                                      isSecondCycle ? 'text-indigo-500' : 'text-emerald-500'
                                    }`}>
                                      {isSecondCycle ? 'Compo' : 'Note'}
                                    </label>
                                    <input
                                      ref={(el) => {
                                        if (el) inputRefs.current[`${student.id}-${sub.subject_name}-compo`] = el;
                                      }}
                                      type="number"
                                      step="0.25"
                                      max={isSecondCycle ? "20" : "10"}
                                      defaultValue={grade?.compo_value || ''}
                                      onBlur={(e) => saveGrade(student.id, sub.subject_name, 'compo_value', e.target.value)}
                                      onKeyDown={(e) => handleKeyDown(e, studentIdx, subIdx, 'compo')}
                                      className={`w-full h-12 border-2 text-center font-bold rounded-lg text-lg shadow-inner outline-none transition-all ${
                                        isSecondCycle
                                          ? 'bg-indigo-50 border-indigo-200 text-indigo-600 focus:border-indigo-500'
                                          : 'bg-emerald-50 border-emerald-200 text-emerald-600 focus:border-emerald-500'
                                      } ${
                                        savedGrades.has(`${student.id}-${sub.subject_name}-compo_value`)
                                          ? 'border-green-500 bg-green-50'
                                          : ''
                                      }`}
                                      placeholder="00"
                                    />
                                    {savedGrades.has(`${student.id}-${sub.subject_name}-compo_value`) && (
                                      <Check size={16} className="absolute top-8 right-2 text-green-600" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex gap-3">
                          <button
                            onClick={() => setCurrentStudentIndex(Math.max(0, currentStudentIndex - 1))}
                            disabled={currentStudentIndex === 0}
                            className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-lg font-bold uppercase text-xs flex items-center justify-center gap-2 hover:bg-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronUp size={18} />
                            Précédent
                          </button>
                          <button
                            onClick={() => setCurrentStudentIndex(Math.min(filteredStudentsSaisie.length - 1, currentStudentIndex + 1))}
                            disabled={currentStudentIndex === filteredStudentsSaisie.length - 1}
                            className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold uppercase text-xs flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Suivant
                            <ChevronDown size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* DESKTOP: Grille de Cartes (4 par ligne) */}
            <div className="hidden md:block">
              {filteredStudentsSaisie.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center">
                  <p className="text-slate-500 font-bold">Aucun élève trouvé</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Navigation Buttons */}
                  <div className="flex gap-3 justify-between items-center">
                    <button
                      onClick={() => scrollGrid('left')}
                      className="p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-bold text-sm"
                    >
                      <ChevronLeft size={20} />
                      Précédent
                    </button>
                    <span className="text-sm font-bold text-slate-600">
                      {filteredStudentsSaisie.length} élève{filteredStudentsSaisie.length > 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => scrollGrid('right')}
                      className="p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-bold text-sm"
                    >
                      Suivant
                      <ChevronRight size={20} />
                    </button>
                  </div>

                  {/* Grille de Cartes avec Scroll Horizontal */}
                  <div
                    ref={gridContainerRef}
                    className="overflow-x-auto pb-4 scroll-smooth"
                    style={{ scrollBehavior: 'smooth' }}
                  >
                    <div className="grid gap-4 min-w-max" style={{ gridTemplateColumns: 'repeat(4, minmax(280px, 1fr))' }}>
                      {filteredStudentsSaisie.map((student, studentIdx) => (
                        <div
                          key={student.id}
                          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-lg hover:shadow-xl transition-all"
                        >
                          {/* Header */}
                          <div className="mb-4 pb-3 border-b border-slate-200">
                            <h3 className="text-sm font-bold uppercase text-slate-900 truncate">
                              {student.first_name}
                            </h3>
                            <p className="text-xs text-slate-600 truncate">{student.last_name}</p>
                          </div>

                          {/* Notes */}
                          <div className="space-y-3 mb-4 max-h-[350px] overflow-y-auto">
                            {subjects.map((sub, subIdx) => {
                              const grade = rawGrades.find(g => g.student_id === student.id && g.subject_name === sub.subject_name);
                              return (
                                <div key={sub.id} className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-2 truncate">
                                    {sub.subject_name}
                                  </p>
                                  <div className="flex gap-2 items-center">
                                    {isSecondCycle && (
                                      <div className="flex-1 relative">
                                        <input
                                          ref={(el) => {
                                            if (el) inputRefs.current[`${student.id}-${sub.subject_name}-grade`] = el;
                                          }}
                                          type="number"
                                          step="0.25"
                                          max="20"
                                          defaultValue={grade?.grade_value || ''}
                                          onBlur={(e) => saveGrade(student.id, sub.subject_name, 'grade_value', e.target.value)}
                                          onKeyDown={(e) => handleKeyDown(e, studentIdx, subIdx, 'grade')}
                                          className={`w-full h-9 bg-white border-2 text-center font-bold text-slate-700 rounded-lg text-sm shadow-inner focus:border-indigo-500 outline-none transition-all ${
                                            savedGrades.has(`${student.id}-${sub.subject_name}-grade_value`)
                                              ? 'border-green-500 bg-green-50'
                                              : 'border-slate-200'
                                          }`}
                                          placeholder="00"
                                        />
                                        {savedGrades.has(`${student.id}-${sub.subject_name}-grade_value`) && (
                                          <Check size={12} className="absolute top-2 right-1 text-green-600" />
                                        )}
                                      </div>
                                    )}
                                    <div className="flex-1 relative">
                                      <input
                                        ref={(el) => {
                                          if (el) inputRefs.current[`${student.id}-${sub.subject_name}-compo`] = el;
                                        }}
                                        type="number"
                                        step="0.25"
                                        max={isSecondCycle ? "20" : "10"}
                                        defaultValue={grade?.compo_value || ''}
                                        onBlur={(e) => saveGrade(student.id, sub.subject_name, 'compo_value', e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, studentIdx, subIdx, 'compo')}
                                        className={`w-full h-9 border-2 text-center font-bold rounded-lg text-sm shadow-inner outline-none transition-all ${
                                          isSecondCycle
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-600 focus:border-indigo-500'
                                            : 'bg-emerald-50 border-emerald-200 text-emerald-600 focus:border-emerald-500'
                                        } ${
                                          savedGrades.has(`${student.id}-${sub.subject_name}-compo_value`)
                                            ? 'border-green-500 bg-green-50'
                                            : ''
                                        }`}
                                        placeholder="00"
                                      />
                                      {savedGrades.has(`${student.id}-${sub.subject_name}-compo_value`) && (
                                        <Check size={12} className="absolute top-2 right-1 text-green-600" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: RESULTATS */}
        {tab === 'resultats' && selectedClassId && (
          <div className="space-y-6">
            {/* Export Button */}
            <button
              onClick={downloadAllInOnePDF}
              disabled={loading || bulletinData.length === 0}
              className="w-full bg-slate-900 text-white py-3 sm:py-4 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={20} />
              {loading ? 'Création du PDF...' : 'Exporter tous les bulletins'}
            </button>

            {/* Bulletins Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bulletinData.map((s) => (
                <div key={s.id} className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-lg hover:shadow-xl transition-all">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-200">
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold uppercase text-slate-900">
                        {s.first_name}
                      </h3>
                      <p className="text-sm text-slate-600">{s.last_name}</p>
                    </div>
                    <div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                      Rang: {s.rang}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-indigo-600 p-3 sm:p-4 rounded-xl text-center text-white">
                      <p className="text-[10px] font-bold uppercase opacity-70">Moyenne</p>
                      <p className="text-2xl sm:text-3xl font-black">
                        {s.moyenne}
                        <span className="text-xs opacity-75 ml-1">/{isSecondCycle ? 20 : 10}</span>
                      </p>
                    </div>
                    <div className={`p-3 sm:p-4 rounded-xl text-center font-bold text-sm uppercase ${
                      s.moyenne >= (isSecondCycle ? 10 : 5)
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      <p className="text-[10px] font-bold opacity-70">Mention</p>
                      <p>{getMention(s.moyenne)}</p>
                    </div>
                  </div>

                  {/* Notes Preview */}
                  <div className="mb-4 max-h-[150px] overflow-y-auto space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Notes:</p>
                    {s.notes.map((n: any) => (
                      <div key={n.name} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                        <span className="font-bold text-slate-700 truncate">{n.name}</span>
                        <span className="font-bold text-indigo-600 bg-white px-2 py-1 rounded border border-slate-200">
                          {n.moyenneMatiere}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Download Button */}
                  <button
                    onClick={() => downloadPDF(s)}
                    className="w-full py-2.5 sm:py-3 bg-indigo-600 text-white rounded-lg font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 hover:bg-slate-900 transition-all shadow-md"
                  >
                    <FileText size={16} />
                    Générer Bulletin
                  </button>

                  {/* Hidden PDF Template */}
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
      </main>
    </div>
  );
}
