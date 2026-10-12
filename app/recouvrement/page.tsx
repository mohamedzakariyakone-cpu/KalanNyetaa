'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { useYear } from '@/context/YearContext';
import {
  Search, Loader2, Phone, CheckCircle, AlertTriangle,
  Clock, DollarSign, Filter, MessageSquare, Layers, GraduationCap,
  FileText, Download, ChevronDown, Bell, Users, TrendingUp, X
} from 'lucide-react';

// ==========================================
// CONFIGURATION CACHE LOCAL INDEXEDDB
// ==========================================
const DB_NAME = 'KalanNyetaaRecouvrementDB';
const DB_VERSION = 1;

function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject('Environnement serveur');
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('recouvrement_cache')) {
        db.createObjectStore('recouvrement_cache', { keyPath: 'cacheKey' });
      }
    };
    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
}

function getLocalCache(cacheKey: string): Promise<any | null> {
  return initIndexedDB().then(db => {
    return new Promise((resolve) => {
      const transaction = db.transaction('recouvrement_cache', 'readonly');
      const store = transaction.objectStore('recouvrement_cache');
      const request = store.get(cacheKey);
      request.onsuccess = () => resolve(request.result ? request.result.data : null);
      request.onerror = () => resolve(null);
    });
  }).catch(() => null);
}

async function setLocalCache(cacheKey: string, data: any): Promise<void> {
  try {
    const db = await initIndexedDB();
    const transaction = db.transaction('recouvrement_cache', 'readwrite');
    const store = transaction.objectStore('recouvrement_cache');
    store.put({ cacheKey, data, updatedAt: Date.now() });
    await new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  } catch {
    // silent fail
  }
}

// ==========================================
// TYPES
// ==========================================
type StudentWithPayment = {
  id: string;
  first_name: string;
  last_name: string;
  scolarite_totale: number;
  scolarite_payee: number;
  parent_phone: string | null;
  payment_plan_tranches: number | null;
  class_id: string;
};

type ClassRecord = {
  id: string;
  name: string;
};

type ProcessedStudent = StudentWithPayment & {
  montantParTranche: number;
  montantAttenduPourTrancheSelectionnee: number;
  resteAFinancerTranche: number;
  statutTranche: string;
  reliquatGlobal: number;
};

function formatMontant(val: number): string {
  return val.toLocaleString('fr-FR').replace(/\u202F/g, '\u00A0');
}

function todayFR(): string {
  return new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
}

