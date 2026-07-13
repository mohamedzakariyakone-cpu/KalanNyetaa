'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, type ChangeEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { offlineWrite } from '@/utils/offlineApi';
import { getLocalCache, setLocalCache } from '@/utils/offlineStorage';
import { useYear } from '@/context/YearContext';
import { useCacheRefresh } from '@/hooks/useCacheRefresh';
import {
  Search, Loader2, Phone, X, Trash2, Plus, Lock,
  AlertCircle, DollarSign, Award, GraduationCap, ArrowLeft, FileDown
} from 'lucide-react';
import NumericInput from '@/components/NumericInput';


export default function StudentsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
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
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', classId: classFilter || '', annualFee: '',
    parentPhone: '', address: '', birthDate: '', lastExamAvg: '0'
  });

  const { selectedYearId, selectedYear, years, isReadOnly, isLoading: yearLoading } = useYear();

  // Mémorisation du scroll position
  useEffect(() => {
    const scrollKey = `scroll_position_${classFilter || 'all'}`;
    const savedPosition = sessionStorage.getItem(scrollKey);
    if (savedPosition && !loading) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedPosition));
      }, 100);
    }
  }, [loading, classFilter]);

  const saveScrollPosition = useCallback(() => {
    const scrollKey = `scroll_position_${classFilter || 'all'}`;
    sessionStorage.setItem(scrollKey, String(window.scrollY));
  }, [classFilter]);

  useEffect(() => {
    window.addEventListener('scroll', saveScrollPosition);
    return () => window.removeEventListener('scroll', saveScrollPosition);
  }, [saveScrollPosition]);

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

  const CACHE_TTL_SECONDS = 60

  const fetchNextYearClasses = useCallback(async () => {
    if (!nextAcademicYear) {
      setNextYearClasses([]);
      return;
    }

    const cacheKey = `next_classes_${nextAcademicYear.id}`;
    const cachedData = await getLocalCache<ClassRecord[]>(cacheKey);
    if (cachedData) {
      setNextYearClasses(cachedData);
    }

    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('academic_year_id', nextAcademicYear.id)
      .order('name');

    if (error) {
      console.error('Erreur lors de la récupération des prochaines classes :', error.message);
      if (!cachedData) setNextYearClasses([]);
      return;
    }

    setNextYearClasses(data || []);
    await setLocalCache(cacheKey, data || []);
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
    
    const cacheKey = `students_data_${selectedYearId}_${classFilter || 'all'}`;
    
    try {
      const cached = await getLocalCache<{ students: StudentRecord[]; classes: ClassRecord[]; currentClassInfo: ClassRecord | null }>(cacheKey);
      if (cached) {
        setStudents(cached.students || []);
        setClasses(cached.classes || []);
        setCurrentClassInfo(cached.currentClassInfo || null);
        setLoading(false);
      } else {
        setLoading(true);
      }

      let query = supabase.from('students').select('*, classes(name)').eq('academic_year_id', selectedYearId);
      if (classFilter) query = query.eq('class_id', classFilter);
      const { data: stData } = await query.order('first_name', { ascending: true });

      const { data: clData } = await supabase.from('classes').select('*').eq('academic_year_id', selectedYearId).order('name');
      
      let computedClassInfo = null;
      if (classFilter && clData) {
        const current = clData.find((c: ClassRecord) => String(c.id) === classFilter);
        computedClassInfo = current || null;
      }

      const freshStudents = stData || [];
      const freshClasses = clData || [];

      setStudents(freshStudents);
      setClasses(freshClasses);
      setCurrentClassInfo(computedClassInfo);
      
      await setLocalCache(cacheKey, {
        students: freshStudents,
        classes: freshClasses,
        currentClassInfo: computedClassInfo
      }, { expiresIn: CACHE_TTL_SECONDS });

    } catch (error: unknown) {
      console.error('Erreur de synchronisation :', error);
    } finally {
      setLoading(false);
    }
  }, [classFilter, selectedYearId]);

  const cacheKey = `students_data_${selectedYearId}_${classFilter || 'all'}`;
  useCacheRefresh({
    cacheKeys: [cacheKey],
    cachePattern: /^students_data_/,
    onInvalidate: fetchData,
    debounceMs: 150,
    refreshOnFocus: true,
    refreshOnVisibilityChange: true,
    refreshIntervalMs: 120000,
  });

  useEffect(() => {
    const handleGlobalSyncSuccess = () => {
      fetchData()
    }

    window.addEventListener('global-sync-success', handleGlobalSyncSuccess)
    return () => window.removeEventListener('global-sync-success', handleGlobalSyncSuccess)
  }, [fetchData])

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
    if (!formData.classId || isReadOnly || !selectedYearId) return;
    setIsSubmitting(true);
    const feeValue = parseFloat(formData.annualFee || '0');

    const { error } = await offlineWrite({
      table: 'students',
      action: 'INSERT',
      payload: [{
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
        academic_year_id: selectedYearId,
      }],
      cacheKey,
      optimisticUpdate: () => {
        setStudents((prev) => [
          {
            id: `offline-${Date.now()}`,
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
            academic_year_id: selectedYearId,
          },
          ...prev,
        ]);
      },
    });

    if (!error) {
      setFormData({ firstName: '', lastName: '', classId: classFilter || '', annualFee: '', parentPhone: '', address: '', birthDate: '', lastExamAvg: '0' });
      setShowMobileForm(false);
      await fetchData();
    }
    setIsSubmitting(false);
  };

  const handleDeleteStudent = async (id: string) => {
    if (isReadOnly) return;

    const { error } = await offlineWrite({
      table: 'students',
      action: 'DELETE',
      payload: {},
      options: { keyColumn: 'id', keyValue: id },
      cacheKey,
      optimisticUpdate: () => {
        setStudents((prev) => prev.filter((student) => String(student.id) !== id));
      },
    });

    if (!error) {
      setConfirmDeleteId(null);
      await fetchData();
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
      alert("Sélectionnez d'abord une classe cible pour l'année suivante.");
      return;
    }

    const nextClass = nextYearClasses.find((c) => String(c.id) === targetNextClassId);
    if (!nextClass) {
      alert("Classe cible introuvable pour l'année suivante. Veuillez sélectionner une autre classe.");
      return;
    }

    setIsReenrolling(true);
    const selectedStudents = students.filter((student) => selectedStudentIds.includes(String(student.id)));
    const newStudents = selectedStudents.map((s) => ({
      first_name: s.first_name,
      last_name: s.last_name,
      class_id: targetNextClassId,
      annual_fee: s.scolarite_totale || s.annual_fee || 0,
      scolarite_totale: s.scolarite_totale || s.annual_fee || 0,
      scolarite_payee: 0,
      parent_phone: s.parent_phone || null,
      address: s.address || null,
      birth_date: s.birth_date || null,
      last_exam_avg: s.last_exam_avg || 0,
      academic_year_id: nextAcademicYear.id,
    }));

    const { error } = await offlineWrite({
      table: 'students',
      action: 'INSERT',
      payload: newStudents,
      cacheKey: `students_data_${nextAcademicYear.id}_${targetNextClassId}`,
      optimisticUpdate: () => {},
    });

    if (!error) {
      alert(`${selectedStudentIds.length} élève(s) réinscrit(s) avec succès pour l'année ${nextAcademicYear.label}.`);
      setIsSelectionMode(false);
      setSelectedStudentIds([]);
      setSelectAll(false);
      await fetchData();
    } else {
      alert('Erreur lors de la réinscription. Veuillez réessayer.');
    }
    setIsReenrolling(false);
  };

  const generatePdf = async (includeFinancial: boolean) => {
    try {
      setIsExporting(true);
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;
      let cursorY = margin;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('REGISTRE DES ÉLÈVES', margin, cursorY);
      cursorY += 8;

      if (classFilter && currentClassInfo?.name) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text(`Classe : ${currentClassInfo.name}`, margin, cursorY);
        cursorY += 6;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, margin, cursorY);
      cursorY += 10;

      const statBoxes = [
        { label: 'EFFECTIF', value: `${stats.total} élèves`, color: [15, 23, 42] },
        { label: 'RECOUVRÉ', value: `${stats.totalPaid.toLocaleString()} FCFA`, color: [5, 150, 105] },
        { label: 'RESTANT DÛ', value: `${stats.totalDue.toLocaleString()} FCFA`, color: [225, 29, 72] },
        { label: 'MOYENNE GÉNÉRALE', value: `${stats.generalAvg.toFixed(2)} / 20`, color: [79, 70, 229] },
      ];

      const boxGap = 4;
      const boxWidth = (pageWidth - margin * 2 - boxGap * (statBoxes.length - 1)) / statBoxes.length;
      const boxHeight = 16;

      statBoxes.forEach((box, i) => {
        const x = margin + i * (boxWidth + boxGap);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, cursorY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(box.label, x + 4, cursorY + 5.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11.5);
        doc.setTextColor(box.color[0], box.color[1], box.color[2]);
        doc.text(box.value, x + 4, cursorY + 12.5);
      });

      cursorY += boxHeight + 8;

      const head = includeFinancial
        ? [['#', 'Prénom & Nom', 'Classe', 'Contact Parent', 'Frais (FCFA)', 'Payé (FCFA)', 'Restant (FCFA)', 'Moyenne']]
        : [['#', 'Prénom & Nom', 'Classe', 'Contact Parent', 'Moyenne']];

      const body = filteredStudents.map((s: StudentRecord, idx: number) => {
        const totalFee = Number(s.scolarite_totale || s.annual_fee || 0);
        const paidFee = Number(s.scolarite_payee || 0);
        const due = totalFee - paidFee;
        const examAvg = Number(s.last_exam_avg ?? 0);
        const fullName = `${s.first_name || ''} ${(s.last_name || '').toUpperCase()}`.trim();
        const className = s.classes?.name || 'Inconnu';
        const phone = s.parent_phone || '-';
        const avgStr = `${examAvg.toFixed(2)}/20`;

        return includeFinancial
          ? [String(idx + 1), fullName, className, phone, totalFee.toLocaleString('fr-FR'), paidFee.toLocaleString('fr-FR'), due.toLocaleString('fr-FR'), avgStr]
          : [String(idx + 1), fullName, className, phone, avgStr];
      });

      autoTable(doc, {
        head,
        body,
        startY: cursorY,
        margin: { left: margin, right: margin, bottom: 16 },
        theme: 'grid',
        styles: {
          fontSize: 8.5,
          cellPadding: 2.2,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'left',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: includeFinancial
          ? {
              0: { halign: 'center', cellWidth: 8 },
              1: { fontStyle: 'bold' },
              4: { halign: 'right' },
              5: { halign: 'right', textColor: [5, 150, 105] },
              6: { halign: 'right', textColor: [225, 29, 72] },
              7: { halign: 'center', fontStyle: 'bold' },
            }
          : {
              0: { halign: 'center', cellWidth: 8 },
              1: { fontStyle: 'bold' },
              4: { halign: 'center', fontStyle: 'bold' },
            },
        didParseCell: (data) => {
          const avgColIndex = includeFinancial ? 7 : 4;
          if (data.section === 'body' && data.column.index === avgColIndex) {
            const raw = String(data.cell.raw || '');
            const value = parseFloat(raw.replace('/20', ''));
            if (!isNaN(value)) {
              data.cell.styles.textColor = value >= 10 ? [79, 70, 229] : [225, 29, 72];
            }
          }
        },
        didDrawPage: (data: { pageNumber: number }) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Page ${data.pageNumber} / ${pageCount}`,
            pageWidth - margin,
            pageHeight - 7,
            { align: 'right' }
          );
          doc.text(
            'Document généré automatiquement — Kalan Nyetaa',
            margin,
            pageHeight - 7
          );
        },
      });

      const fileSuffix = includeFinancial ? 'complet' : 'simplifie';
      const classSuffix = classFilter && currentClassInfo?.name ? `_${currentClassInfo.name}` : '';
      doc.save(`registre_eleves${classSuffix}_${fileSuffix}.pdf`);
    } catch (error) {
      console.error('Erreur lors de la génération du PDF :', error);
      alert('Une erreur est survenue lors de la génération du PDF.');
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
    }
  };

  const goToStudentDetail = (studentId: string | number) => {
    saveScrollPosition();
    router.push(`/students/${studentId}`);
  };

  if (yearLoading) {
    return (
      <div className="flex items-center justify-center p-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl text-slate-600 font-bold gap-3 border-2 border-indigo-200">
        <Loader2 className="animate-spin text-indigo-600" size={24} />
        <span className="text-sm">Chargement de la configuration d&apos;année...</span>
      </div>
    );
  }

  if (!selectedYearId) {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 p-8 rounded-3xl text-center text-amber-800 max-w-sm mx-auto mt-10 shadow-md">
        <AlertCircle size={40} className="mx-auto mb-4 text-amber-600 font-bold" />
        <h2 className="text-base font-black mb-2 uppercase tracking-tight">Session scolaire manquante</h2>
        <p className="text-xs font-bold opacity-85">Activez une année scolaire pour manipuler les dossiers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-10 max-w-7xl mx-auto px-0 sm:px-6 w-full overflow-x-hidden print:p-0 print:bg-white bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 px-3 sm:px-0 print:mb-6">
        <div>
          {classFilter && (
            <button 
              onClick={() => { router.push('/students'); setCurrentClassInfo(null); }}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 mb-2 transition-all active:scale-95 print:hidden"
            >
              <ArrowLeft size={15} className="font-bold" /> Voir toutes les classes
            </button>
          )}
          <div className="flex items-center gap-2 mb-1">
            <span className={`h-2 w-2 rounded-full shrink-0 font-bold ${classFilter ? 'bg-indigo-600' : 'bg-emerald-600'}`} />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {classFilter ? `Profil Classe Active` : `Registre Général`}
            </p>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight uppercase wrap-break-word">
            {classFilter && currentClassInfo ? `Classe : ${currentClassInfo.name}` : 'Registre des Élèves'}
          </h1>
        </div>
        
        {/* Actions d'entête responsives */}
        <div className="flex items-center justify-between sm:justify-end gap-2 print:hidden">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl font-black text-xs shadow-lg hover:shadow-xl active:scale-95 transition-all flex-1 sm:flex-none"
          >
            <FileDown size={16} className="font-bold" />
            <span>Exporter PDF</span>
          </button>

          <button 
            onClick={() => setShowMobileForm(!showMobileForm)}
            className="md:hidden h-10 w-10 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl active:scale-95 transition-all font-bold"
          >
            {showMobileForm ? <X size={20} /> : <Plus size={20} />}
          </button>
        </div>
      </div>

      {isReadOnly && (
        <div className="mx-3 sm:mx-0 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-800 print:hidden shadow-md">
          <Lock size={16} className="shrink-0 font-bold" />
          <p className="text-xs sm:text-sm font-bold">Mode consultation active. Les modifications sont bloquées.</p>
        </div>
      )}

      {/* BLOCS STATISTIQUES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 px-3 sm:px-0">
        <div className="bg-gradient-to-br from-white to-slate-50 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-slate-200 shadow-md hover:shadow-lg transition-all">
          <div className="p-2.5 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl text-slate-900 shrink-0 w-fit mb-3 font-bold">
            <GraduationCap size={20} />
          </div>
          <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">Effectif</p>
          <p className="text-lg sm:text-2xl font-black text-slate-900 leading-tight">{stats.total} <span className="text-xs font-bold text-slate-400">élèves</span></p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-emerald-200 shadow-md hover:shadow-lg transition-all">
          <div className="p-2.5 bg-gradient-to-br from-emerald-200 to-green-300 rounded-xl text-emerald-700 shrink-0 w-fit mb-3 font-bold">
            <DollarSign size={20} />
          </div>
          <p className="text-[9px] sm:text-[10px] font-black text-emerald-600 uppercase tracking-wide mb-1">Recouvré</p>
          <p className="text-lg sm:text-2xl font-black text-emerald-700 leading-tight">{stats.totalPaid.toLocaleString()} <span className="text-xs font-bold text-emerald-500">FCFA</span></p>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-red-50 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-rose-200 shadow-md hover:shadow-lg transition-all">
          <div className="p-2.5 bg-gradient-to-br from-rose-200 to-red-300 rounded-xl text-rose-700 shrink-0 w-fit mb-3 font-bold">
            <AlertCircle size={20} />
          </div>
          <p className="text-[9px] sm:text-[10px] font-black text-rose-600 uppercase tracking-wide mb-1">Restant dû</p>
          <p className="text-lg sm:text-2xl font-black text-rose-700 leading-tight">{stats.totalDue.toLocaleString()} <span className="text-xs font-bold text-rose-500">FCFA</span></p>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-indigo-200 shadow-md hover:shadow-lg transition-all">
          <div className="p-2.5 bg-gradient-to-br from-indigo-300 to-blue-400 rounded-xl text-indigo-700 shrink-0 w-fit mb-3 font-bold">
            <Award size={20} />
          </div>
          <p className="text-[9px] sm:text-[10px] font-black text-indigo-600 uppercase tracking-wide mb-1">Moyenne</p>
          <p className="text-lg sm:text-2xl font-black text-indigo-700 leading-tight">
            {stats.generalAvg.toFixed(2)}<span className="text-xs font-bold text-indigo-500">/20</span>
          </p>
        </div>
      </div>

      {/* FILTRES AVANCÉS */}
      <div className="mx-3 sm:mx-0 bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-slate-200 shadow-md space-y-3 print:hidden">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Barre de Recherche */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold" />
            <input
              type="text"
              placeholder="Chercher par nom..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl outline-none font-bold text-sm text-slate-800 border-2 border-slate-200 focus:border-indigo-400 focus:bg-white transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Menus Déroulants Filtres */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            <select 
              className="p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-xs text-slate-700 outline-none cursor-pointer w-full focus:border-indigo-400 transition-all"
              value={financialFilter}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setFinancialFilter(e.target.value as 'all' | 'paid' | 'debtor')}
            >
              <option value="all">Scolarité (Tous)</option>
              <option value="paid">En règle</option>
              <option value="debtor">En dette</option>
            </select>

            <select 
              className="p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-xs text-slate-700 outline-none cursor-pointer w-full focus:border-indigo-400 transition-all"
              value={academicFilter}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setAcademicFilter(e.target.value as 'all' | 'passed' | 'failed')}
            >
              <option value="all">Résultats (Tous)</option>
              <option value="passed">Moyenne ≥ 10</option>
              <option value="failed">Moyenne &lt; 10</option>
            </select>

            {!classFilter && (
              <select 
                className="p-3 bg-gradient-to-r from-indigo-100 to-blue-100 border-2 border-indigo-300 rounded-xl font-black text-xs text-indigo-700 outline-none cursor-pointer col-span-2 sm:col-span-1 w-full focus:border-indigo-500 transition-all"
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
              className="w-full py-3 px-4 rounded-2xl border-2 border-slate-300 bg-white text-slate-800 text-xs font-black uppercase hover:bg-slate-50 hover:border-indigo-400 transition-all print:hidden shadow-md active:scale-95"
            >
              Ouverture des réinscriptions
            </button>
          ) : (
            <div className="bg-white p-5 sm:p-6 rounded-3xl border-2 border-slate-200 shadow-md space-y-4 print:hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 uppercase">Réinscription</h3>
                    <button 
                      onClick={() => { 
                        setShowReenrollmentSection(false);
                        setIsSelectionMode(false); 
                        setSelectedStudentIds([]); 
                        setSelectAll(false); 
                      }}
                      className="text-slate-400 hover:text-slate-600 sm:hidden font-bold"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <p className="text-xs font-bold text-slate-600 mt-2">
                    {isSelectionMode
                      ? 'Sélectionnez les élèves, choisissez la classe cible et lancez la réinscription.'
                      : "Activez la réinscription pour sélectionner des élèves et choisir leur classe de l'année suivante."
                    }
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSelectionMode}
                    type="button"
                    className="px-4 py-2.5 rounded-xl border-2 border-slate-300 text-slate-700 text-xs font-black uppercase hover:bg-slate-50 transition-all active:scale-95"
                  >
                    {isSelectionMode ? 'Annuler réinscription' : 'Activer réinscription'}
                  </button>
                  {isSelectionMode && (
                    <button
                      onClick={reEnrollSelectedStudents}
                      type="button"
                      disabled={isReenrolling || selectedStudentIds.length === 0 || !nextAcademicYear || isReadOnly || !targetNextClassId}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-95 transition-all shadow-md"
                    >
                      {isReenrolling ? 'En cours...' : `Réinscrire ${selectedStudentIds.length} élève(s)`}
                    </button>
                  )}
                </div>
              </div>

              {!nextAcademicYear ? (
                <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 p-3.5 text-amber-800 text-xs font-bold">
                  Aucune année scolaire suivante configurée pour la réinscription. Ajoutez une année dans les paramètres.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[9px] font-black uppercase text-slate-500">Année suivante</label>
                    <p className="text-sm font-black text-slate-800 bg-slate-50 p-3 rounded-xl border-2 border-slate-200">{nextAcademicYear.label}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[9px] font-black uppercase text-slate-500">Classe cible</label>
                    <select
                      value={targetNextClassId}
                      onChange={(e) => setTargetNextClassId(e.target.value)}
                      disabled={!isSelectionMode}
                      className="w-full p-3 bg-slate-50 rounded-xl border-2 border-slate-200 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 transition-all"
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
                <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 p-3.5 text-amber-800 text-xs font-bold">
                  Aucune classe configurée pour l'année {nextAcademicYear.label}. Créez d'abord les classes pour réinscrire les élèves.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* FORMULAIRE */}
      <div className={`${showMobileForm ? 'block mx-3' : 'hidden md:block'} bg-white p-5 sm:p-6 rounded-3xl border-2 border-slate-200 shadow-md print:hidden`}>
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-5">Nouvelle Inscription</h2>
        <form onSubmit={addStudent} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-500">Prénom</label>
              <input 
                type="text" 
                placeholder="Moussa" 
                className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none font-bold text-xs text-slate-800 focus:border-indigo-400 focus:bg-white transition-all"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                disabled={isReadOnly}
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-500">Nom</label>
              <input 
                type="text" 
                placeholder="Diarra" 
                className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none font-bold text-xs text-slate-800 focus:border-indigo-400 focus:bg-white transition-all"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                disabled={isReadOnly}
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-500">Naissance</label>
              <input 
                type="date" 
                className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none font-bold text-xs text-slate-600 focus:border-indigo-400 focus:bg-white transition-all"
                value={formData.birthDate}
                onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-500">Classe</label>
              <select 
                className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none font-bold text-xs text-slate-800 focus:border-indigo-400 focus:bg-white transition-all"
                value={formData.classId}
                onChange={(e) => setFormData({...formData, classId: e.target.value})}
                disabled={isReadOnly || !!classFilter}
                required 
              >
                <option value="">Sélectionner...</option>
                {classes.map((c: ClassRecord) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-500">Téléphone Parent</label>
              <input 
                type="text" 
                placeholder="70000000" 
                className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none font-bold text-xs text-slate-800 focus:border-indigo-400 focus:bg-white transition-all"
                value={formData.parentPhone}
                onChange={(e) => setFormData({...formData, parentPhone: e.target.value})}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-500">Adresse</label>
              <input 
                type="text" 
                placeholder="Quartier..." 
                className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none font-bold text-xs text-slate-800 focus:border-indigo-400 focus:bg-white transition-all"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-500">Frais Annuels (FCFA)</label>
              <NumericInput 
                placeholder="Montant total..." 
                className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none font-bold text-slate-900 text-xs focus:border-indigo-400 focus:bg-white transition-all"
                value={formData.annualFee === '' ? undefined : Number(formData.annualFee)}
                onChange={(v) => setFormData({...formData, annualFee: v === undefined ? '' : String(v)})}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting || isReadOnly}
            className="w-full md:w-auto bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wide shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Valider l\'inscription'}
          </button>
        </form>
      </div>

      {/* AFFICHAGE ÉCRANS LARGES */}
      <div className="hidden md:block bg-white rounded-3xl border-2 border-slate-200 shadow-md overflow-hidden print:border-0 print:shadow-none">
        <div className="w-full overflow-x-auto no-scrollbar">
          <table className="w-full text-left min-w-187.5 print:min-w-full">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100 text-[10px] uppercase font-black tracking-widest text-slate-600 border-b-2 border-slate-200 print:bg-slate-100">
              <tr>
                {classFilter && isSelectionMode && (
                  <th className="px-4 py-4 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectAll} 
                      onChange={toggleSelectAll} 
                      className="h-4 w-4 rounded border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                    />
                  </th>
                )}
                <th className="px-6 py-4">Prénom & Nom</th>
                <th className="px-4 py-4">Classe</th>
                <th className="px-4 py-4 text-center">Contact Parent</th>
                <th className="px-4 py-4 text-right">Frais d&apos;Études</th>
                <th className="px-4 py-4 text-right">Payé (FCFA)</th>
                <th className="px-4 py-4 text-center">Moyenne</th>
                <th className="px-6 py-4 text-right print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-indigo-600" size={22} /></td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-xs font-bold text-slate-500">Aucun élève trouvé.</td></tr>
              ) : filteredStudents.map((s: StudentRecord) => {
                const totalFee = Number(s.scolarite_totale || s.annual_fee || 0);
                const paidFee = Number(s.scolarite_payee || 0);
                const examAvg = Number(s.last_exam_avg ?? 0);
                const isSettled = paidFee >= totalFee && totalFee > 0;

                return (
                  <tr 
                    key={s.id} 
                    onClick={() => goToStudentDetail(s.id)}
                    className="hover:bg-indigo-50/50 transition-colors print:break-inside-avoid cursor-pointer active:bg-slate-100"
                  >
                    {classFilter && isSelectionMode && (
                      <td 
                        className="px-4 py-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedStudentIds.includes(String(s.id))} 
                          onChange={() => toggleStudentSelection(String(s.id))} 
                          className="h-4 w-4 rounded border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center font-black text-xs uppercase shrink-0 shadow-md print:border-2 print:border-slate-300">
                          {s.first_name?.[0]}{s.last_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 text-sm truncate uppercase">{s.first_name} <span className="font-bold text-slate-700">{s.last_name}</span></p>
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{s.classes?.name || 'Inconnu'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-slate-700">
                      {s.classes?.name || 'Inconnu'}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-600 text-xs whitespace-nowrap">
                      {s.parent_phone || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-4 text-right font-black text-slate-900 text-sm">
                      {totalFee.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right whitespace-nowrap">
                      <span className={`inline-block px-3 py-1.5 rounded-lg font-bold text-xs ${isSettled ? 'bg-emerald-100 text-emerald-800' : paidFee > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                        {paidFee.toLocaleString()} FCFA
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`font-black text-sm ${examAvg >= 10 ? 'text-indigo-700' : 'text-rose-700'}`}>
                        {examAvg.toFixed(2)}
                      </span>
                    </td>
                    <td 
                      className="px-6 py-4 text-right print:hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2">
                        {!isReadOnly && (
                          <button
                            onClick={() => setConfirmDeleteId(String(s.id))}
                            className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all font-bold active:scale-90"
                            title="Radier l'élève"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AFFICHAGE MOBILE */}
      <div className="md:hidden space-y-3 px-3 sm:px-0">
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-indigo-600" size={24} /></div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-xs font-bold text-slate-500 bg-white rounded-2xl border-2 border-slate-200">Aucun élève trouvé.</div>
        ) : filteredStudents.map((s: StudentRecord) => {
          const totalFee = Number(s.scolarite_totale || s.annual_fee || 0);
          const paidFee = Number(s.scolarite_payee || 0);
          const examAvg = Number(s.last_exam_avg ?? 0);
          const isSettled = paidFee >= totalFee && totalFee > 0;

          return (
            <div 
              key={s.id} 
              onClick={() => goToStudentDetail(s.id)}
              className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-md space-y-3 cursor-pointer active:bg-slate-50 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {classFilter && isSelectionMode && (
                    <input 
                      type="checkbox" 
                      checked={selectedStudentIds.includes(String(s.id))} 
                      onChange={() => toggleStudentSelection(String(s.id))} 
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 w-5 rounded border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0" 
                    />
                  )}
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center font-black text-xs uppercase shrink-0 shadow-md">
                    {s.first_name?.[0]}{s.last_name?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 text-sm uppercase truncate">{s.first_name} <span className="font-bold text-slate-700">{s.last_name}</span></p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight mt-0.5">{s.classes?.name || 'Inconnu'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {s.parent_phone && (
                    <a 
                      href={`tel:${s.parent_phone}`} 
                      className="h-10 w-10 bg-gradient-to-br from-emerald-400 to-green-500 text-white rounded-xl flex items-center justify-center border-2 border-emerald-300 shadow-md hover:shadow-lg active:scale-90 transition-all font-bold"
                      title="Appeler"
                    >
                      <Phone size={18} />
                    </a>
                  )}
                  {!isReadOnly && (
                    <button 
                      onClick={() => setConfirmDeleteId(String(s.id))} 
                      className="h-10 w-10 bg-gradient-to-br from-rose-400 to-red-500 text-white rounded-xl flex items-center justify-center border-2 border-rose-300 shadow-md hover:shadow-lg active:scale-90 transition-all font-bold"
                      title="Supprimer"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t-2 border-slate-100 text-center">
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-2.5 rounded-lg border border-slate-200">
                  <p className="text-[8px] font-black text-slate-600 uppercase">Scolarité</p>
                  <p className="text-xs font-black text-slate-900 mt-1">{totalFee.toLocaleString()}</p>
                </div>
                <div className={`bg-gradient-to-br p-2.5 rounded-lg border-2 ${isSettled ? 'from-emerald-100 to-green-100 border-emerald-300' : paidFee > 0 ? 'from-amber-100 to-orange-100 border-amber-300' : 'from-slate-100 to-slate-200 border-slate-300'}`}>
                  <p className="text-[8px] font-black text-slate-600 uppercase">Payé</p>
                  <p className={`text-xs font-black mt-1 ${isSettled ? 'text-emerald-800' : paidFee > 0 ? 'text-amber-800' : 'text-slate-700'}`}>{paidFee.toLocaleString()}</p>
                </div>
                <div className={`bg-gradient-to-br p-2.5 rounded-lg border-2 ${examAvg >= 10 ? 'from-indigo-100 to-blue-100 border-indigo-300' : 'from-rose-100 to-red-100 border-rose-300'}`}>
                  <p className="text-[8px] font-black text-slate-600 uppercase">Moyenne</p>
                  <p className={`text-xs font-black mt-1 ${examAvg >= 10 ? 'text-indigo-800' : 'text-rose-800'}`}>{examAvg.toFixed(2)}/20</p>
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
          .print\:hidden { display: none !important; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
          table { width: 100% !important; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #e2e8f0 !important; padding: 6px !important; }
        }
      `}</style>

      {/* Modal de confirmation de radiation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/30 backdrop-blur-md print:hidden">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-xs text-center border-2 border-slate-200">
            <p className="font-black text-slate-900 text-sm uppercase mb-5">Confirmer la suppression ?</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleDeleteStudent(confirmDeleteId)} className="bg-gradient-to-r from-rose-500 to-red-600 text-white py-2.5 rounded-lg font-black text-xs uppercase hover:shadow-lg active:scale-95 transition-all shadow-md">Supprimer</button>
              <button onClick={() => setConfirmDeleteId(null)} className="bg-slate-100 text-slate-700 py-2.5 rounded-lg font-black text-xs uppercase hover:bg-slate-200 active:scale-95 transition-all">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'export PDF */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/30 backdrop-blur-md print:hidden">
          <div className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-sm border-2 border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center shrink-0 font-bold">
                  <FileDown size={18} />
                </div>
                <div>
                  <p className="font-black text-slate-900 text-sm uppercase tracking-tight">Export PDF</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Registre des élèves</p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
                disabled={isExporting}
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-xs font-bold text-slate-600 mt-4 mb-4">
              Souhaitez-vous inclure les données financières (frais, montants payés et restant dû) dans le document exporté ?
            </p>

            <div className="space-y-2">
              <button
                onClick={() => generatePdf(true)}
                disabled={isExporting}
                className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left disabled:opacity-50 font-bold active:scale-95"
              >
                <div>
                  <p className="font-black text-xs text-slate-900 uppercase">Avec données financières</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">Frais, paiements et soldes restants inclus</p>
                </div>
                {isExporting ? <Loader2 className="animate-spin text-indigo-600" size={18} /> : <DollarSign size={18} className="text-emerald-600 shrink-0" />}
              </button>

              <button
                onClick={() => generatePdf(false)}
                disabled={isExporting}
                className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all text-left disabled:opacity-50 font-bold active:scale-95"
              >
                <div>
                  <p className="font-black text-xs text-slate-900 uppercase">Sans données financières</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">Identité, classe et résultats académiques uniquement</p>
                </div>
                {isExporting ? <Loader2 className="animate-spin text-slate-600" size={18} /> : <Lock size={18} className="text-slate-400 shrink-0" />}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
