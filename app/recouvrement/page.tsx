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

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve(); // ou reject si tu veux stricter
    });
  } catch {
    // silent fail volontaire
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

// ==========================================
// UTILITAIRES FORMATAGE
// ==========================================
function formatMontant(val: number): string {
  // Formatage sans séparateur /  — utiliser l'espace fine insécable unicode
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

  // ---- Couleurs palette ----
  const indigo = [67, 56, 202] as [number, number, number];
  const indigoLight = [238, 242, 255] as [number, number, number];
  const slate900 = [15, 23, 42] as [number, number, number];
  const slate600 = [71, 85, 105] as [number, number, number];
  const slate200 = [226, 232, 240] as [number, number, number];
  const emerald = [5, 150, 105] as [number, number, number];
  const rose = [225, 29, 72] as [number, number, number];
  const amber = [180, 83, 9] as [number, number, number];

  // ---- EN-TÊTE PRINCIPAL ----
  // Bandeau indigo haut
  doc.setFillColor(...indigo);
  doc.rect(0, 0, pageW, 42, 'F');

  // Nom de l'école (dynamique)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(schoolName.toUpperCase(), marginL, 14);

  // Sous-titre rapport
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(199, 210, 254);
  doc.text('RAPPORT DE RECOUVREMENT DES FRAIS DE SCOLARITÉ', marginL, 21);

  // Classe + Tranche
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`Classe : ${activeClassName}  —  Tranche N°${selectedTranche}`, marginL, 30);

  // Année & date à droite
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(199, 210, 254);
  doc.text(`Année : ${selectedYear}`, pageW - marginR, 14, { align: 'right' });
  doc.text(`Édité le ${today}`, pageW - marginR, 20, { align: 'right' });

  // Filtre actif
  const filterLabels: Record<string, string> = {
    all: 'Tous les élèves',
    EN_RETARD: 'En retard uniquement',
    INCOMPLET: 'Incomplet uniquement',
    EN_REGLE: 'En règle uniquement',
    TOTALEMENT_SOLDE: 'Année soldée uniquement'
  };
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(199, 210, 254);
  doc.text(`Filtre appliqué : ${filterLabels[statusFilter] || statusFilter}`, marginL, 38);

  // ---- BLOC STATISTIQUES (4 cartes) ----
  let y = 52;
  const cardW = (contentW - 9) / 4;

  const statCards = [
    { label: 'Attendu (T' + selectedTranche + ')', value: formatMontant(stats.globalAttendu) + ' FCFA', color: slate900 },
    { label: 'Perçu sur Tranche', value: formatMontant(stats.globalPercu) + ' FCFA', color: emerald },
    { label: 'Reste à recouvrer', value: formatMontant(stats.resteRecouvrer) + ' FCFA', color: rose },
    { label: 'Taux de recouvrement', value: stats.tauxRecouvrement.toFixed(1) + '%', color: indigo },
  ];

  statCards.forEach((card, i) => {
    const x = marginL + i * (cardW + 3);
    // Fond carte
    doc.setFillColor(...indigoLight);
    doc.roundedRect(x, y, cardW, 18, 2, 2, 'F');
    // Libellé
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...slate600);
    doc.text(card.label.toUpperCase(), x + 3, y + 6);
    // Valeur
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...card.color);
    doc.text(card.value, x + 3, y + 14);
  });

  // Comptage par statut
  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slate600);
  doc.text(
    `Élèves : ${filteredStudents.length} affichés  |  En retard : ${stats.retardCount}  |  Incomplet : ${stats.incompletCount}  |  En règle : ${stats.regleCount}  |  Soldé : ${stats.soldeCount}`,
    marginL, y
  );

  // ---- TABLEAU DES ÉLÈVES ----
  y += 6;

  const statusLabel = (s: string) => {
    if (s === 'TOTALEMENT_SOLDE') return 'Année Soldée';
    if (s === 'EN_REGLE') return 'En règle';
    if (s === 'INCOMPLET') return 'Tranche Incomplète';
    return 'En retard';
  };

  const statusColor = (s: string): [number, number, number] => {
    if (s === 'TOTALEMENT_SOLDE') return indigo;
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
      fillColor: indigo,
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
          const col = statusColor(student.statutTranche);
          data.cell.styles.textColor = col;
          data.cell.styles.fontStyle = 'bold';
        }
      }
      // Colorier colonne "Reste" en rouge si > 0
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

  // ---- PIED DE PAGE sur chaque page ----
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
// GÉNÉRATION PDF — AVIS AUX PARENTS (découpables, 8 par page)
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
  const pageW = doc.internal.pageSize.getWidth();  // 210mm
  const pageH = doc.internal.pageSize.getHeight(); // 297mm
  const today = todayFR();

  // 8 avis par page : 2 colonnes × 4 lignes
  const cols = 2;
  const rows = 4;
  const marginX = 8;   // marge gauche/droite page
  const marginY = 8;   // marge haut/bas page
  const gapX = 6;      // gouttière horizontale entre colonnes
  const gapY = 5;      // gouttière verticale entre lignes

  const avisW = (pageW - marginX * 2 - gapX) / cols;               // ~94mm
  const avisH = (pageH - marginY * 2 - gapY * (rows - 1)) / rows;  // ~65mm

  // Précalcul des positions (x, y) des 8 slots par page
  const positions: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      positions.push({
        x: marginX + c * (avisW + gapX),
        y: marginY + r * (avisH + gapY),
      });
    }
  }

  // Palette
  const indigo    = [67, 56, 202]   as [number, number, number];
  const rose      = [225, 29, 72]   as [number, number, number];
  const emerald   = [5, 150, 105]   as [number, number, number];
  const slate900  = [15, 23, 42]    as [number, number, number];
  const slate600  = [71, 85, 105]   as [number, number, number];
  const slate200  = [226, 232, 240] as [number, number, number];
  const amber50   = [255, 251, 235] as [number, number, number];
  const amberBdr  = [217, 119, 6]   as [number, number, number];

  let posIdx = 0;
  let firstPage = true;

  for (let i = 0; i < avisStudents.length; i++) {
    const student = avisStudents[i];

    // Nouvelle page tous les 8 avis
    if (posIdx === 0 && !firstPage) doc.addPage();
    firstPage = false;

    const { x, y } = positions[posIdx];

    // ---- Bordure + fond blanc ----
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...slate200);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, y, avisW, avisH, 2, 2, 'FD');

    // Trait de coupe pointillé
    doc.setDrawColor(185, 185, 185);
    doc.setLineWidth(0.15);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.roundedRect(x - 0.8, y - 0.8, avisW + 1.6, avisH + 1.6, 2, 2, 'D');
    doc.setLineDashPattern([], 0);

    // ---- Bandeau en-tête indigo ----
    const headerH = 13;
    doc.setFillColor(...indigo);
    doc.roundedRect(x, y, avisW, headerH, 2, 2, 'F');
    doc.setFillColor(...indigo);
    doc.rect(x, y + headerH - 3, avisW, 3, 'F'); // aplat coins bas

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(schoolName.toUpperCase(), x + 3, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(199, 210, 254);
    doc.text('AVIS DE RECOUVREMENT — À REMETTRE AUX PARENTS / TUTEURS', x + 3, y + 10);

    // Année scolaire à droite du bandeau
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(199, 210, 254);
    doc.text(String(selectedYear), x + avisW - 3, y + 5.5, { align: 'right' });
    

    // ---- Corps ----
    let cy = y + headerH + 3.5;

    // Titre "AVIS DE PAIEMENT"
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
    // Nom élève centré
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...slate900);
    const nomComplet = `${student.first_name} ${student.last_name}`.toUpperCase();
    doc.text(nomComplet, x + avisW / 2, cy, { align: 'center' });

    cy += 4.5;
    // Bloc financier (fond amber)
    const blocH = 17;
    doc.setFillColor(...amber50);
    doc.setDrawColor(...amberBdr);
    doc.setLineWidth(0.25);
    doc.roundedRect(x + 3, cy, avisW - 6, blocH, 1.5, 1.5, 'FD');

    const colLabel = x + 5;
    const colVal   = x + avisW - 5;
    const lh = 4.8;
    cy += 4;

    const rows2 = [
      { label: `Montant Tranche N°${selectedTranche}`, value: formatMontant(student.montantParTranche) + ' FCFA', highlight: false },
      { label: 'Total versé à ce jour',               value: formatMontant(student.scolarite_payee)    + ' FCFA', highlight: false },
      { label: 'Reste dû (cette tranche)',             value: formatMontant(student.resteAFinancerTranche) + ' FCFA', highlight: true  },
    ];

    rows2.forEach(row => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(...slate600);
      doc.text(row.label, colLabel, cy);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
     doc.setTextColor(row.highlight ? 244 : 15, row.highlight ? 63 : 23, row.highlight ? 94 : 42)
      doc.text(row.value, colVal, cy, { align: 'right' });
      cy += lh;
    });

    cy += 2;
    // Badge statut
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
    // Message court
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(4.8);
    doc.setTextColor(...slate600);
    const msg = `Merci de régulariser cette situation auprès de la comptabilité dans les meilleurs délais. — ${today}`;
    const msgLines = doc.splitTextToSize(msg, avisW - 8);
    doc.text(msgLines, x + avisW / 2, cy, { align: 'center' });

    cy += msgLines.length * 3.2 + 2;
    // Ligne signature
    doc.setDrawColor(...slate200);
    doc.setLineWidth(0.2);
    doc.line(x + 3, cy, x + avisW / 2 - 2, cy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.setTextColor(...slate600);
    doc.text('Signature parent / tuteur', x + 3, cy + 3);

    posIdx = (posIdx + 1) % 8;
  }

  // ---- Traits de coupe globaux sur chaque page ----
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(185, 185, 185);
    doc.setLineWidth(0.15);
    doc.setLineDashPattern([2, 2], 0);
    // Trait vertical central
    doc.line(pageW / 2, 4, pageW / 2, pageH - 4);
    // 3 traits horizontaux (entre les 4 lignes)
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
// COMPOSANT PRINCIPAL AVEC SUSPENSE
// ==========================================
export default function RecouvrementPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500 gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <p className="font-bold animate-pulse text-xs uppercase tracking-widest">Chargement du module recouvrement...</p>
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

  // Fermer le menu export au clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Récupération du nom de l'école depuis la table schools
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

  // Chargement des classes
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

  // Chargement des élèves
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

  // ====================================
  // LOGIQUE COEUR : CALCUL PAR TRANCHE
  // ====================================
  const processedStudents = useMemo((): ProcessedStudent[] => {
    return students
      // Exclure les élèves dont le plan de paiement ne comporte pas la tranche sélectionnée
      // Ex: un élève en 1 tranche n'apparaît PAS dans Tranche 2, 3 ou 4
      .filter(student => {
        const totalTranches = student.payment_plan_tranches || 3;
        return totalTranches >= selectedTranche;
      })
      .map(student => {
        const total = student.scolarite_totale;
        const paye = student.scolarite_payee;
        const totalTranches = student.payment_plan_tranches || 3;
        const montantParTranche = totalTranches > 0 ? total / totalTranches : total;

        // Cumul théorique attendu au seuil de la tranche sélectionnée
        const montantAttenduPourTrancheSelectionnee = montantParTranche * selectedTranche;
        // Cumul théorique attendu à la tranche précédente
        const montantAttenduTranchePrecedente = montantParTranche * (selectedTranche - 1);

        let statutTranche = 'EN_RETARD';
        let resteAFinancerTranche = Math.max(0, montantAttenduPourTrancheSelectionnee - paye);

        if (paye >= total) {
          // A soldé l'intégralité de l'année
          statutTranche = 'TOTALEMENT_SOLDE';
        } else if (paye >= montantAttenduPourTrancheSelectionnee) {
          // À jour ou en avance sur le cumul de cette tranche
          statutTranche = 'EN_REGLE';
        } else if (paye > montantAttenduTranchePrecedente && paye < montantAttenduPourTrancheSelectionnee) {
          // A versé quelque chose pour cette tranche mais pas le total requis
          statutTranche = 'INCOMPLET';
        } else {
          // Versement cumulé n'a pas dépassé le seuil de la tranche précédente → rien pour cette tranche
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

  // Élèves pour les avis parents = filteredStudents restreints aux statuts impayés
  // Respecte donc la recherche ET le filtre statut actif
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

  // ---- Badge statut ----
  const StatutBadge = ({ statut }: { statut: string }) => {
    const configs: Record<string, { label: string; cls: string }> = {
      TOTALEMENT_SOLDE: { label: 'Année Soldée ✓', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      EN_REGLE: { label: 'En règle', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      INCOMPLET: { label: 'Incomplet', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
      EN_RETARD: { label: 'En retard !', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    };
    const cfg = configs[statut] || configs['EN_RETARD'];
    return (
      <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-md border ${cfg.cls} whitespace-nowrap`}>
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-4 pb-28 pt-4">

      {/* ======== EN-TÊTE ======== */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-xl font-black text-slate-900 uppercase flex items-center gap-2 tracking-tight">
            <Layers className="text-indigo-600 shrink-0" size={22} />
            <span>Recouvrement</span>
          </h1>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5 hidden sm:block">
            Suivi des tranches de paiement, filtrage des impayés et relances parentales directes.
          </p>
        </div>

        {/* Bouton export — visible seulement si classe sélectionnée */}
        {classFilter && (
          <div className="relative shrink-0" ref={exportMenuRef}>
            <button
              onClick={() => setExportMenuOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wide shadow-sm shadow-indigo-500/20 transition-all"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Exporter</span>
              <ChevronDown size={12} className={`transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden z-50">
                <div className="p-2 space-y-1">
                  <button
                    onClick={handleExportRapport}
                    disabled={exportingRapport}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-indigo-50 transition-colors text-left group"
                  >
                    <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      {exportingRapport ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 group-hover:text-indigo-700">Rapport de recouvrement</p>
                      <p className="text-[10px] text-slate-500">Tableau filtré — PDF A4</p>
                    </div>
                  </button>

                  <button
                    onClick={handleExportAvis}
                    disabled={exportingAvis}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-rose-50 transition-colors text-left group"
                  >
                    <div className="h-9 w-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                      {exportingAvis ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 group-hover:text-rose-700">Avis aux parents</p>
                      <p className="text-[10px] text-slate-500">{retardStudents.length} élève(s) selon filtre actif — 8 par page</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======== SÉLECTION CLASSE — DESKTOP ======== */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-3">
        <label className="text-[10px] font-black uppercase text-indigo-600 tracking-widest flex items-center gap-1.5">
          <GraduationCap size={13} /> Classe à analyser
        </label>

        {/* Mobile : dropdown élégant */}
        <div className="sm:hidden">
          <button
            onClick={() => setMobileClassOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
          >
            <span>{activeClassName || 'Choisir une classe...'}</span>
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${mobileClassOpen ? 'rotate-180' : ''}`} />
          </button>

          {mobileClassOpen && (
            <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
              {loadingClasses ? (
                <div className="p-4 flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 size={14} className="animate-spin text-indigo-600" /> Chargement...
                </div>
              ) : (
                classes.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleClassSelect(c.id)}
                    className={`w-full text-left px-4 py-3 text-sm font-bold border-b border-slate-100 last:border-0 transition-colors ${
                      c.id === classFilter ? 'bg-indigo-600 text-white' : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {c.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Desktop : grille de boutons */}
        {loadingClasses ? (
          <div className="hidden sm:flex items-center gap-2 py-2 text-xs font-medium text-slate-500">
            <Loader2 className="animate-spin text-indigo-600" size={16} /> Chargement des classes...
          </div>
        ) : (
          <div className="hidden sm:grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {classes.map(c => {
              const isSelected = c.id === classFilter;
              return (
                <button
                  key={c.id}
                  onClick={() => handleClassSelect(c.id)}
                  className={`p-3 rounded-xl font-black text-xs uppercase tracking-wide border transition-all text-center ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/10'
                      : 'bg-slate-50 text-slate-700 border-slate-200/60 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ======== CONTENU SI CLASSE SÉLECTIONNÉE ======== */}
      {!classFilter ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <Filter className="mx-auto text-slate-300 mb-3" size={32} />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Choisissez une classe ci-dessus pour démarrer l'analyse.
          </p>
        </div>
      ) : (
        <>
          {/* ======== SÉLECTEUR TRANCHE (dynamique selon plans de la classe) ======== */}
          {(() => {
            // Nombre max de tranches parmi les élèves de la classe (max 4)
            const maxTranches = students.length > 0
              ? Math.min(Math.max(...students.map(s => s.payment_plan_tranches || 3)), 4)
              : 4;
            return (
              <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tranche à auditer</p>
                    <p className="text-sm font-bold text-slate-700 mt-0.5">
                      Classe : <span className="text-indigo-600 font-extrabold uppercase">{activeClassName}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                    {Array.from({ length: maxTranches }, (_, i) => i + 1).map(t => (
                      <button
                        key={t}
                        onClick={() => setSelectedTranche(t)}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                          selectedTranche === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        T{t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ======== STATS CARDS (scroll horizontal mobile) ======== */}
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 snap-x snap-mandatory">
            {[
              {
                icon: <DollarSign size={18} />, iconBg: 'bg-slate-100 text-slate-700',
                label: `Attendu (T${selectedTranche})`, value: formatMontant(stats.globalAttendu), unit: 'FCFA',
                valClass: 'text-slate-900'
              },
              {
                icon: <CheckCircle size={18} />, iconBg: 'bg-emerald-50 text-emerald-600',
                label: 'Perçu sur Tranche', value: formatMontant(stats.globalPercu), unit: 'FCFA',
                valClass: 'text-emerald-600'
              },
              {
                icon: <AlertTriangle size={18} />, iconBg: 'bg-rose-50 text-rose-600',
                label: 'Reste à recouvrer', value: formatMontant(stats.resteRecouvrer), unit: 'FCFA',
                valClass: 'text-rose-600'
              },
              {
                icon: <TrendingUp size={18} />, iconBg: 'bg-indigo-50 text-indigo-600',
                label: 'Taux recouvrement', value: `${stats.tauxRecouvrement.toFixed(1)}%`, unit: 'atteint',
                valClass: 'text-indigo-600'
              },
            ].map((card, i) => (
              <div key={i} className="flex-shrink-0 w-[160px] sm:w-auto snap-start bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${card.iconBg}`}>
                  {card.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-tight">{card.label}</p>
                  <p className={`text-sm font-black leading-tight mt-0.5 ${card.valClass}`}>
                    {card.value} <span className="text-[9px] text-slate-400 font-bold">{card.unit}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ======== FILTRES ET RECHERCHE ======== */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm space-y-3">
            {/* Champ recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Rechercher un élève..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 border border-transparent focus:border-indigo-200 transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filtres statut — scroll horizontal mobile */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { key: 'all', label: `Tous`, count: processedStudents.length, cls: 'bg-slate-900 text-white', inactiveCls: 'bg-slate-50 text-slate-600 hover:bg-slate-100' },
                { key: 'EN_RETARD', label: 'En retard', count: stats.retardCount, cls: 'bg-rose-600 text-white', inactiveCls: 'bg-rose-50 text-rose-700 hover:bg-rose-100', icon: <AlertTriangle size={11} /> },
                { key: 'INCOMPLET', label: 'Incomplet', count: stats.incompletCount, cls: 'bg-amber-500 text-white', inactiveCls: 'bg-amber-50 text-amber-700 hover:bg-amber-100', icon: <Clock size={11} /> },
                { key: 'EN_REGLE', label: 'En règle', count: stats.regleCount, cls: 'bg-emerald-600 text-white', inactiveCls: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100', icon: <CheckCircle size={11} /> },
                { key: 'TOTALEMENT_SOLDE', label: 'Soldé', count: stats.soldeCount, cls: 'bg-indigo-600 text-white', inactiveCls: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100', icon: <DollarSign size={11} /> },
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setStatusFilter(filter.key)}
                  className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                    statusFilter === filter.key
                      ? `${filter.cls} border-transparent`
                      : `${filter.inactiveCls} border-transparent`
                  }`}
                >
                  {filter.icon}
                  {filter.label}
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                    statusFilter === filter.key ? 'bg-white/20' : 'bg-white/60'
                  }`}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ======== LISTE DES ÉLÈVES ======== */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            {loadingStudents ? (
              <div className="p-12 text-center flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-indigo-600" size={28} />
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold animate-pulse">Chargement des données...</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="mx-auto text-slate-200 mb-3" size={32} />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Aucun élève dans cette catégorie.
                </p>
              </div>
            ) : (
              <>
                {/* DESKTOP : tableau */}
                <div className="hidden sm:block w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-100 text-[9px] uppercase font-black tracking-widest text-slate-400">
                      <tr>
                        <th className="px-5 py-3.5">Élève</th>
                        <th className="px-4 py-3.5 text-center">Plan</th>
                        <th className="px-4 py-3.5 text-right">Scolarité totale</th>
                        <th className="px-4 py-3.5 text-right">Total versé</th>
                        <th className="px-4 py-3.5 text-right">Reste T{selectedTranche}</th>
                        <th className="px-4 py-3.5 text-center">Statut</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredStudents.map(student => (
                        <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-4 font-bold text-slate-900">
                            {student.first_name} <span className="uppercase text-slate-700">{student.last_name}</span>
                          </td>
                          <td className="px-4 py-4 text-center font-semibold text-slate-500">
                            {student.payment_plan_tranches} tr.
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-slate-800">
                            {formatMontant(student.scolarite_totale)} F
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="inline-block bg-slate-100 px-2 py-1 rounded-md font-extrabold text-slate-700">
                              {formatMontant(student.scolarite_payee)} F
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right font-black">
                            {student.resteAFinancerTranche === 0
                              ? <span className="text-emerald-600">0 F ✓</span>
                              : <span className="text-rose-600">+{formatMontant(student.resteAFinancerTranche)} F</span>
                            }
                          </td>
                          <td className="px-4 py-4 text-center">
                            <StatutBadge statut={student.statutTranche} />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {student.parent_phone && (
                                <a
                                  href={`tel:${student.parent_phone}`}
                                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                                  title="Appeler"
                                >
                                  <Phone size={13} />
                                </a>
                              )}
                              <button
                                onClick={() => sendWhatsAppReminder(student)}
                                disabled={student.statutTranche === 'EN_REGLE' || student.statutTranche === 'TOTALEMENT_SOLDE'}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wide transition-all border ${
                                  student.statutTranche === 'EN_REGLE' || student.statutTranche === 'TOTALEMENT_SOLDE'
                                    ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm'
                                }`}
                              >
                                <MessageSquare size={11} /> Relancer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE : cartes empilées */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {filteredStudents.map(student => (
                    <div key={student.id} className="p-4 space-y-3">
                      {/* Ligne 1 : Nom + statut */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-black text-slate-900">
                            {student.first_name} <span className="uppercase">{student.last_name}</span>
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                            Plan : {student.payment_plan_tranches} tranches
                          </p>
                        </div>
                        <StatutBadge statut={student.statutTranche} />
                      </div>

                      {/* Ligne 2 : Montants */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-50 rounded-xl p-2.5">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Scolarité</p>
                          <p className="text-xs font-black text-slate-800 mt-0.5">{formatMontant(student.scolarite_totale)} F</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2.5">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Versé</p>
                          <p className="text-xs font-black text-emerald-700 mt-0.5">{formatMontant(student.scolarite_payee)} F</p>
                        </div>
                        <div className={`rounded-xl p-2.5 ${student.resteAFinancerTranche > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reste T{selectedTranche}</p>
                          <p className={`text-xs font-black mt-0.5 ${student.resteAFinancerTranche > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {student.resteAFinancerTranche === 0 ? '0 F ✓' : `+${formatMontant(student.resteAFinancerTranche)} F`}
                          </p>
                        </div>
                      </div>

                      {/* Ligne 3 : Actions */}
                      <div className="flex items-center gap-2">
                        {student.parent_phone && (
                          <a
                            href={`tel:${student.parent_phone}`}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
                          >
                            <Phone size={13} />
                            <span>Appeler</span>
                          </a>
                        )}
                        {(student.statutTranche === 'EN_RETARD' || student.statutTranche === 'INCOMPLET') && (
                          <button
                            onClick={() => sendWhatsAppReminder(student)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-colors shadow-sm"
                          >
                            <MessageSquare size={13} />
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

          {/* ======== BARRE STICKY MOBILE (résumé + export rapide) ======== */}
          <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-4 py-3 shadow-2xl">
            <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">T{selectedTranche} — {activeClassName}</p>
                <p className="text-xs font-black text-rose-600">{formatMontant(stats.resteRecouvrer)} FCFA à recouvrer</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportRapport}
                  disabled={exportingRapport}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/20"
                >
                  {exportingRapport ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                  <span>Rapport</span>
                </button>
                <button
                  onClick={handleExportAvis}
                  disabled={exportingAvis}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-xl text-xs font-black shadow-md shadow-rose-500/20"
                >
                  {exportingAvis ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
                  <span>Avis ({retardStudents.length})</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}