// ==========================================
// GÉNÉRATION PDF — RAPPORT DE RECOUVREMENT
// ==========================================
async function generateRapportPDF(
  filteredStudents: ProcessedStudent[],
  stats: any,
  activeClassName: string,
  selectedTranche: number,
  statusFilter: string,
  schoolName: string,
  selectedYear: string
) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR;
  const today = todayFR();

  const blue = [37, 99, 235] as [number, number, number];
  const blueLight = [239, 246, 255] as [number, number, number];
  const slate900 = [15, 23, 42] as [number, number, number];
  const slate600 = [71, 85, 105] as [number, number, number];
  const slate200 = [226, 232, 240] as [number, number, number];
  const emerald = [5, 150, 105] as [number, number, number];
  const rose = [225, 29, 72] as [number, number, number];
  const amber = [180, 83, 9] as [number, number, number];

  doc.setFillColor(...blue);
  doc.rect(0, 0, pageW, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(schoolName.toUpperCase(), marginL, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(219, 234, 254);
  doc.text('RAPPORT DE RECOUVREMENT DES FRAIS DE SCOLARITÉ', marginL, 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`Classe : ${activeClassName}  —  Tranche N°${selectedTranche}`, marginL, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(219, 234, 254);
  doc.text(`Année : ${selectedYear}`, pageW - marginR, 14, { align: 'right' });
  doc.text(`Édité le ${today}`, pageW - marginR, 20, { align: 'right' });

  const filterLabels: Record<string, string> = {
    all: 'Tous les élèves',
    EN_RETARD: 'En retard uniquement',
    INCOMPLET: 'Incomplet uniquement',
    EN_REGLE: 'En règle uniquement',
    TOTALEMENT_SOLDE: 'Année soldée uniquement'
  };
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(219, 234, 254);
  doc.text(`Filtre appliqué : ${filterLabels[statusFilter] || statusFilter}`, marginL, 38);

  let y = 52;
  const cardW = (contentW - 9) / 4;

  const statCards = [
    { label: 'Attendu (T' + selectedTranche + ')', value: formatMontant(stats.globalAttendu) + ' FCFA', color: slate900 },
    { label: 'Perçu sur Tranche', value: formatMontant(stats.globalPercu) + ' FCFA', color: emerald },
    { label: 'Reste à recouvrer', value: formatMontant(stats.resteRecouvrer) + ' FCFA', color: rose },
    { label: 'Taux recouvrement', value: stats.tauxRecouvrement.toFixed(1) + '%', color: blue },
  ];

  statCards.forEach((card, i) => {
    const x = marginL + i * (cardW + 3);
    doc.setFillColor(...blueLight);
    doc.roundedRect(x, y, cardW, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...slate600);
    doc.text(card.label.toUpperCase(), x + 3, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...card.color);
    doc.text(card.value, x + 3, y + 14);
  });

  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slate600);
  doc.text(
    `Élèves : ${filteredStudents.length} affichés  |  En retard : ${stats.retardCount}  |  Incomplet : ${stats.incompletCount}  |  En règle : ${stats.regleCount}  |  Soldé : ${stats.soldeCount}`,
    marginL, y
  );

  y += 6;

  const statusLabel = (s: string) => {
    if (s === 'TOTALEMENT_SOLDE') return 'Année Soldée';
    if (s === 'EN_REGLE') return 'En règle';
    if (s === 'INCOMPLET') return 'Incomplet';
    return 'En retard';
  };

  const statusColor = (s: string): [number, number, number] => {
    if (s === 'TOTALEMENT_SOLDE') return blue;
    if (s === 'EN_REGLE') return emerald;
    if (s === 'INCOMPLET') return amber;
    return rose;
  };

  const tableBody = filteredStudents.map((s, idx) => [
    String(idx + 1),
    `${s.first_name} ${s.last_name}`,
    `${s.payment_plan_tranches} tr.`,
    formatMontant(s.scolarite_totale),
    formatMontant(s.scolarite_payee),
    formatMontant(s.resteAFinancerTranche),
    statusLabel(s.statutTranche),
  ]);

  (autoTable as any)(doc, {
    startY: y,
    head: [['#', 'Élève', 'Plan', 'Scolarité totale', 'Total versé', `Reste Tranche ${selectedTranche}`, 'Statut']],
    body: tableBody,
    margin: { left: marginL, right: marginR },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      valign: 'middle',
      textColor: slate900,
      lineColor: slate200,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: blue,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 52, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: 22 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data: any) => {
      if (data.column.index === 6 && data.section === 'body') {
        const student = filteredStudents[data.row.index];
        if (student) {
          data.cell.styles.textColor = statusColor(student.statutTranche);
          data.cell.styles.fontStyle = 'bold';
        }
      }
      if (data.column.index === 5 && data.section === 'body') {
        const student = filteredStudents[data.row.index];
        if (student && student.resteAFinancerTranche > 0) {
          data.cell.styles.textColor = rose;
        } else {
          data.cell.styles.textColor = emerald;
        }
      }
    },
  });

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...slate200);
    doc.rect(0, pageH - 12, pageW, 12, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...slate600);
    doc.text(schoolName, marginL, pageH - 5);
    doc.text(`Page ${i} / ${totalPages}`, pageW / 2, pageH - 5, { align: 'center' });
    doc.text(`Document confidentiel — ${today}`, pageW - marginR, pageH - 5, { align: 'right' });
  }

  const filename = `Recouvrement_${activeClassName.replace(/\s/g, '_')}_Tranche${selectedTranche}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf`;
  doc.save(filename);
}

