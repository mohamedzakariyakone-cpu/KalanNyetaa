'use client';

import React from 'react';

export type SubjectLanguage = 'fr' | 'ar';

export interface BulletinNoteItem {
  name: string;
  language: SubjectLanguage;
  noteClasse: number | null;
  noteCompo: number | null;
  moyenneMatiere: number | null;
  coeff: number;
  points: number;
  isExempt: boolean;
}

export interface BulletinStudentData {
  id: string | number;
  first_name: string;
  last_name: string;
  notes: BulletinNoteItem[];
  notesFr: BulletinNoteItem[];
  notesAr: BulletinNoteItem[];
  moyenne: number;
  totalPoints: number;
  totalCoeffs: number;
  rang: number;
  moyenneFr: number;
  totalPointsFr: number;
  totalCoeffsFr: number;
  rangFr: number;
  moyenneAr: number;
  totalPointsAr: number;
  totalCoeffsAr: number;
  rangAr: number;
}

interface FrancoArabicBulletinPdfProps {
  student: BulletinStudentData;
  school: any;
  classNameLabel: string;
  period: string;
  year: string;
  isSecondCycle: boolean;
  baseScale: number;
  totalStudents: number;
  isCombined: boolean;
  getMention: (m: number) => string;
  getAppreciation: (note: number | null, isExempt?: boolean) => string;
}

export function getArabicMention(m: number, baseScale: number): string {
  const ratio = m / baseScale;
  if (ratio >= 0.8) return 'ممتاز';
  if (ratio >= 0.7) return 'جيد جداً';
  if (ratio >= 0.6) return 'جيد';
  if (ratio >= 0.5) return 'مقبول';
  return 'ناقص';
}

export function getArabicAppreciation(note: number | null, baseScale: number, isExempt?: boolean): string {
  if (isExempt || note === null) return 'معفى (مبرر)';
  const ratio = note / baseScale;
  if (ratio >= 0.9) return 'عمل ممتاز';
  if (ratio >= 0.8) return 'جيد جداً';
  if (ratio >= 0.7) return 'جيد';
  if (ratio >= 0.6) return 'مستحسن';
  if (ratio >= 0.5) return 'مقبول، مزيد من الجهد';
  if (ratio >= 0.4) return 'ناقص، يجب الاجتهاد';
  if (ratio >= 0.25) return 'ضعيف، انتبه';
  return 'ضعيف جداً';
}

export function translatePeriodToArabic(period: string): string {
  const normalized = period.trim().toLowerCase();
  const map: Record<string, string> = {
    '1er trimestre': 'الفصل الأول',
    '2e trimestre': 'الفصل الثاني',
    '3e trimestre': 'الفصل الثالث',
    'examen final': 'الامتحان النهائي',
    'composition du mois de janvier': 'اختبار شهر يناير',
    'composition du mois de février': 'اختبار شهر فبراير',
    'composition du mois de mars': 'اختبار شهر مارس',
    "composition du mois d'avril": 'اختبار شهر أبريل',
    'composition du mois de mai': 'اختبار شهر مايو',
    'composition du mois de juin': 'اختبار شهر يونيو',
    'composition du mois de juillet': 'اختبار شهر يوليو',
    "composition du mois d'août": 'اختبار شهر أغسطس',
    'composition du mois de septembre': 'اختبار شهر سبتمبر',
    "composition du mois d'octobre": 'اختبار شهر أكتوبر',
    'composition du mois de novembre': 'اختبار شهر نوفمبر',
    'composition du mois de décembre': 'اختبار شهر ديسمبر',
  };
  return map[normalized] || period;
}

const ARABIC_FONT_STACK = '"Cairo", "Noto Naskh Arabic", "Tahoma", "Segoe UI", "Arial", sans-serif';
const LATIN_FONT_STACK = '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';

