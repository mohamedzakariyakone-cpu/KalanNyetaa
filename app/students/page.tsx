'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, type ChangeEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { offlineWrite } from '@/utils/offlineApi';
import { useYear } from '@/context/YearContext';
import { useCacheRefresh } from '@/hooks/useCacheRefresh';
import {
  Search, Loader2, Phone, X, Trash2, Plus, Lock,
  AlertCircle, DollarSign, Award, GraduationCap, ArrowLeft, FileDown
} from 'lucide-react';
import NumericInput from '@/components/NumericInput';

// --- UTILITAIRES DE GESTION INDEXEDDB ---
const DB_NAME = 'KalanNyetaaCacheDB';
const DB_VERSION = 1;

// On garde une seule connexion ouverte pour éviter de ré-ouvrir la DB à chaque appel
// (chaque ouverture coûte un aller-retour asynchrone qui retarde l'affichage instantané)
let dbPromise: Promise<IDBDatabase> | null = null;

function initIndexedDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') return Promise.reject('Environnement serveur');
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('students_cache')) {
        db.createObjectStore('students_cache', { keyPath: 'cacheKey' });
      }
    };
    request.onsuccess = (event: Event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event: Event) => {
      dbPromise = null; // permet de retenter une ouverture plus tard si celle-ci échoue
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

function getLocalCache<T>(cacheKey: string): Promise<T | null> {
  return initIndexedDB().then(db => {
    return new Promise<T | null>((resolve) => {
      const transaction = db.transaction('students_cache', 'readonly');
      const store = transaction.objectStore('students_cache');
      const request = store.get(cacheKey);
      request.onsuccess = () => resolve(request.result ? (request.result.data as T) : null);
      request.onerror = () => resolve(null);
    });
  }).catch(() => null);
}
async function setLocalCache(cacheKey: string, data: unknown): Promise<void> {
  const db = await initIndexedDB();

  const transaction = db.transaction('students_cache', 'readwrite');
  const store = transaction.objectStore('students_cache');

  store.put({ cacheKey, data, updatedAt: Date.now() });

  await new Promise<void>((resolve) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}
// ----------------------------------------

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
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', classId: classFilter || '', annualFee: '',
    parentPhone: '', address: '', birthDate: '', lastExamAvg: '0'
  });

  const { selectedYearId, selectedYear, years, isReadOnly, isLoading: yearLoading } = useYear();

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

    // Chargement immédiat du cache des prochaines classes depuis IndexedDB
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
    
    // Clé unique pour isoler le cache par année et par classe filtrée
    const cacheKey = `students_data_${selectedYearId}_${classFilter || 'all'}`;
    
    try {
      // ÉTAPE 1 : Extraire instantanément les données enregistrées localement
      const cached = await getLocalCache<{ students: StudentRecord[]; classes: ClassRecord[]; currentClassInfo: ClassRecord | null }>(cacheKey);
      if (cached) {
        setStudents(cached.students || []);
        setClasses(cached.classes || []);
        setCurrentClassInfo(cached.currentClassInfo || null);
        setLoading(false); // Le chargement devient instantané pour l'utilisateur
      } else {
        setLoading(true);
      }

      // ÉTAPE 2 : Récupérer silencieusement les nouvelles données depuis Supabase
      let query = supabase.from('students').select('*, classes(name)').eq('academic_year_id', selectedYearId);
      if (classFilter) query = query.eq('class_id', classFilter);
      const { data: stData } = await query.order('last_name', { ascending: true });

      const { data: clData } = await supabase.from('classes').select('*').eq('academic_year_id', selectedYearId).order('name');
      
      let computedClassInfo = null;
      if (classFilter && clData) {
        const current = clData.find((c: ClassRecord) => String(c.id) === classFilter);
        computedClassInfo = current || null;
      }

      const freshStudents = stData || [];
      const freshClasses = clData || [];

      // ÉTAPE 3 : Mettre à jour l'état et sauvegarder dans IndexedDB pour la prochaine visite
      setStudents(freshStudents);
      setClasses(freshClasses);
      setCurrentClassInfo(computedClassInfo);
      
      await setLocalCache(cacheKey, {
        students: freshStudents,
        classes: freshClasses,
        currentClassInfo: computedClassInfo
      });

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
  });

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

    const { error } = await offlineWrite({
      table: 'students',
      action: 'INSERT',
      payload: inserts,
      cacheKey,
      optimisticUpdate: () => {
        setStudents((prev) => [
          ...inserts.map((item) => ({ id: `offline-${Date.now()}-${Math.random()}`, ...item })),
          ...prev,
        ]);
      },
    });

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

  // Génère un PDF professionnel du registre, avec ou sans les données financières
  const generatePdf = async (includeFinancial: boolean) => {
    setIsExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;

      const today = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
      const titleClasse = classFilter && currentClassInfo ? `Classe : ${currentClassInfo.name}` : 'Registre Général des Élèves';
      const sousTitre = selectedYear?.label ? `Année scolaire ${selectedYear.label}` : '';

      // --- EN-TÊTE DU DOCUMENT ---
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 22, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('KALAN NYETAA', margin, 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225); // slate-300
      doc.text('Système de gestion scolaire', margin, 15.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(titleClasse.toUpperCase(), pageWidth - margin, 10, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text(`${sousTitre}${sousTitre ? ' — ' : ''}Généré le ${today}`, pageWidth - margin, 15.5, { align: 'right' });

      // --- BLOCS STATISTIQUES ---
      let cursorY = 30;
      const statBoxes = includeFinancial
        ? [
            { label: 'EFFECTIF', value: `${stats.total} élève(s)`, color: [15, 23, 42] },
            { label: 'TOTAL RECOUVRÉ', value: `${stats.totalPaid.toLocaleString('fr-FR')} FCFA`, color: [5, 150, 105] },
            { label: 'RESTANT DÛ', value: `${stats.totalDue.toLocaleString('fr-FR')} FCFA`, color: [225, 29, 72] },
            { label: 'MOYENNE GÉNÉRALE', value: `${stats.generalAvg.toFixed(2)} / 20`, color: [79, 70, 229] },
          ]
        : [
            { label: 'EFFECTIF', value: `${stats.total} élève(s)`, color: [15, 23, 42] },
            { label: 'MOYENNE GÉNÉRALE', value: `${stats.generalAvg.toFixed(2)} / 20`, color: [79, 70, 229] },
          ];

      const boxGap = 4;
      const boxWidth = (pageWidth - margin * 2 - boxGap * (statBoxes.length - 1)) / statBoxes.length;
      const boxHeight = 16;

      statBoxes.forEach((box, i) => {
        const x = margin + i * (boxWidth + boxGap);
        doc.setFillColor(248, 250, 252); // slate-50
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.roundedRect(x, cursorY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(box.label, x + 4, cursorY + 5.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11.5);
        doc.setTextColor(box.color[0], box.color[1], box.color[2]);
        doc.text(box.value, x + 4, cursorY + 12.5);
      });

      cursorY += boxHeight + 8;

      // --- TABLEAU DES ÉLÈVES ---
      const head = includeFinancial
        ? [['#', 'Nom & Prénom', 'Classe', 'Contact Parent', 'Frais (FCFA)', 'Payé (FCFA)', 'Restant (FCFA)', 'Moyenne']]
        : [['#', 'Nom & Prénom', 'Classe', 'Contact Parent', 'Moyenne']];

      const body = filteredStudents.map((s: StudentRecord, idx: number) => {
        const totalFee = Number(s.scolarite_totale || s.annual_fee || 0);
        const paidFee = Number(s.scolarite_payee || 0);
        const due = totalFee - paidFee;
        const examAvg = Number(s.last_exam_avg ?? 0);
        const fullName = `${(s.last_name || '').toUpperCase()} ${s.first_name || ''}`.trim();
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
          textColor: [30, 41, 59], // slate-800
          lineColor: [226, 232, 240], // slate-200
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [15, 23, 42], // slate-900
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'left',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252], // slate-50
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
          // Colore la moyenne selon le résultat (réussite / échec)
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
          // Pied de page : numéro de page + signature
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

  // Navigation vers la fiche détaillée d'un élève (clic sur la ligne/carte)
  const goToStudentDetail = (studentId: string | number) => {
    router.push(`/students/${studentId}`);
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
            onClick={() => setShowExportModal(true)}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-800 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs shadow-sm hover:bg-slate-50 transition-all flex-1 sm:flex-none"
          >
            <FileDown size={15} className="text-slate-500" />
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
            <p className="text-sm sm:text-lg font-black text-emerald-600 leading-tight truncate">{stats.totalPaid.toLocaleString()} <span className="text-[8px] font-bold text-emerald-400">FCFA</span></p>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 sm:gap-3">
          <div className="p-2 bg-rose-50 rounded-lg text-rose-600 shrink-0">
            <AlertCircle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase truncate">Restant dû</p>
            <p className="text-sm sm:text-lg font-black text-rose-600 leading-tight truncate">{stats.totalDue.toLocaleString()} <span className="text-[8px] font-bold text-rose-400">FCFA</span></p>
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
                      onClick={() => { 
                        setShowReenrollmentSection(false);
                        setIsSelectionMode(false); 
                        setSelectedStudentIds([]); 
                        setSelectAll(false); 
                      }}
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
              <input 
                type="text" 
                placeholder="Moussa" 
                className="w-full p-2.5 bg-slate-50 rounded-lg outline-none font-bold text-xs text-slate-800"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                disabled={isReadOnly}
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Nom</label>
              <input 
                type="text" 
                placeholder="Diarra" 
                className="w-full p-2.5 bg-slate-50 rounded-lg outline-none font-bold text-xs text-slate-800"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                disabled={isReadOnly}
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Naissance</label>
              <input 
                type="date" 
                className="w-full p-2.5 bg-slate-50 rounded-lg outline-none font-bold text-xs text-slate-600"
                value={formData.birthDate}
                onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Classe</label>
              <select 
                className="w-full p-2.5 bg-slate-50 rounded-lg outline-none font-bold text-xs text-slate-800"
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Téléphone Parent</label>
              <input 
                type="text" 
                placeholder="70000000" 
                className="w-full p-2.5 bg-slate-50 rounded-lg outline-none font-bold text-xs text-slate-800"
                value={formData.parentPhone}
                onChange={(e) => setFormData({...formData, parentPhone: e.target.value})}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Adresse</label>
              <input 
                type="text" 
                placeholder="Quartier..." 
                className="w-full p-2.5 bg-slate-50 rounded-lg outline-none font-bold text-xs text-slate-800"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                disabled={isReadOnly}
              />
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

          <button 
            type="submit" 
            disabled={isSubmitting || isReadOnly}
            className="w-full md:w-auto bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wide shadow-sm disabled:opacity-50"
          >
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
                <tr><td colSpan={7} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-slate-900" size={20} /></td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-xs font-semibold text-slate-400">Aucun élève trouvé.</td></tr>
              ) : filteredStudents.map((s: StudentRecord) => {
                const totalFee = Number(s.scolarite_totale || s.annual_fee || 0);
                const paidFee = Number(s.scolarite_payee || 0);
                const examAvg = Number(s.last_exam_avg ?? 0);
                const isSettled = paidFee >= totalFee && totalFee > 0;

                return (
                  <tr 
                    key={s.id} 
                    onClick={() => goToStudentDetail(s.id)}
                    className="hover:bg-slate-50/50 transition-colors print:break-inside-avoid cursor-pointer"
                  >
                    {classFilter && isSelectionMode && (
                      <td 
                        className="px-4 py-3.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                    <td className="px-4 py-3.5 text-center font-medium text-slate-600 text-xs whitespace-nowrap">
                      {s.parent_phone || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-slate-900 text-xs">
                      {totalFee.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span className={`inline-block px-2 py-1 rounded-md font-bold text-[10px] ${isSettled ? 'bg-emerald-50 text-emerald-700' : paidFee > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {paidFee.toLocaleString()} FCFA
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`font-black text-xs ${examAvg >= 10 ? 'text-indigo-600' : 'text-rose-600'}`}>
                        {examAvg.toFixed(2)}
                      </span>
                    </td>
                    <td 
                      className="px-6 py-3.5 text-right print:hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2">
                        {!isReadOnly && (
                          <button
                            onClick={() => setConfirmDeleteId(String(s.id))}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Radier l'élève"
                          >
                            <Trash2 size={14} />
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

      {/* 📱 AFFICHAGE ÉCRANS SMARTPHONES (MOBILE) : Cartes empilées compactes */}
      <div className="grid grid-cols-1 gap-2.5 px-3 sm:px-0 md:hidden print:hidden">
        {loading ? (
          <div className="p-10 text-center bg-white rounded-xl"><Loader2 className="animate-spin mx-auto text-slate-900" size={20} /></div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-400 bg-white rounded-xl">Aucun élève trouvé.</div>
        ) : filteredStudents.map((s: StudentRecord) => {
          const totalFee = Number(s.scolarite_totale || s.annual_fee || 0);
          const paidFee = Number(s.scolarite_payee || 0);
          const examAvg = Number(s.last_exam_avg ?? 0);
          const isSettled = paidFee >= totalFee && totalFee > 0;

          return (
            <div 
              key={s.id} 
              onClick={() => goToStudentDetail(s.id)}
              className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm space-y-3 cursor-pointer active:bg-slate-50 hover:bg-slate-50/70 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {classFilter && isSelectionMode && (
                    <input 
                      type="checkbox" 
                      checked={selectedStudentIds.includes(String(s.id))} 
                      onChange={() => toggleStudentSelection(String(s.id))} 
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500 mr-1 shrink-0" 
                    />
                  )}
                  <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs uppercase shrink-0">
                    {s.first_name?.[0]}{s.last_name?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-xs uppercase truncate">{s.last_name} <span className="capitalize font-medium text-slate-700">{s.first_name}</span></p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight mt-0.5">{s.classes?.name || 'Inconnu'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {s.parent_phone && (
                    <a 
                      href={`tel:${s.parent_phone}`} 
                      className="h-7 w-7 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center border border-emerald-100"
                    >
                      <Phone size={12} />
                    </a>
                  )}
                  {!isReadOnly && (
                    <button 
                      onClick={() => setConfirmDeleteId(String(s.id))} 
                      className="h-7 w-7 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center border border-rose-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-50 text-center">
                <div className="bg-slate-50/60 p-1.5 rounded-lg">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Scolarité</p>
                  <p className="text-[10px] font-black text-slate-800 mt-0.5">{totalFee.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50/60 p-1.5 rounded-lg">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Payé</p>
                  <p className={`text-[10px] font-black mt-0.5 ${isSettled ? 'text-emerald-600' : 'text-amber-600'}`}>{paidFee.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50/60 p-1.5 rounded-lg">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Moyenne</p>
                  <p className={`text-[10px] font-black mt-0.5 ${examAvg >= 10 ? 'text-indigo-600' : 'text-rose-600'}`}>{examAvg.toFixed(2)}/20</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/20 backdrop-blur-sm print:hidden">
          <div className="bg-white p-5 rounded-xl shadow-xl w-full max-w-xs text-center border border-slate-100">
            <p className="font-black text-slate-900 text-xs uppercase mb-4">Confirmer la suppression ?</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleDeleteStudent(confirmDeleteId)} className="bg-rose-600 text-white py-2 rounded-lg font-bold text-xs uppercase">Supprimer</button>
              <button onClick={() => setConfirmDeleteId(null)} className="bg-slate-100 text-slate-700 py-2 rounded-lg font-bold text-xs uppercase">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'export PDF : choix d'inclure ou non les données financières */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/30 backdrop-blur-sm print:hidden">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <FileDown size={16} />
                </div>
                <div>
                  <p className="font-black text-slate-900 text-sm uppercase tracking-tight">Export PDF</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Registre des élèves</p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600"
                disabled={isExporting}
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-600 mt-4 mb-4">
              Souhaitez-vous inclure les données financières (frais, montants payés et restant dû) dans le document exporté ?
            </p>

            <div className="space-y-2">
              <button
                onClick={() => generatePdf(true)}
                disabled={isExporting}
                className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-slate-900 hover:bg-slate-50 transition-all text-left disabled:opacity-50"
              >
                <div>
                  <p className="font-black text-xs text-slate-900 uppercase">Avec données financières</p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Frais, paiements et soldes restants inclus</p>
                </div>
                {isExporting ? <Loader2 className="animate-spin text-slate-900" size={16} /> : <DollarSign size={16} className="text-emerald-600 shrink-0" />}
              </button>

              <button
                onClick={() => generatePdf(false)}
                disabled={isExporting}
                className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-slate-900 hover:bg-slate-50 transition-all text-left disabled:opacity-50"
              >
                <div>
                  <p className="font-black text-xs text-slate-900 uppercase">Sans données financières</p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Identité, classe et résultats académiques uniquement</p>
                </div>
                {isExporting ? <Loader2 className="animate-spin text-slate-900" size={16} /> : <Lock size={16} className="text-slate-400 shrink-0" />}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}