// ==========================================
// GÉNÉRATION PDF — AVIS AUX PARENTS (8 par page)
// ==========================================
async function generateAvisPDF(
  avisStudents: ProcessedStudent[],
  activeClassName: string,
  selectedTranche: number,
  schoolName: string,
  selectedYear: string
) {
  const { default: jsPDF } = await import('jspdf');

  if (avisStudents.length === 0) {
    alert("Aucun élève à notifier avec les filtres actuels.");
    return;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const today = todayFR();

  const cols = 2;
  const rows = 4;
  const marginX = 8;
  const marginY = 8;
  const gapX = 6;
  const gapY = 5;

  const avisW = (pageW - marginX * 2 - gapX) / cols;
  const avisH = (pageH - marginY * 2 - gapY * (rows - 1)) / rows;

  const positions: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      positions.push({
        x: marginX + c * (avisW + gapX),
        y: marginY + r * (avisH + gapY),
      });
    }
  }

  const blue = [37, 99, 235] as [number, number, number];
  const rose = [225, 29, 72] as [number, number, number];
  const slate900 = [15, 23, 42] as [number, number, number];
  const slate600 = [71, 85, 105] as [number, number, number];
  const slate200 = [226, 232, 240] as [number, number, number];
  const amber50 = [255, 251, 235] as [number, number, number];
  const amberBdr = [217, 119, 6] as [number, number, number];

  let posIdx = 0;
  let firstPage = true;

  for (let i = 0; i < avisStudents.length; i++) {
    const student = avisStudents[i];

    if (posIdx === 0 && !firstPage) doc.addPage();
    firstPage = false;

    const { x, y } = positions[posIdx];

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...slate200);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, y, avisW, avisH, 2, 2, 'FD');

    doc.setDrawColor(185, 185, 185);
    doc.setLineWidth(0.15);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.roundedRect(x - 0.8, y - 0.8, avisW + 1.6, avisH + 1.6, 2, 2, 'D');
    doc.setLineDashPattern([], 0);

    const headerH = 13;
    doc.setFillColor(...blue);
    doc.roundedRect(x, y, avisW, headerH, 2, 2, 'F');
    doc.setFillColor(...blue);
    doc.rect(x, y + headerH - 3, avisW, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(schoolName.toUpperCase(), x + 3, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(219, 234, 254);
    doc.text('AVIS DE RECOUVREMENT — À REMETTRE AUX PARENTS / TUTEURS', x + 3, y + 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(219, 234, 254);
    doc.text(String(selectedYear), x + avisW - 3, y + 5.5, { align: 'right' });

    let cy = y + headerH + 3.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...slate900);
    doc.text('AVIS DE PAIEMENT', x + avisW / 2, cy, { align: 'center' });

    cy += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(...slate600);
    doc.text(`Classe : ${activeClassName}  —  Tranche N°${selectedTranche}`, x + avisW / 2, cy, { align: 'center' });

    cy += 3;
    doc.setDrawColor(...slate200);
    doc.setLineWidth(0.25);
    doc.line(x + 3, cy, x + avisW - 3, cy);

    cy += 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...slate900);
    const nomComplet = `${student.first_name} ${student.last_name}`.toUpperCase();
    doc.text(nomComplet, x + avisW / 2, cy, { align: 'center' });

    cy += 4.5;
    const blocH = 17;
    doc.setFillColor(...amber50);
    doc.setDrawColor(...amberBdr);
    doc.setLineWidth(0.25);
    doc.roundedRect(x + 3, cy, avisW - 6, blocH, 1.5, 1.5, 'FD');

    const colLabel = x + 5;
    const colVal = x + avisW - 5;
    const lh = 4.8;
    cy += 4;

    const rows2 = [
      { label: `Montant Tranche N°${selectedTranche}`, value: formatMontant(student.montantParTranche) + ' FCFA', highlight: false },
      { label: 'Total versé à ce jour', value: formatMontant(student.scolarite_payee) + ' FCFA', highlight: false },
      { label: 'Reste dû (cette tranche)', value: formatMontant(student.resteAFinancerTranche) + ' FCFA', highlight: true },
    ];

    rows2.forEach(row => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(...slate600);
      doc.text(row.label, colLabel, cy);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(row.highlight ? 225 : 15, row.highlight ? 29 : 23, row.highlight ? 72 : 42);
      doc.text(row.value, colVal, cy, { align: 'right' });
      cy += lh;
    });

    cy += 2;
    const statutText = student.statutTranche === 'INCOMPLET'
      ? 'PAIEMENT PARTIEL — COMPLÉTER SANS DÉLAI'
      : 'PAIEMENT NON EFFECTUÉ — RÉGULARISATION URGENTE';
    doc.setFillColor(...rose);
    doc.roundedRect(x + 3, cy, avisW - 6, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.8);
    doc.setTextColor(255, 255, 255);
    doc.text(statutText, x + avisW / 2, cy + 4, { align: 'center' });

    cy += 8.5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(4.8);
    doc.setTextColor(...slate600);
    const msg = `Merci de régulariser cette situation auprès de la comptabilité dans les meilleurs délais. — ${today}`;
    const msgLines = doc.splitTextToSize(msg, avisW - 8);
    doc.text(msgLines, x + avisW / 2, cy, { align: 'center' });

    cy += msgLines.length * 3.2 + 2;
    doc.setDrawColor(...slate200);
    doc.setLineWidth(0.2);
    doc.line(x + 3, cy, x + avisW / 2 - 2, cy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.setTextColor(...slate600);
    doc.text('Signature parent / tuteur', x + 3, cy + 3);

    posIdx = (posIdx + 1) % 8;
  }

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(185, 185, 185);
    doc.setLineWidth(0.15);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(pageW / 2, 4, pageW / 2, pageH - 4);
    for (let r = 1; r < rows; r++) {
      const tyLine = marginY + r * (avisH + gapY) - gapY / 2;
      doc.line(4, tyLine, pageW - 4, tyLine);
    }
    doc.setLineDashPattern([], 0);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.5);
    doc.setTextColor(160, 160, 160);
    doc.text(`✂  Découper suivant les pointillés  —  ${schoolName}  —  Page ${p}/${totalPages}`, pageW / 2, pageH - 2, { align: 'center' });
  }

  const filename = `Avis_Parents_${activeClassName.replace(/\s/g, '_')}_Tranche${selectedTranche}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf`;
  doc.save(filename);
}