export default function FrancoArabicBulletinPdf({
  student: s,
  school,
  classNameLabel,
  period,
  year,
  isSecondCycle,
  baseScale,
  totalStudents,
  isCombined,
  getMention,
  getAppreciation,
}: FrancoArabicBulletinPdfProps) {
  const passThreshold = isSecondCycle ? 10 : 5;
  const arabicPeriod = translatePeriodToArabic(period);
  const maxRowsCount = Math.max(s.notesFr.length, s.notesAr.length);
  const compactTable = maxRowsCount > 8;
  const cellPad = compactTable ? '4px 6px' : '6px 8px';
  const cellFontSize = compactTable ? '9.5px' : '10.5px';

  return (
    <div
      id={`bulletin-pdf-${s.id}`}
      style={{
        width: '297mm',
        minHeight: '210mm',
        padding: '9mm 9mm',
        background: '#ffffff',
        color: '#0f172a',
        fontFamily: LATIN_FONT_STACK,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        pageBreakAfter: 'always',
        breakAfter: 'page',
        pageBreakInside: 'avoid',
      }}
    >
      {/* ZONE PRINCIPALE : DEUX BULLETINS CÔTE À CÔTE (GAUCHE = FRANÇAIS, DROITE = ARABE) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: '7mm',
          flex: 1,
        }}
      >
        {/* ============================================================ */}
        {/* VOLET GAUCHE : BULLETIN FRANÇAIS (LTR)                       */}
        {/* ============================================================ */}
        <div
          dir="ltr"
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 14px',
            background: '#ffffff',
          }}
        >
          <div>
            {/* En-tête Français */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', borderBottom: '2px solid #1763FF', paddingBottom: '8px' }}>
              <div style={{ maxWidth: '58%' }}>
                <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#1763FF', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                  {school?.name || 'École'}
                </h1>
                {(school?.academie || school?.rive) && (
                  <p style={{ margin: '3px 0 0 0', fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b', fontWeight: 700 }}>
                    {school?.academie || ''} {school?.rive ? `• ${school.rive}` : ''}
                  </p>
                )}
                {school?.cap && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '8.5px', textTransform: 'uppercase', color: '#94a3b8' }}>
                    {school.cap}
                  </p>
                )}
                {(school?.address || school?.city || school?.phone) && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '8px', color: '#94a3b8' }}>
                    {school?.address || ''}{school?.city ? `, ${school.city}` : ''}{school?.phone ? ` • ${school.phone}` : ''}
                  </p>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-block', background: '#1763FF', color: '#ffffff', padding: '4px 10px', borderRadius: '999px', fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
                  Bulletin Français
                </div>
                <p style={{ margin: 0, fontSize: '9.5px', fontWeight: 700, color: '#334155' }}>
                  {period}
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#64748b' }}>
                  Année : {year}
                </p>
              </div>
            </div>

            {/* Carte Identité Élève (FR) */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '8px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.6px' }}>
                  Élève
                </p>
                <h2 style={{ margin: '2px 0 0 0', fontSize: '13.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                  {s.first_name} {s.last_name}
                </h2>
                <p style={{ margin: '3px 0 0 0', fontSize: '9.5px', color: '#475569' }}>
                  <strong style={{ color: '#0f172a' }}>Classe :</strong> {classNameLabel} &nbsp;•&nbsp; <strong style={{ color: '#0f172a' }}>Cycle :</strong> {isSecondCycle ? '2nd Cycle' : '1er Cycle'}
                </p>
              </div>
              <div style={{ textAlign: 'center', background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #dbeafe', flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: '8px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                  Rang FR
                </p>
                <p style={{ margin: '1px 0 0 0', fontSize: '15px', fontWeight: 900, color: '#1763FF', lineHeight: 1.1 }}>
                  {s.totalCoeffsFr > 0 ? s.rangFr : '—'}
                  <span style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 600 }}> / {totalStudents}</span>
                </p>
              </div>
            </div>

            {/* Tableau Matières Françaises */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
              <thead>
                <tr>
                  <th style={{ background: '#eff6ff', color: '#1e3a8a', padding: cellPad, textAlign: 'left', fontSize: '8.5px', textTransform: 'uppercase', fontWeight: 800, borderBottom: '1.5px solid #bfdbfe' }}>
                    Matière
                  </th>
                  <th style={{ background: '#eff6ff', color: '#1e3a8a', padding: cellPad, textAlign: 'center', fontSize: '8.5px', textTransform: 'uppercase', fontWeight: 800, borderBottom: '1.5px solid #bfdbfe' }}>
                    Cf
                  </th>
                  {isSecondCycle && (
                    <th style={{ background: '#eff6ff', color: '#1e3a8a', padding: cellPad, textAlign: 'center', fontSize: '8.5px', textTransform: 'uppercase', fontWeight: 800, borderBottom: '1.5px solid #bfdbfe' }}>
                      Cl.
                    </th>
                  )}
                  {isSecondCycle && (
                    <th style={{ background: '#eff6ff', color: '#1e3a8a', padding: cellPad, textAlign: 'center', fontSize: '8.5px', textTransform: 'uppercase', fontWeight: 800, borderBottom: '1.5px solid #bfdbfe' }}>
                      Cp.
                    </th>
                  )}
                  <th style={{ background: '#eff6ff', color: '#1e3a8a', padding: cellPad, textAlign: 'center', fontSize: '8.5px', textTransform: 'uppercase', fontWeight: 800, borderBottom: '1.5px solid #bfdbfe' }}>
                    Moy/{baseScale}
                  </th>
                  <th style={{ background: '#eff6ff', color: '#1e3a8a', padding: cellPad, textAlign: 'center', fontSize: '8.5px', textTransform: 'uppercase', fontWeight: 800, borderBottom: '1.5px solid #bfdbfe' }}>
                    Pts
                  </th>
                  <th style={{ background: '#eff6ff', color: '#1e3a8a', padding: cellPad, textAlign: 'left', fontSize: '8.5px', textTransform: 'uppercase', fontWeight: 800, borderBottom: '1.5px solid #bfdbfe' }}>
                    Appréciation
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.notesFr.length === 0 ? (
                  <tr>
                    <td colSpan={isSecondCycle ? 7 : 5} style={{ padding: '14px', textAlign: 'center', fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>
                      Aucune matière française configurée
                    </td>
                  </tr>
                ) : (
                  s.notesFr.map((n, idx) => (
                    <tr key={n.name} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: cellPad, borderBottom: '1px solid #f1f5f9', fontSize: cellFontSize, fontWeight: 700, color: '#1e293b' }}>
                        {n.name}
                      </td>
                      <td style={{ padding: cellPad, borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: cellFontSize, color: '#64748b' }}>
                        {n.isExempt ? '—' : n.coeff}
                      </td>
                      {isSecondCycle && (
                        <td style={{ padding: cellPad, borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: cellFontSize, color: '#64748b' }}>
                          {n.isExempt ? '—' : n.noteClasse}
                        </td>
                      )}
                      {isSecondCycle && (
                        <td style={{ padding: cellPad, borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: cellFontSize, color: '#64748b' }}>
                          {n.isExempt ? '—' : n.noteCompo}
                        </td>
                      )}
                      <td style={{ padding: cellPad, borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: cellFontSize, fontWeight: 800, color: n.isExempt ? '#94a3b8' : '#0f172a' }}>
                        {n.isExempt ? '—' : n.moyenneMatiere}
                      </td>
                      <td style={{ padding: cellPad, borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: cellFontSize, color: '#64748b' }}>
                        {n.isExempt ? '—' : n.points.toFixed(2)}
                      </td>
                      <td style={{ padding: cellPad, borderBottom: '1px solid #f1f5f9', fontSize: '9px', fontStyle: 'italic', color: '#475569' }}>
                        {getAppreciation(n.moyenneMatiere, n.isExempt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pied de volet Français : Totaux & Signatures */}
          <div>
            <div style={{ background: '#f8fafc', border: '1px solid #dbeafe', borderRadius: '8px', padding: '8px 10px', marginBottom: isCombined ? '0px' : '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', paddingBottom: '5px', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Total Pondéré FR (Coeff. {s.totalCoeffsFr})
                </span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>
                  {s.totalPointsFr.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', display: 'block' }}>
                    Moyenne Française
                  </span>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '3px',
                      background: s.moyenneFr >= passThreshold ? '#dcfce7' : '#fee2e2',
                      color: s.moyenneFr >= passThreshold ? '#166534' : '#991b1b',
                      padding: '2px 8px',
                      borderRadius: '5px',
                      fontSize: '8.5px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.totalCoeffsFr > 0 ? getMention(s.moyenneFr) : 'Non évalué'}
                  </span>
                </div>
                <span style={{ fontSize: '20px', fontWeight: 900, color: '#1763FF', lineHeight: 1 }}>
                  {s.totalCoeffsFr > 0 ? s.moyenneFr : '—'}
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>/{baseScale}</span>
                </span>
              </div>
            </div>

            {!isCombined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', minHeight: '28px' }}>
                <span style={{ fontSize: '8.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Signature des parents
                </span>
                <span style={{ fontSize: '8.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Le Directeur des Études
                </span>
              </div>
            )}
          </div>
        </div>

        {/* SÉPARATEUR VERTICAL CENTRAL */}
        <div style={{ width: '0px', borderLeft: '1.5px dashed #cbd5e1', alignSelf: 'stretch' }} />

        {/* ============================================================ */}
        {/* VOLET DROIT : BULLETIN ARABE (RTL)                           */}
        {/* ============================================================ */}
        <div
          dir="rtl"
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px solid #d1fae5',
            borderRadius: '10px',
            padding: '12px 14px',
            background: '#ffffff',
            fontFamily: ARABIC_FONT_STACK,
            letterSpacing: '0px',
          }}
        >
          <div>
            {/* En-tête Arabe */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', borderBottom: '2px solid #047857', paddingBottom: '8px' }}>
              <div style={{ maxWidth: '58%', textAlign: 'right' }}>
                <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#047857', letterSpacing: '0px', lineHeight: 1.25 }}>
                  {school?.name || 'المدرسة'}
                </h1>
                {(school?.academie || school?.rive) && (
                  <p style={{ margin: '3px 0 0 0', fontSize: '9px', color: '#64748b', fontWeight: 700, letterSpacing: '0px' }}>
                    {school?.academie || ''} {school?.rive ? `• ${school.rive}` : ''}
                  </p>
                )}
                {school?.cap && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '8.5px', color: '#94a3b8', letterSpacing: '0px' }}>
                    {school.cap}
                  </p>
                )}
                {(school?.address || school?.city || school?.phone) && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '8px', color: '#94a3b8', letterSpacing: '0px' }}>
                    {school?.address || ''}{school?.city ? `، ${school.city}` : ''}{school?.phone ? ` • ${school.phone}` : ''}
                  </p>
                )}
              </div>

              <div style={{ textAlign: 'left' }}>
                <div style={{ display: 'inline-block', background: '#047857', color: '#ffffff', padding: '4px 10px', borderRadius: '999px', fontSize: '10px', fontWeight: 800, letterSpacing: '0px', marginBottom: '4px' }}>
                  كشف النقاط العربي
                </div>
                <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: '#334155', letterSpacing: '0px' }}>
                  {arabicPeriod}
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#64748b', letterSpacing: '0px' }}>
                  السنة الدراسية: {year}
                </p>
              </div>
            </div>

            {/* Carte Identité Élève (AR) */}
            <div style={{ background: '#f8fafc', border: '1px solid #d1fae5', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ minWidth: 0, textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '8.5px', color: '#64748b', fontWeight: 700, letterSpacing: '0px' }}>
                  اسم التلميذ(ة)
                </p>
                <h2 style={{ margin: '2px 0 0 0', fontSize: '13.5px', fontWeight: 800, color: '#0f172a', letterSpacing: '0px' }}>
                  {s.first_name} {s.last_name}
                </h2>
                <p style={{ margin: '3px 0 0 0', fontSize: '9.5px', color: '#475569', letterSpacing: '0px' }}>
                  <strong style={{ color: '#0f172a' }}>القسم:</strong> {classNameLabel} &nbsp;•&nbsp; <strong style={{ color: '#0f172a' }}>الطور:</strong> {isSecondCycle ? 'الطور الثاني' : 'الطور الأول'}
                </p>
              </div>
              <div style={{ textAlign: 'center', background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #a7f3d0', flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: '8.5px', color: '#64748b', fontWeight: 700, letterSpacing: '0px' }}>
                  الرتبة
                </p>
                <p style={{ margin: '1px 0 0 0', fontSize: '15px', fontWeight: 900, color: '#047857', lineHeight: 1.1, letterSpacing: '0px' }}>
                  {s.totalCoeffsAr > 0 ? s.rangAr : '—'}
                  <span style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 600 }}> / {totalStudents}</span>
                </p>
              </div>
            </div>

            {/* Tableau Matières Arabes */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
              <thead>
                <tr>
                  <th style={{ background: '#ecfdf5', color: '#065f46', padding: cellPad, textAlign: 'right', fontSize: '9.5px', fontWeight: 800, borderBottom: '1.5px solid #a7f3d0', letterSpacing: '0px' }}>
                    المادة
                  </th>
                  <th style={{ background: '#ecfdf5', color: '#065f46', padding: cellPad, textAlign: 'center', fontSize: '9.5px', fontWeight: 800, borderBottom: '1.5px solid #a7f3d0', letterSpacing: '0px' }}>
                    المعامل
                  </th>
                  {isSecondCycle && (
                    <th style={{ background: '#ecfdf5', color: '#065f46', padding: cellPad, textAlign: 'center', fontSize: '9.5px', fontWeight: 800, borderBottom: '1.5px solid #a7f3d0', letterSpacing: '0px' }}>
                      القسم
                    </th>
                  )}
                  {isSecondCycle && (
                    <th style={{ background: '#ecfdf5', color: '#065f46', padding: cellPad, textAlign: 'center', fontSize: '9.5px', fontWeight: 800, borderBottom: '1.5px solid #a7f3d0', letterSpacing: '0px' }}>
                      الاختبار
                    </th>
                  )}
                  <th style={{ background: '#ecfdf5', color: '#065f46', padding: cellPad, textAlign: 'center', fontSize: '9.5px', fontWeight: 800, borderBottom: '1.5px solid #a7f3d0', letterSpacing: '0px' }}>
                    المعدل/{baseScale}
                  </th>
                  <th style={{ background: '#ecfdf5', color: '#065f46', padding: cellPad, textAlign: 'center', fontSize: '9.5px', fontWeight: 800, borderBottom: '1.5px solid #a7f3d0', letterSpacing: '0px' }}>
                    المجموع
                  </th>
                  <th style={{ background: '#ecfdf5', color: '#065f46', padding: cellPad, textAlign: 'right', fontSize: '9.5px', fontWeight: 800, borderBottom: '1.5px solid #a7f3d0', letterSpacing: '0px' }}>
                    التقدير
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.notesAr.length === 0 ? (
                  <tr>
                    <td colSpan={isSecondCycle ? 7 : 5} style={{ padding: '14px', textAlign: 'center', fontSize: '10.5px', color: '#94a3b8', letterSpacing: '0px' }}>
                      لا توجد مواد عربية مضافة
                    </td>
                  </tr>
                ) : (
                  s.notesAr.map((n, idx) => (
                    <tr key={n.name} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: cellPad, borderBottom: '1px solid #f1f5f9', fontSize: cellFontSize, fontWeight: 700, color: '#1e293b', textAlign: 'right', letterSpacing: '0px' }}>
                        {n.name}
                      </td>
                      <td style={{ padding: cellPad, borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: cellFontSize, color: '#64748b' }}>
                        {n.isExempt ? '—' : n.coeff}
                      </td>
                      {isSecondCycle && (
                        <td style={{ padding: cellPad, borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: cellFontSize, color: '#64748b' }}>
                          {n.isExempt ? '—' : n.noteClasse}
                        </td>
                      )}
                      {isSecondCycle && (
                        <td style={{ padding: cellPad, borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: cellFontSize, color: '#64748b' }}>
                          {n.isExempt ? '—' : n.noteCompo}
                        </td>
                      )}
                      <td style={{ padding: cellPad, borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: cellFontSize, fontWeight: 800, color: n.isExempt ? '#94a3b8' : '#0f172a' }}>
                        {n.isExempt ? '—' : n.moyenneMatiere}
                      </td>
                      <td style={{ padding: cellPad, borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: cellFontSize, color: '#64748b' }}>
                        {n.isExempt ? '—' : n.points.toFixed(2)}
                      </td>
                      <td style={{ padding: cellPad, borderBottom: '1px solid #f1f5f9', fontSize: '9.5px', color: '#475569', textAlign: 'right', letterSpacing: '0px' }}>
                        {getArabicAppreciation(n.moyenneMatiere, baseScale, n.isExempt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pied de volet Arabe : Totaux & Signatures */}
          <div>
            <div style={{ background: '#f8fafc', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '8px 10px', marginBottom: isCombined ? '0px' : '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', paddingBottom: '5px', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', letterSpacing: '0px' }}>
                  مجموع النقاط (مجموع المعاملات: {s.totalCoeffsAr})
                </span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>
                  {s.totalPointsAr.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#0f172a', display: 'block', letterSpacing: '0px' }}>
                    المعدل العربي
                  </span>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '3px',
                      background: s.moyenneAr >= passThreshold ? '#dcfce7' : '#fee2e2',
                      color: s.moyenneAr >= passThreshold ? '#166534' : '#991b1b',
                      padding: '2px 8px',
                      borderRadius: '5px',
                      fontSize: '9px',
                      fontWeight: 800,
                      letterSpacing: '0px',
                    }}
                  >
                    {s.totalCoeffsAr > 0 ? getArabicMention(s.moyenneAr, baseScale) : 'غير مقيم'}
                  </span>
                </div>
                <span dir="ltr" style={{ fontSize: '20px', fontWeight: 900, color: '#047857', lineHeight: 1 }}>
                  {s.totalCoeffsAr > 0 ? s.moyenneAr : '—'}
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>/{baseScale}</span>
                </span>
              </div>
            </div>

            {!isCombined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', minHeight: '28px' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#64748b', letterSpacing: '0px' }}>
                  توقيع الولي
                </span>
                <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#64748b', letterSpacing: '0px' }}>
                  مدير الدراسات
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* BANDEAU SYNTHÈSE COMBINÉE (UNIQUEMENT SI OPTION ACTIVÉE)     */}
      {/* ============================================================ */}
      {isCombined && (
        <div style={{ marginTop: '5mm' }}>
          <div
            style={{
              background: '#f8fafc',
              border: '1.5px solid #0f172a',
              borderRadius: '8px',
              padding: '8px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            {/* Titre FR */}
            <div>
              <p style={{ margin: 0, fontSize: '9.5px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Résultat Général Combiné (FR + AR)
              </p>
              <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#64748b', fontWeight: 600 }}>
                Total Pondéré : <strong style={{ color: '#0f172a' }}>{s.totalPoints.toFixed(2)}</strong> &nbsp;•&nbsp; Coeff. Total : <strong style={{ color: '#0f172a' }}>{s.totalCoeffs}</strong>
              </p>
            </div>

            {/* Indicateurs Centraux */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ textAlign: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 12px' }}>
                <span style={{ display: 'block', fontSize: '7.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Moyenne Générale
                </span>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                  {s.moyenne}
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>/{baseScale}</span>
                </span>
              </div>

              <div style={{ textAlign: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 12px' }}>
                <span style={{ display: 'block', fontSize: '7.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Rang Global
                </span>
                <span style={{ fontSize: '16px', fontWeight: 900, color: '#1763FF', lineHeight: 1.1 }}>
                  {s.rang}
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}> / {totalStudents}</span>
                </span>
              </div>

              <div
                style={{
                  background: s.moyenne >= passThreshold ? '#dcfce7' : '#fee2e2',
                  color: s.moyenne >= passThreshold ? '#166534' : '#991b1b',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  textAlign: 'center',
                }}
              >
                <span style={{ display: 'block', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase' }}>
                  {getMention(s.moyenne)}
                </span>
                <span dir="rtl" style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, fontFamily: ARABIC_FONT_STACK, letterSpacing: '0px' }}>
                  {getArabicMention(s.moyenne, baseScale)}
                </span>
              </div>
            </div>

            {/* Titre AR */}
            <div dir="rtl" style={{ textAlign: 'right', fontFamily: ARABIC_FONT_STACK, letterSpacing: '0px' }}>
              <p style={{ margin: 0, fontSize: '10.5px', fontWeight: 900, color: '#0f172a' }}>
                النتيجة العامة المدمجة
              </p>
              <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#64748b', fontWeight: 700 }}>
                فرنسي + عربي
              </p>
            </div>
          </div>

          {/* Signatures unifiées en bas de page combinée */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4mm', padding: '0 6px' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Signature des parents &nbsp;/&nbsp; <span style={{ fontFamily: ARABIC_FONT_STACK, letterSpacing: '0px' }}>توقيع الولي</span>
            </span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Le Directeur des Études &nbsp;/&nbsp; <span style={{ fontFamily: ARABIC_FONT_STACK, letterSpacing: '0px' }}>مدير الدراسات</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
