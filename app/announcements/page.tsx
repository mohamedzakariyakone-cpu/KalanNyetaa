"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { useYear } from '@/context/YearContext';
import { 
  Megaphone, 
  Calendar, 
  Pin, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  Users, 
  CheckCircle2, 
  Info,
  Sparkles
} from 'lucide-react';

interface Class {
  id: string; // UUID de la classe
  name: string;
}

interface Announcement {
  id: string; // UUID
  academic_year_id: number;
  title: string;
  content: string;
  type: 'announcement' | 'event' | 'holiday';
  target_audience: 'Tous' | 'Enseignants' | 'Classes';
  target_class_id: string | null;
  event_date: string | null;
  is_pinned: boolean;
  created_at: string;
  classes?: { name: string } | null; // Jointure Supabase
}

type AnnouncementFormData = {
  title: string;
  content: string;
  type: Announcement['type'];
  target_audience: Announcement['target_audience'];
  target_class_id: string;
  event_date: string;
  is_pinned: boolean;
};

export default function AnnouncementsPage() {
  const { selectedYearId, selectedYear } = useYear();
  const [classes, setClasses] = useState<Class[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  
  // États de chargement et messages
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getErrorMessage = (err: unknown) => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object' && Object.keys(err as Record<string, unknown>).length > 0) {
      return JSON.stringify(err, null, 2);
    }
    return 'Erreur inconnue';
  };

  // Formulaire de création réinitialisé avec les nouvelles options
  const [formData, setFormData] = useState<AnnouncementFormData>({
    title: '',
    content: '',
    type: 'announcement',
    target_audience: 'Tous',
    target_class_id: '',
    event_date: '',
    is_pinned: false
  });

  // Filtre actif pour la vue liste (Permet de filtrer par type d'annonce)
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Convertisseur d'ID d'année vers un entier valide (int8)
  const getCleanYearId = React.useCallback((): number | null => {
    if (selectedYearId === undefined || selectedYearId === null) return null;
    const parsed = parseInt(String(selectedYearId), 10);
    return isNaN(parsed) ? null : parsed;
  }, [selectedYearId]);

  // 1. Charger les classes disponibles pour l'année en cours (pour le ciblage)
  useEffect(() => {
    const fetchClasses = async () => {
      const currentYearId = getCleanYearId();
      if (!currentYearId) return;

      try {
        const { data, error: err } = await supabase
          .from('classes')
          .select('id, name')
          .eq('academic_year_id', currentYearId)
          .order('name');
        if (err) throw err;
        setClasses(data || []);
      } catch (e) {
        console.error(e);
        setError('Impossible de charger les classes pour le ciblage.');
      }
    };
    fetchClasses();
  }, [getCleanYearId]);

  // 2. Charger les annonces enrichies (avec tri par épinglage et jointure de classe)
  const fetchAnnouncements = React.useCallback(async () => {
    const currentYearId = getCleanYearId();
    if (!currentYearId) return;

    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('announcements')
        .select(`
          *,
          classes:target_class_id ( name )
        `)
        .eq('academic_year_id', currentYearId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (err) throw err;
      setAnnouncements(data || []);
    } catch (e) {
      console.error(e);
      setError(getErrorMessage(e) || 'Erreur lors de la récupération des annonces.');
    } finally {
      setLoading(false);
    }
  }, [getCleanYearId]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // 3. Soumettre une nouvelle annonce
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentYearId = getCleanYearId();

    if (!currentYearId) {
      setError("Aucune année académique valide sélectionnée.");
      return;
    }
    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Le titre et le contenu de l\'annonce sont obligatoires.');
      return;
    }
    if (formData.title.length > 150) {
      setError('Le titre ne doit pas dépasser 150 caractères.');
      return;
    }
    if (formData.target_audience === 'Classes' && !formData.target_class_id) {
      setError('Veuillez sélectionner la classe ciblée.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      academic_year_id: currentYearId,
      title: formData.title.trim(),
      content: formData.content.trim(),
      type: formData.type,
      target_audience: formData.target_audience,
      target_class_id: formData.target_audience === 'Classes' ? formData.target_class_id : null,
      event_date: formData.type === 'event' || formData.type === 'holiday' ? (formData.event_date || null) : null,
      is_pinned: formData.is_pinned
    };

    try {
      const { error: insertError } = await supabase
        .from('announcements')
        .insert([payload]);

      if (insertError) throw insertError;

      setSuccess('Votre annonce a bien été publiée.');
      setFormData({
        title: '',
        content: '',
        type: 'announcement',
        target_audience: 'Tous',
        target_class_id: '',
        event_date: '',
        is_pinned: false
      });
      
      await fetchAnnouncements();
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      console.error(e);
      setError(getErrorMessage(e) || 'Erreur lors de la création de la communication.');
    } finally {
      setSaving(false);
    }
  };

  // 4. Supprimer une annonce
  const handleDelete = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette annonce définitivement ?')) return;
    try {
      const { error: err } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (err) throw err;
      setSuccess('Annonce supprimée avec succès.');
      await fetchAnnouncements();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      console.error(e);
      setError(getErrorMessage(e) || 'Impossible de supprimer l\'annonce.');
    }
  };

  // Filtrage à la volée des annonces selon le type sélectionné dans les onglets
  const filteredAnnouncements = announcements.filter(ann => {
    if (activeFilter === 'all') return true;
    return ann.type === activeFilter;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header de la page */}
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Portail de Communication</h1>
          <p className="text-xs font-bold text-slate-400 mt-0.5">
            Année Académique : <span className="text-[#1763FF]">
              {typeof selectedYear === 'object' ? selectedYear?.label : (selectedYear || 'En cours')}
            </span>
          </p>
        </div>

        {/* Retours utilisateurs */}
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

        {/* Structure Principale en Grille */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Panneau de configuration / Envoi */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4 sticky top-6">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Sparkles className="text-[#1763FF]" size={18} />
                <span className="text-xs font-black uppercase text-slate-700 tracking-wide">Rédiger un nouveau message</span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                
                {/* 1. Nouveau Sélecteur de Type d'annonce */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Type de publication</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as AnnouncementFormData['type']})}
                    className="w-full p-2.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800 border-none focus:ring-2 focus:ring-[#1763FF]/20"
                  >
                    <option value="announcement">📢 Annonce Générale</option>
                    <option value="event">📅 Événement Officiel</option>
                    <option value="holiday">🏖️ Congés / Jour Férié</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Titre de la publication</label>
                  <input
                    type="text"
                    maxLength={150}
                    placeholder="Ex: Réunion Générale des Parents"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800 border-none focus:ring-2 focus:ring-[#1763FF]/20"
                  />
                  <div className="text-right text-[9px] text-slate-400 font-medium">
                    {formData.title.length}/150
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Cible de la communication</label>
                  <select
                    value={formData.target_audience}
                    onChange={(e) => setFormData({...formData, target_audience: e.target.value as Announcement['target_audience'], target_class_id: ''})}
                    className="w-full p-2.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800 border-none focus:ring-2 focus:ring-[#1763FF]/20"
                  >
                    <option value="Tous">🌍 Tout le monde (Tous)</option>
                    <option value="Enseignants">👨‍🏫 Enseignants uniquement</option>
                    <option value="Classes">🏫 Classes spécifiques</option>
                  </select>
                </div>

                {/* Champ Conditionnel : Choix de la classe si l'audience cible = 'Classes' */}
                {formData.target_audience === 'Classes' && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Sélectionner la classe visée</label>
                    <select
                      value={formData.target_class_id}
                      onChange={(e) => setFormData({...formData, target_class_id: e.target.value})}
                      className="w-full p-2.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800 border-none focus:ring-2 focus:ring-[#1763FF]/20"
                    >
                      <option value="">-- Choisir la classe --</option>
                      {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Champ Conditionnel : Date de l'événement si type = 'event' ou 'holiday' */}
                {(formData.type === 'event' || formData.type === 'holiday') && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Date planifiée</label>
                    <input
                      type="date"
                      value={formData.event_date}
                      onChange={(e) => setFormData({...formData, event_date: e.target.value})}
                      className="w-full p-2.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800 border-none focus:ring-2 focus:ring-[#1763FF]/20"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Contenu détaillé</label>
                  <textarea
                    rows={5}
                    placeholder="Saisissez ici les détails explicitement..."
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800 border-none resize-none focus:ring-2 focus:ring-[#1763FF]/20"
                  />
                </div>

                {/* Ajout de la Checkbox d'épinglage */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_pinned"
                    checked={formData.is_pinned}
                    onChange={(e) => setFormData({...formData, is_pinned: e.target.checked})}
                    className="rounded text-[#1763FF] border-slate-300 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="is_pinned" className="text-[10px] font-black uppercase text-slate-600 cursor-pointer select-none">
                    📌 Épingler cette annonce en haut
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full mt-2 py-3.5 bg-[#1763FF] text-white rounded-xl font-black uppercase text-[10px] tracking-wider flex items-center justify-center gap-2 hover:bg-[#1252D4] transition disabled:opacity-40"
                >
                  {saving ? <Loader2 className="animate-spin" size={14} /> : <Megaphone size={14} />}
                  Diffuser la communication
                </button>
              </form>
            </div>
          </div>

          {/* Liste et Fil d'actualité */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Barre d'onglets pour filtrer la liste par type */}
            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-1.5">
              {[
                { key: 'all', label: 'Toutes les publications' },
                { key: 'announcement', label: '📢 Annonces' },
                { key: 'event', label: '📅 Événements' },
                { key: 'holiday', label: '🏖️ Congés' }
              ].map(btn => (
                <button
                  key={btn.key}
                  onClick={() => setActiveFilter(btn.key)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${
                    activeFilter === btn.key 
                      ? 'bg-slate-800 text-white shadow-sm' 
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Corps d'affichage du flux */}
            {loading ? (
              <div className="flex justify-center items-center py-24 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <Loader2 className="animate-spin text-[#1763FF]" size={32} />
              </div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
                <Megaphone className="mx-auto text-slate-200 mb-3" size={40} />
                <p className="text-xs font-black text-slate-400 uppercase tracking-wide">
                  Aucune communication publiée dans cette section.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAnnouncements.map((ann) => {
                  // Couleurs dynamiques basées sur l'audience ou le type
                  const audienceColors = {
                    Tous: 'bg-blue-50 text-blue-600 border-blue-100',
                    Enseignants: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                    Classes: 'bg-amber-50 text-amber-600 border-amber-100'
                  }[ann.target_audience];

                  const typeEmoji = ann.type === 'announcement' ? '📢' : ann.type === 'event' ? '📅' : '🏖️';

                  return (
                    <div 
                      key={ann.id} 
                      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition relative group ${
                        ann.is_pinned ? 'border-amber-300 ring-2 ring-amber-400/10' : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      {/* En-tête de la carte */}
                      <div className="p-5 pb-3 flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            
                            {/* Tag Épinglé */}
                            {ann.is_pinned && (
                              <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                <Pin size={10} className="fill-amber-600" /> Important / Épinglé
                              </span>
                            )}

                            {/* Tag Audience Cible */}
                            <span className={`px-2.5 py-0.5 border rounded-lg text-[9px] font-black uppercase tracking-widest ${audienceColors}`}>
                              🎯 Cible : {ann.target_audience === 'Classes' ? `Classe (${ann.classes?.name || 'Inconnue'})` : ann.target_audience}
                            </span>
                          </div>

                          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide mt-2 break-words">
                            {typeEmoji} {ann.title}
                          </h3>
                        </div>

                        <button
                          onClick={() => handleDelete(ann.id)}
                          className="text-slate-300 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 lg:opacity-0 group-hover:opacity-100 transition shrink-0"
                          title="Supprimer la publication"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Contenu principal */}
                      <div className="px-5 pb-4">
                        <p className="text-xs text-slate-600 font-medium leading-relaxed whitespace-pre-line bg-slate-50/50 p-3.5 rounded-xl border border-slate-100/60">
                          {ann.content}
                        </p>
                      </div>

                      {/* Pied d'infos (Date de création + Date planifiée de l'événement s'il y a lieu) */}
                      <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[9px] font-bold text-slate-400">
                        <div className="flex items-center gap-1">
                          <Info size={11} className="text-slate-300" />
                          <span>Publié le {new Date(ann.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' })}</span>
                        </div>

                        {ann.event_date && (
                          <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-100 font-mono text-slate-700">
                            <Calendar size={11} className="text-[#1763FF]" />
                            <span className="uppercase font-black text-[9px]">Date Événement : {new Date(ann.event_date).toLocaleDateString('fr-FR')}</span>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}