// ==========================================
// COMPOSANT PRINCIPAL
// ==========================================
export default function RecouvrementPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-3">
        <Loader2 className="animate-spin text-blue-600" size={28} />
        <p className="font-bold text-xs uppercase tracking-widest text-slate-500">Chargement du module recouvrement...</p>
      </div>
    }>
      <RecouvrementContent />
    </Suspense>
  );
}

function RecouvrementContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classFilter = searchParams.get('class_id') || '';

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<StudentWithPayment[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [schoolName, setSchoolName] = useState<string>('Établissement Scolaire');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingRapport, setExportingRapport] = useState(false);
  const [exportingAvis, setExportingAvis] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const [selectedTranche, setSelectedTranche] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [mobileClassOpen, setMobileClassOpen] = useState(false);

  const { selectedYearId, selectedYear, isReadOnly } = useYear();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadSchoolName() {
      try {
        const { data, error } = await supabase
          .from('schools')
          .select('name')
          .limit(1)
          .single();
        if (!error && data?.name) {
          setSchoolName(data.name);
        }
      } catch {}
    }
    loadSchoolName();
  }, []);

  useEffect(() => {
    async function loadClasses() {
      if (!selectedYearId) return;
      const cacheKey = `classes_year_${selectedYearId}`;
      const cachedClasses = await getLocalCache(cacheKey);
      if (cachedClasses) {
        setClasses(cachedClasses);
        setLoadingClasses(false);
      }
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('id, name')
          .eq('academic_year_id', selectedYearId)
          .order('name', { ascending: true });
        if (!error && data) {
          setClasses(data);
          await setLocalCache(cacheKey, data);
        }
      } catch (err) {
        console.error("Erreur de chargement des classes", err);
      } finally {
        setLoadingClasses(false);
      }
    }
    loadClasses();
  }, [selectedYearId]);

  const fetchStudents = useCallback(async () => {
    if (!selectedYearId || !classFilter) {
      setStudents([]);
      return;
    }
    const cacheKey = `students_recouv_${selectedYearId}_${classFilter}`;
    setLoadingStudents(true);
    const cachedStudents = await getLocalCache(cacheKey);
    if (cachedStudents) {
      setStudents(cachedStudents);
      setLoadingStudents(false);
    }
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, scolarite_totale, scolarite_payee, parent_phone, payment_plan_tranches, class_id')
        .eq('academic_year_id', selectedYearId)
        .eq('class_id', classFilter);
      if (!error && data) {
        const formattedData = data.map((s: any) => ({
          ...s,
          scolarite_totale: Number(s.scolarite_totale || 0),
          scolarite_payee: Number(s.scolarite_payee || 0),
          payment_plan_tranches: Number(s.payment_plan_tranches || 3),
        }));
        setStudents(formattedData);
        await setLocalCache(cacheKey, formattedData);
      }
    } catch (err) {
      console.error("Erreur de synchronisation des élèves", err);
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedYearId, classFilter]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const handleClassSelect = (classId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (classId) {
      params.set('class_id', classId);
    } else {
      params.delete('class_id');
    }
    router.push(`?${params.toString()}`);
    setMobileClassOpen(false);
    setStatusFilter('all');
    setSearchTerm('');
  };

  const activeClassName = useMemo(() => {
    return classes.find(c => c.id === classFilter)?.name || '';
  }, [classes, classFilter]);

  const processedStudents = useMemo((): ProcessedStudent[] => {
    return students
      .filter(student => {
        const totalTranches = student.payment_plan_tranches || 3;
        return totalTranches >= selectedTranche;
      })
      .map(student => {
        const total = student.scolarite_totale;
        const paye = student.scolarite_payee;
        const totalTranches = student.payment_plan_tranches || 3;
        const montantParTranche = totalTranches > 0 ? total / totalTranches : total;

        const montantAttenduPourTrancheSelectionnee = montantParTranche * selectedTranche;
        const montantAttenduTranchePrecedente = montantParTranche * (selectedTranche - 1);

        let statutTranche = 'EN_RETARD';
        let resteAFinancerTranche = Math.max(0, montantAttenduPourTrancheSelectionnee - paye);

        if (paye >= total) {
          statutTranche = 'TOTALEMENT_SOLDE';
        } else if (paye >= montantAttenduPourTrancheSelectionnee) {
          statutTranche = 'EN_REGLE';
        } else if (paye > montantAttenduTranchePrecedente && paye < montantAttenduPourTrancheSelectionnee) {
          statutTranche = 'INCOMPLET';
        } else {
          statutTranche = 'EN_RETARD';
        }

        return {
          ...student,
          montantParTranche,
          montantAttenduPourTrancheSelectionnee,
          resteAFinancerTranche,
          statutTranche,
          reliquatGlobal: Math.max(0, total - paye),
        };
      });
  }, [students, selectedTranche]);

  const filteredStudents = useMemo(() => {
    return processedStudents.filter(s => {
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter === 'all') return true;
      return s.statutTranche === statusFilter;
    });
  }, [processedStudents, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    let globalAttendu = 0;
    let globalPercu = 0;
    let retardCount = 0;
    let incompletCount = 0;
    let regleCount = 0;
    let soldeCount = 0;

    processedStudents.forEach(s => {
      globalAttendu += s.montantAttenduPourTrancheSelectionnee;
      globalPercu += Math.min(s.scolarite_payee, s.montantAttenduPourTrancheSelectionnee);
      if (s.statutTranche === 'EN_RETARD') retardCount++;
      if (s.statutTranche === 'INCOMPLET') incompletCount++;
      if (s.statutTranche === 'EN_REGLE') regleCount++;
      if (s.statutTranche === 'TOTALEMENT_SOLDE') soldeCount++;
    });

    const resteRecouvrer = Math.max(0, globalAttendu - globalPercu);
    const tauxRecouvrement = globalAttendu > 0 ? (globalPercu / globalAttendu) * 100 : 0;

    return { retardCount, incompletCount, regleCount, soldeCount, globalAttendu, globalPercu, resteRecouvrer, tauxRecouvrement };
  }, [processedStudents]);

  const retardStudents = useMemo(() => {
    return filteredStudents.filter(s => s.statutTranche === 'EN_RETARD' || s.statutTranche === 'INCOMPLET');
  }, [filteredStudents]);

  const sendWhatsAppReminder = (student: ProcessedStudent) => {
    if (!student.parent_phone) {
      alert("Aucun numéro de téléphone enregistré pour ce parent.");
      return;
    }
    let phone = student.parent_phone.replace(/[\s\-\+\(\)]/g, '');
    if (phone.length === 8) phone = '223' + phone;

    const message = `Bonjour Chers Parents,\n\nNous vous contactons depuis ${schoolName} concernant le suivi financier de votre enfant *${student.first_name} ${student.last_name}* en classe de *${activeClassName}*.\n\nPour la *Tranche N°${selectedTranche}*, le montant attendu est de *${formatMontant(student.montantParTranche)} FCFA*.\nActuellement, la scolarité totale versée est de *${formatMontant(student.scolarite_payee)} FCFA*.\nLe montant restant à acquitter pour cette étape est de : *${formatMontant(student.resteAFinancerTranche)} FCFA*.\n\nNous vous prions de bien vouloir régulariser cette situation auprès de la comptabilité dans les plus brefs délais.\n\nCordialement, la Direction.`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleExportRapport = async () => {
    setExportMenuOpen(false);
    setExportingRapport(true);
    try {
      await generateRapportPDF(
        filteredStudents,
        stats,
        activeClassName,
        selectedTranche,
        statusFilter,
        schoolName,
        String(selectedYear?.id || '')
      );
    } finally {
      setExportingRapport(false);
    }
  };

  const handleExportAvis = async () => {
    setExportMenuOpen(false);
    setExportingAvis(true);
    try {
      await generateAvisPDF(
        retardStudents,
        activeClassName,
        selectedTranche,
        schoolName,
        String(selectedYear?.id || '')
      );
    } finally {
      setExportingAvis(false);
    }
  };

  const StatutBadge = ({ statut }: { statut: string }) => {
    const configs: Record<string, { label: string; cls: string }> = {
      TOTALEMENT_SOLDE: { label: 'Année Soldée ✓', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
      EN_REGLE: { label: 'En règle', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      INCOMPLET: { label: 'Incomplet', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
      EN_RETARD: { label: 'En retard', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    };
    const cfg = configs[statut] || configs['EN_RETARD'];
    return (
      <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md border ${cfg.cls} whitespace-nowrap`}>
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6 antialiased text-slate-900 font-sans pb-28">

      {/* 1. EN-TÊTE ÉPURÉ & PLAT */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Recouvrement & Scolarité</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Suivi des Échéances
          </h1>
        </div>

        {classFilter && (
          <div className="relative shrink-0" ref={exportMenuRef}>
            <button
              onClick={() => setExportMenuOpen(v => !v)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <Download size={14} />
              <span>Exporter</span>
              <ChevronDown size={13} className={`transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 space-y-1 z-50 animate-in fade-in duration-100">
                <button
                  onClick={handleExportRapport}
                  disabled={exportingRapport}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 text-left transition disabled:opacity-50"
                >
                  <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">
                    {exportingRapport ? <Loader2 size={14} className="animate-spin" /> : <FileText size={15} />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Rapport complet</p>
                    <p className="text-[10px] text-slate-500 font-medium">Tableau A4 filtré</p>
                  </div>
                </button>

                <button
                  onClick={handleExportAvis}
                  disabled={exportingAvis}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-rose-50 text-left transition disabled:opacity-50"
                >
                  <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 flex items-center justify-center shrink-0">
                    {exportingAvis ? <Loader2 size={14} className="animate-spin" /> : <Bell size={15} />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Avis aux parents</p>
                    <p className="text-[10px] text-slate-500 font-medium">{retardStudents.length} élèves concernés (8/page)</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. SÉLECTION DES CLASSES (STYLE PLAT) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <GraduationCap size={14} className="text-blue-600" />
          <span>Sélectionner la classe</span>
        </label>

        {/* Mobile dropdown */}
        <div className="sm:hidden">
          <button
            onClick={() => setMobileClassOpen(v => !v)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
          >
            <span>{activeClassName || 'Choisir une classe...'}</span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${mobileClassOpen ? 'rotate-180' : ''}`} />
          </button>

          {mobileClassOpen && (
            <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
              {loadingClasses ? (
                <div className="p-4 flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <Loader2 size={14} className="animate-spin text-blue-600" /> Chargement...
                </div>
              ) : (
                classes.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleClassSelect(c.id)}
                    className={`w-full text-left px-4 py-2.5 text-xs font-bold border-b border-slate-100 last:border-0 ${
                      c.id === classFilter ? 'bg-blue-600 text-white' : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {c.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Desktop boutons plats */}
        {loadingClasses ? (
          <div className="hidden sm:flex items-center gap-2 py-2 text-xs text-slate-400 font-medium">
            <Loader2 className="animate-spin text-blue-600" size={15} /> Chargement des classes...
          </div>
        ) : (
          <div className="hidden sm:grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {classes.map(c => {
              const isSelected = c.id === classFilter;
              return (
                <button
                  key={c.id}
                  onClick={() => handleClassSelect(c.id)}
                  className={`py-2 px-3 rounded-xl font-bold text-xs uppercase tracking-wide border transition text-center ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. CONTENU PRINCIPAL SI CLASSE SÉLECTIONNÉE */}
      {!classFilter ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <Filter className="mx-auto text-slate-300 mb-2" size={28} />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Sélectionnez une classe ci-dessus pour afficher le recouvrement.
          </p>
        </div>
      ) : (
        <>
          {/* SÉLECTEUR DE TRANCHE */}
          {(() => {
            const maxTranches = students.length > 0
              ? Math.min(Math.max(...students.map(s => s.payment_plan_tranches || 3)), 4)
              : 4;
            return (
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Échéance analysée</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    Classe : <span className="text-blue-600 font-extrabold uppercase">{activeClassName}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                  {Array.from({ length: maxTranches }, (_, i) => i + 1).map(t => (
                    <button
                      key={t}
                      onClick={() => setSelectedTranche(t)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition ${
                        selectedTranche === t 
                          ? 'bg-white text-blue-600 shadow-xs' 
                          : 'text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      Tranche {t}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* KPI STATS PLATES */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <div className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 bg-white space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Attendu (T{selectedTranche})</span>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                {formatMontant(stats.globalAttendu)} <span className="text-xs font-bold text-slate-400">F</span>
              </p>
            </div>

            <div className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 bg-white space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Perçu sur Tranche</span>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600 leading-tight">
                {formatMontant(stats.globalPercu)} <span className="text-xs font-bold text-emerald-400">F</span>
              </p>
            </div>

            <div className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 bg-white space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Reste à recouvrer</span>
              <p className="text-2xl sm:text-3xl font-black text-rose-600 leading-tight">
                {formatMontant(stats.resteRecouvrer)} <span className="text-xs font-bold text-rose-400">F</span>
              </p>
            </div>

            <div className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 bg-white space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Taux recouvrement</span>
              <p className="text-2xl sm:text-3xl font-black text-blue-600 leading-tight">
                {stats.tauxRecouvrement.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* FILTRES PAR STATUT ET RECHERCHE */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold" size={15} />
              <input
                type="text"
                placeholder="Rechercher par prénom ou nom d'élève..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {[
                { key: 'all', label: 'Tous', count: processedStudents.length, activeCls: 'bg-slate-900 text-white' },
                { key: 'EN_RETARD', label: 'En retard', count: stats.retardCount, activeCls: 'bg-rose-600 text-white' },
                { key: 'INCOMPLET', label: 'Incomplet', count: stats.incompletCount, activeCls: 'bg-amber-600 text-white' },
                { key: 'EN_REGLE', label: 'En règle', count: stats.regleCount, activeCls: 'bg-emerald-600 text-white' },
                { key: 'TOTALEMENT_SOLDE', label: 'Soldé', count: stats.soldeCount, activeCls: 'bg-blue-600 text-white' },
              ].map(f => {
                const isActive = statusFilter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                      isActive 
                        ? `${f.activeCls} shadow-xs` 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-700 font-extrabold'}`}>
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TABLEAU / REGISTRE DES ÉLÈVES */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            {loadingStudents ? (
              <div className="p-12 text-center flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-blue-600" size={24} />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chargement des données...</span>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-12 text-center text-xs font-bold text-slate-400">
                Aucun élève trouvé dans cette catégorie.
              </div>
            ) : (
              <>
                {/* Table Desktop */}
                <div className="hidden sm:block w-full overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                        <th className="px-5 py-3.5">Élève</th>
                        <th className="px-4 py-3.5 text-center">Plan</th>
                        <th className="px-4 py-3.5 text-right">Scolarité totale</th>
                        <th className="px-4 py-3.5 text-right">Total versé</th>
                        <th className="px-4 py-3.5 text-right">Reste T{selectedTranche}</th>
                        <th className="px-4 py-3.5 text-center">Statut</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map(student => (
                        <tr key={student.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-5 py-3.5 font-bold text-slate-900 capitalize">
                            {student.first_name} {student.last_name}
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-slate-500">
                            {student.payment_plan_tranches} tr.
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-slate-800">
                            {formatMontant(student.scolarite_totale)} F
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="inline-block bg-slate-100 px-2 py-0.5 rounded font-extrabold text-slate-700">
                              {formatMontant(student.scolarite_payee)} F
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-black">
                            {student.resteAFinancerTranche === 0 ? (
                              <span className="text-emerald-600">0 F ✓</span>
                            ) : (
                              <span className="text-rose-600">+{formatMontant(student.resteAFinancerTranche)} F</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <StatutBadge statut={student.statutTranche} />
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {student.parent_phone && (
                                <a
                                  href={`tel:${student.parent_phone}`}
                                  className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                                  title="Appeler"
                                >
                                  <Phone size={13} />
                                </a>
                              )}
                              <button
                                onClick={() => sendWhatsAppReminder(student)}
                                disabled={student.statutTranche === 'EN_REGLE' || student.statutTranche === 'TOTALEMENT_SOLDE'}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed ${
                                  student.statutTranche === 'EN_REGLE' || student.statutTranche === 'TOTALEMENT_SOLDE'
                                    ? 'bg-slate-100 text-slate-400'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                }`}
                              >
                                <MessageSquare size={12} />
                                <span>Relancer</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards Plates */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {filteredStudents.map(student => (
                    <div key={student.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900 capitalize">
                            {student.first_name} {student.last_name}
                          </p>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Plan : {student.payment_plan_tranches} tranches
                          </span>
                        </div>
                        <StatutBadge statut={student.statutTranche} />
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Total</span>
                          <span className="font-bold text-slate-800">{formatMontant(student.scolarite_totale)} F</span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Versé</span>
                          <span className="font-bold text-emerald-600">{formatMontant(student.scolarite_payee)} F</span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Reste T{selectedTranche}</span>
                          <span className={`font-black ${student.resteAFinancerTranche > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {student.resteAFinancerTranche === 0 ? '0 F ✓' : `${formatMontant(student.resteAFinancerTranche)} F`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        {student.parent_phone && (
                          <a
                            href={`tel:${student.parent_phone}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold"
                          >
                            <Phone size={12} />
                            <span>Appeler</span>
                          </a>
                        )}
                        {(student.statutTranche === 'EN_RETARD' || student.statutTranche === 'INCOMPLET') && (
                          <button
                            onClick={() => sendWhatsAppReminder(student)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-xs"
                          >
                            <MessageSquare size={12} />
                            <span>WhatsApp</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

    </div>
  );
}