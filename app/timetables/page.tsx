"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { useYear } from '@/context/YearContext';
import { Loader2, Plus, Printer, Trash2, Calendar, Clock, BookOpen, User, Home, AlertCircle } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  academic_year_id: number;
}

interface TimetableSlot {
  id?: string;
  class_id: string;
  academic_year_id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  subject_name: string;
  teacher_name?: string;
  classroom_number?: string;
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// Palette moderne : une couleur d'accent par jour (RGB natif, aucun lien avec Tailwind/CSS)
const DAY_COLORS: Record<string, [number, number, number]> = {
  Lundi:    [23, 99, 255],   // bleu
  Mardi:    [16, 163, 127],  // émeraude
  Mercredi: [245, 130, 32],  // orange
  Jeudi:    [147, 51, 234],  // violet
  Vendredi: [220, 38, 38],   // rouge
  Samedi:   [15, 118, 110],  // teal
};

export default function TimetablePage() {
  const { selectedYearId, selectedYear } = useYear();
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedClassName, setSelectedClassName] = useState<string>('');
  const [slots, setSlots] = useState<TimetableSlot[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    day_of_week: 'Lundi',
    start_time: '08:00',
    end_time: '10:00',
    subject_name: '',
    teacher_name: '',
    classroom_number: ''
  });

  const printRef = useRef<HTMLDivElement>(null); // conservé si besoin d'aperçu à l'écran, non utilisé pour le PDF

  const getCleanYearId = (): number | null => {
    if (selectedYearId === undefined || selectedYearId === null) return null;
    const parsed = parseInt(String(selectedYearId), 10);
    return isNaN(parsed) ? null : parsed;
  };

  const selectedYearLabel =
    (selectedYear && typeof selectedYear === 'object'
      ? (selectedYear as any).label || (selectedYear as any).name
      : selectedYear) || 'En cours';

  useEffect(() => {
    const fetchClasses = async () => {
      const currentYearId = getCleanYearId();
      if (!currentYearId) {
        setClasses([]);
        return;
      }
      setError('');
      try {
        const { data, error: err } = await supabase
          .from('classes')
          .select('id, name, academic_year_id')
          .eq('academic_year_id', currentYearId)
          .order('name');
        if (err) throw err;
        setClasses(data || []);
      } catch (e) {
        console.error(e);
        setError('Impossible de récupérer la liste des classes.');
      }
    };
    fetchClasses();
  }, [selectedYearId]);

  const fetchTimetable = React.useCallback(async () => {
    const currentYearId = getCleanYearId();
    if (!selectedClass || !currentYearId) return;

    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('class_timetables')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('academic_year_id', currentYearId)
        .order('start_time');

      if (err) throw err;
      setSlots(data || []);
    } catch (e: any) {
      console.error(e);
      setError('Erreur lors du chargement de l\'emploi du temps.');
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedYearId]);

  useEffect(() => {
    if (selectedClass) {
      const target = classes.find(c => c.id === selectedClass);
      setSelectedClassName(target ? target.name : '');
      fetchTimetable();
    } else {
      setSlots([]);
      setSelectedClassName('');
    }
  }, [selectedClass, classes, fetchTimetable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentYearId = getCleanYearId();
    if (!selectedClass || !currentYearId) {
      setError("Sélection de classe ou d'année invalide.");
      return;
    }
    if (!formData.subject_name.trim()) {
      setError('Le nom de la matière est obligatoire.');
      return;
    }

    setSaving(true);
    setError('');

    const formattedSlot: Omit<TimetableSlot, 'id'> = {
      class_id: selectedClass,
      academic_year_id: currentYearId,
      day_of_week: formData.day_of_week,
      start_time: `${formData.start_time}:00`,
      end_time: `${formData.end_time}:00`,
      subject_name: formData.subject_name.trim(),
      teacher_name: formData.teacher_name.trim() || undefined,
      classroom_number: formData.classroom_number.trim() || undefined,
    };

    try {
      const { error: insertError } = await supabase
        .from('class_timetables')
        .insert([formattedSlot]);

      if (insertError) throw insertError;

      setFormData(prev => ({
        ...prev,
        subject_name: '',
        teacher_name: '',
        classroom_number: ''
      }));

      await fetchTimetable();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Conflit d\'horaire ou erreur lors de l\'enregistrement du cours.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Voulez-vous supprimer ce créneau horaire ?')) return;
    try {
      const { error: err } = await supabase
        .from('class_timetables')
        .delete()
        .eq('id', id);

      if (err) throw err;
      await fetchTimetable();
    } catch (e) {
      console.error(e);
      setError('Impossible de supprimer le créneau.');
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
  };

  // ============================================================
  // EXPORT PDF — génération 100% vectorielle avec jsPDF.
  // Aucune capture DOM/canvas n'est utilisée : impossible de
  // rencontrer une erreur "oklch" puisqu'on ne lit jamais de CSS.
  // Toutes les couleurs sont des valeurs RGB natives à jsPDF.
  // ============================================================
  const exportPDF = async () => {
    if (!selectedClass || slots.length === 0) return;

    setExporting(true);
    setError('');

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      const PAGE_W = 297;
      const PAGE_H = 210;
      const MARGIN = 12;
      const CONTENT_W = PAGE_W - MARGIN * 2;
      const CONTENT_BOTTOM = PAGE_H - 16; // réserve la place du pied de page

      const DAY_LABEL_W = 28;
      const CARD_W = 56;
      const CARD_H = 19;
      const CARD_GAP = 3;
      const DAY_GAP = 4;

      let cursorY = MARGIN;

      const drawHeader = (title: string) => {
        doc.setFillColor(23, 99, 255);
        doc.roundedRect(MARGIN, cursorY, 16, 16, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('KN', MARGIN + 8, cursorY + 10.5, { align: 'center' });

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(15);
        doc.text('KALANNYETAA ACADEMY', MARGIN + 21, cursorY + 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("SYSTÈME D'EXCELLENCE PÉDAGOGIQUE", MARGIN + 21, cursorY + 10.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Mali • Gestion de Données Centralisée', MARGIN + 21, cursorY + 14.5);

        doc.setFillColor(241, 245, 249);
        const badgeText = title;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const badgeW = doc.getTextWidth(badgeText) + 10;
        doc.roundedRect(PAGE_W - MARGIN - badgeW, cursorY, badgeW, 7, 2, 2, 'F');
        doc.setTextColor(30, 41, 59);
        doc.text(badgeText, PAGE_W - MARGIN - badgeW / 2, cursorY + 4.8, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(`Classe : ${selectedClassName}`, PAGE_W - MARGIN, cursorY + 12, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Année Académique : ${selectedYearLabel}`, PAGE_W - MARGIN, cursorY + 16, { align: 'right' });

        cursorY += 20;
        doc.setDrawColor(23, 99, 255);
        doc.setLineWidth(0.8);
        doc.line(MARGIN, cursorY, PAGE_W - MARGIN, cursorY);
        cursorY += 6;
      };

      const drawFooter = () => {
        const y = PAGE_H - 10;
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, y - 3, PAGE_W - MARGIN, y - 3);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text("DOCUMENT GÉNÉRÉ AUTOMATIQUEMENT PAR L'APPLICATION KALANNYETAA", MARGIN, y);
        doc.text('DIRECTION DES ÉTUDES • CACHET ET SIGNATURE FONT FOI', PAGE_W - MARGIN, y, { align: 'right' });
      };

      drawHeader('EMPLOI DU TEMPS OFFICIEL');

      DAYS.forEach((day) => {
        const daySlots = slots
          .filter(s => s.day_of_week === day)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));

        const cardsAvailableW = CONTENT_W - DAY_LABEL_W - 4;
        const cardsPerRow = Math.max(1, Math.floor((cardsAvailableW + CARD_GAP) / (CARD_W + CARD_GAP)));
        const rowCount = daySlots.length === 0 ? 1 : Math.ceil(daySlots.length / cardsPerRow);
        const rowHeight = daySlots.length === 0
          ? 14
          : rowCount * CARD_H + (rowCount - 1) * CARD_GAP + 6;

        // Saut de page si le jour ne rentre pas
        if (cursorY + rowHeight > CONTENT_BOTTOM) {
          drawFooter();
          doc.addPage();
          cursorY = MARGIN;
          drawHeader('EMPLOI DU TEMPS (SUITE)');
        }

        const [r, g, b] = DAY_COLORS[day] || [30, 41, 59];

        // Bandeau du jour
        doc.setFillColor(r, g, b);
        doc.roundedRect(MARGIN, cursorY, DAY_LABEL_W, rowHeight, 2.5, 2.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(day.toUpperCase(), MARGIN + DAY_LABEL_W / 2, cursorY + rowHeight / 2 + 1, {
          align: 'center',
        });

        const cardsX0 = MARGIN + DAY_LABEL_W + 4;

        if (daySlots.length === 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text('Aucun cours programmé ce jour', cardsX0, cursorY + rowHeight / 2 + 1);
        } else {
          daySlots.forEach((slot, i) => {
            const col = i % cardsPerRow;
            const row = Math.floor(i / cardsPerRow);
            const cx = cardsX0 + col * (CARD_W + CARD_GAP);
            const cy = cursorY + 3 + row * (CARD_H + CARD_GAP);

            // Carte
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.25);
            doc.roundedRect(cx, cy, CARD_W, CARD_H, 2, 2, 'FD');

            // Liseré coloré à gauche (accent du jour)
            doc.setFillColor(r, g, b);
            doc.roundedRect(cx, cy, 1.4, CARD_H, 0.7, 0.7, 'F');

            // Horaires
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(r, g, b);
            doc.text(
              `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`,
              cx + 4,
              cy + 5.5
            );

            // Matière
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(30, 41, 59);
            const subject = slot.subject_name.length > 26
              ? slot.subject_name.substring(0, 24) + '…'
              : slot.subject_name;
            doc.text(subject.toUpperCase(), cx + 4, cy + 11);

            // Séparateur
            doc.setDrawColor(241, 245, 249);
            doc.setLineWidth(0.2);
            doc.line(cx + 3, cy + 13.5, cx + CARD_W - 3, cy + 13.5);

            // Enseignant / Salle
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.3);
            doc.setTextColor(100, 116, 139);
            const teacher = (slot.teacher_name || 'Enseignant');
            const teacherShort = teacher.length > 18 ? teacher.substring(0, 16) + '…' : teacher;
            doc.text(teacherShort, cx + 4, cy + 17.2);
            doc.text(slot.classroom_number || '-', cx + CARD_W - 4, cy + 17.2, { align: 'right' });
          });
        }

        cursorY += rowHeight + DAY_GAP;
      });

      drawFooter();

      doc.save(`Emploi_du_temps_${selectedClassName.replace(/\s+/g, '_')}.pdf`);
    } catch (e: any) {
      console.error(e);
      setError('Erreur lors de la génération du PDF. Réessayez.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Plannings & Emplois du temps</h1>
            <p className="text-xs font-bold text-slate-400 mt-0.5">Configuration et éditions officielles par classe</p>
          </div>
          {selectedClass && slots.length > 0 && (
            <button
              onClick={exportPDF}
              disabled={exporting}
              className="px-5 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 transition tracking-wider flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {exporting ? <Loader2 className="animate-spin" size={16} /> : <Printer size={16} />}
              {exporting ? 'Génération...' : "Imprimer l'Emploi du Temps PDF"}
            </button>
          )}
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="text-rose-500 shrink-0" size={20} />
            <p className="text-rose-800 text-xs font-black uppercase tracking-wider">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          <div className="space-y-4 lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Sélectionner une classe</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800 focus:outline-none transition border-none"
                >
                  <option value="">-- Choisir une classe --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>

              {selectedClass && (
                <form onSubmit={handleSubmit} className="pt-4 border-t border-slate-100 space-y-3">
                  <span className="text-[10px] font-black uppercase text-slate-700 block tracking-wide">Ajouter un cours</span>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Jour</label>
                    <select
                      value={formData.day_of_week}
                      onChange={(e) => setFormData({...formData, day_of_week: e.target.value})}
                      className="w-full p-2.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800 border-none"
                    >
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Début</label>
                      <input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                        className="w-full p-2.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800 border-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Fin</label>
                      <input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                        className="w-full p-2.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800 border-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Matière</label>
                    <input
                      type="text"
                      placeholder="Ex: Mathématiques"
                      value={formData.subject_name}
                      onChange={(e) => setFormData({...formData, subject_name: e.target.value})}
                      className="w-full p-2.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800 border-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Enseignant</label>
                    <input
                      type="text"
                      placeholder="Ex: M. Traoré"
                      value={formData.teacher_name}
                      onChange={(e) => setFormData({...formData, teacher_name: e.target.value})}
                      className="w-full p-2.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800 border-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Salle de classe</label>
                    <input
                      type="text"
                      placeholder="Ex: Salle A1"
                      value={formData.classroom_number}
                      onChange={(e) => setFormData({...formData, classroom_number: e.target.value})}
                      className="w-full p-2.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800 border-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full mt-2 py-3 bg-[#1763FF] text-white rounded-xl font-black uppercase text-[10px] tracking-wider flex items-center justify-center gap-2 hover:bg-[#1252D4] transition disabled:opacity-40"
                  >
                    {saving ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                    Ajouter au planning
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            {!selectedClass ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
                <Calendar className="mx-auto text-slate-300 mb-3" size={36} />
                <p className="text-xs font-black text-slate-400 uppercase tracking-wide">Veuillez sélectionner une classe pour configurer ou imprimer son planning</p>
              </div>
            ) : loading ? (
              <div className="flex justify-center items-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <Loader2 className="animate-spin text-[#1763FF]" size={32} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-4 tracking-wider">Aperçu interactif de la semaine</span>
                  <div className="space-y-4">
                    {DAYS.map((day) => {
                      const daySlots = slots.filter(s => s.day_of_week === day);
                      return (
                        <div key={day} className="border-b border-slate-50 pb-3 last:border-none last:pb-0">
                          <h4 className="text-xs font-black text-[#1763FF] uppercase tracking-wider mb-2">{day}</h4>
                          {daySlots.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic font-medium ml-2">Aucun cours programmé</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {daySlots.map((slot) => (
                                <div key={slot.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 relative group flex flex-col justify-between">
                                  <div>
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-[10px] font-mono font-black text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-100">
                                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                      </span>
                                      <button
                                        onClick={() => slot.id && handleDelete(slot.id)}
                                        className="text-slate-300 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-wide truncate">{slot.subject_name}</p>
                                  </div>
                                  <div className="mt-2 pt-2 border-t border-slate-200/50 flex justify-between text-[9px] font-bold text-slate-400">
                                    <span className="truncate max-w-[100px]">{slot.teacher_name || 'Non spécifié'}</span>
                                    <span>{slot.classroom_number || '-'}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}