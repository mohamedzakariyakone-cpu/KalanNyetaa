'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import NumericInput from '@/components/NumericInput';
import { 
  Save, Calendar, ShieldCheck, Store, 
  Loader2, Clock, Plus, Check, Settings
} from 'lucide-react';

const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", 
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

interface AcademicYear {
  id: string;
  name: string;
  label?: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

interface SchoolConfig {
  id: number;
  school_name: string;
  current_academic_year: string;
  current_month_index: number;
  registration_fee_default?: number;
  outfit_fee_default?: number;
  passing_grade?: number;
  is_registration_open?: boolean;
  [key: string]: any; 
}

export default function GlobalSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SchoolConfig | null>(null);
  
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [newYear, setNewYear] = useState({ label: '', start_date: '', end_date: '' });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { 
    async function initPage() {
      await Promise.all([fetchSettings(), fetchAcademicYears()]);
    }
    initPage();
  }, []);

  async function fetchSettings() {
    let { data, error } = await supabase.from('school_settings').select('*').eq('id', 1).maybeSingle();
    
    if (error || !data) {
      const initialConfig = { id: 1, school_name: "La Source", current_month_index: 1, current_academic_year: "" };
      const { data: newData, error: insertError } = await supabase.from('school_settings').insert(initialConfig).select().single();
      if (!insertError && newData) setConfig(newData);
    } else {
      setConfig(data);
    }
    setLoading(false);
  }

  async function fetchAcademicYears() {
    const { data, error } = await supabase.from('academic_years').select('*').order('created_at', { ascending: false });
    if (data) {
      setAcademicYears(data as AcademicYear[]);
    }
    if (error) {
      console.error("Erreur lors de la récupération des années scolaires:", error);
    }
  }

  async function handleAddYear(e: React.FormEvent) {
    e.preventDefault();
    if (!newYear.label || !newYear.start_date || !newYear.end_date) return;

    const payload = {
      name: newYear.label,
      start_date: newYear.start_date,
      end_date: newYear.end_date
    };

    const { error } = await supabase
      .from('academic_years')
      .insert([payload]);

    if (error) {
      alert("Erreur lors de l'ajout de l'année scolaire : " + error.message);
    } else {
      alert("✅ Année scolaire ajoutée avec succès !");
      setNewYear({ label: '', start_date: '', end_date: '' });
      setShowForm(false);
      fetchAcademicYears(); 
    }
  }

  async function toggleActiveYear(year: AcademicYear) {
    await supabase.from('academic_years').update({ is_current: false }).neq('id', year.id);
    const { error } = await supabase.from('academic_years').update({ is_current: true }).eq('id', year.id);

    if (!error && config) {
      setConfig({ ...config, current_academic_year: year.name });
      fetchAcademicYears();
      alert(`Année ${year.name} activée !`);
    } else {
      alert("Erreur lors de l'activation.");
    }
  }

  async function saveSettings() {
    if (!config) return;
    setSaving(true);
    
    const updates = {
      school_name: config.school_name,
      current_academic_year: config.current_academic_year,
      current_month_index: config.current_month_index,
      registration_fee_default: config.registration_fee_default,
      outfit_fee_default: config.outfit_fee_default,
      passing_grade: config.passing_grade,
      is_registration_open: config.is_registration_open,
      t1_start_month: config.t1_start_month,
      t1_end_month: config.t1_end_month,
      t2_start_month: config.t2_start_month,
      t2_end_month: config.t2_end_month,
      t3_start_month: config.t3_start_month,
      t3_end_month: config.t3_end_month,
    };

    const { error } = await supabase
      .from('school_settings')
      .update(updates)
      .eq('id', 1);

    if (error) {
      console.error("Erreur de sauvegarde:", error);
      alert("Erreur lors de l'enregistrement : " + error.message);
    } else {
      alert("✅ Configuration système mise à jour !");
    }
    setSaving(false);
  }

  if (loading || !config) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-3">
      <Loader2 className="animate-spin text-blue-600" size={28} />
      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Chargement du cockpit système...</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6 font-sans text-slate-900 antialiased pb-20">
      
      {/* 1. EN-TÊTE ÉPURÉ & PLAT */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Paramétrage Général</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Paramètres du système <Settings className="inline-block text-blue-600" size={20} />
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Établissement : <strong className="text-slate-800">{config.school_name}</strong> — Session active : <strong className="text-blue-600">{config.current_academic_year || 'Non définie'}</strong>
          </p>
        </div>

        <button 
          onClick={saveSettings} 
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95 disabled:opacity-40 self-start sm:self-auto"
        >
          {saving ? <Loader2 className="animate-spin" size={15}/> : <Save size={15} />}
          <span>Appliquer les changements</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* IDENTITÉ ÉTABLISSEMENT */}
        <div className="lg:col-span-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Store className="text-blue-600" size={18} />
            <h3 className="text-sm font-bold text-slate-900 uppercase">Établissement</h3>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Nom de l'école</label>
              <input 
                type="text" 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition"
                value={config.school_name || ''} 
                onChange={(e)=>setConfig({...config, school_name: e.target.value})}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Année scolaire active</label>
              <select 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-600 transition cursor-pointer"
                value={config.current_academic_year || ''} 
                onChange={(e)=>setConfig({...config, current_academic_year: e.target.value})}
              >
                <option value="" disabled>Sélectionner une année</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.name}>{y.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* GESTION DES ANNÉES SCOLAIRES */}
        <div className="lg:col-span-8 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="text-blue-600" size={18} />
              <h3 className="text-sm font-bold text-slate-900 uppercase">Années Scolaires</h3>
            </div>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                <Plus size={14} /> <span>Ajouter</span>
              </button>
            )}
          </div>

          {showForm && (
            <form onSubmit={handleAddYear} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in duration-150">
              <h4 className="text-xs font-bold uppercase text-slate-700">Nouvelle session</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 block">Nom (ex: 2026-2027)</label>
                  <input
                    type="text"
                    value={newYear.label}
                    onChange={(e) => setNewYear({ ...newYear, label: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-600"
                    placeholder="2026-2027"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 block">Date de début</label>
                  <input
                    type="date"
                    value={newYear.start_date}
                    onChange={(e) => setNewYear({ ...newYear, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-600"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 block">Date de fin</label>
                  <input
                    type="date"
                    value={newYear.end_date}
                    onChange={(e) => setNewYear({ ...newYear, end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-600"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {academicYears.length > 0 ? (
              academicYears.map((year) => (
                <div
                  key={year.id}
                  className={`flex justify-between items-center p-3.5 rounded-xl border transition ${
                    year.is_current ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200/80 bg-slate-50/50'
                  }`}
                >
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900">{year.name}</h4>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Du {new Date(year.start_date).toLocaleDateString('fr-FR')} au {new Date(year.end_date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div>
                    {year.is_current ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md uppercase">
                        <Check size={12} /> Actif
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleActiveYear(year)}
                        className="text-xs font-bold text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition"
                      >
                        Activer
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-xs font-medium text-slate-400 py-6">Aucune année scolaire trouvée.</p>
            )}
          </div>
        </div>

        {/* CALENDRIER DES TRANCHES */}
        <div className="lg:col-span-12 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="text-blue-600" size={18} />
            <h3 className="text-sm font-bold text-slate-900 uppercase">Calendrier des Tranches (Plan 3)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((num) => (
              <div key={num} className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="font-extrabold text-center text-blue-600 uppercase text-xs">Tranche {num}</p>
                <div className="space-y-2">
                  <select 
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none text-slate-800 cursor-pointer"
                    value={config[`t${num}_start_month`] ?? 0}
                    onChange={(e)=>setConfig({...config, [`t${num}_start_month`]: parseInt(e.target.value)})}
                  >
                    <option disabled>Mois de début</option>
                    {MOIS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select 
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none text-slate-800 cursor-pointer"
                    value={config[`t${num}_end_month`] ?? 0}
                    onChange={(e)=>setConfig({...config, [`t${num}_end_month`]: parseInt(e.target.value)})}
                  >
                    <option disabled>Mois de fin</option>
                    {MOIS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PLAN 9 MOIS ET TARIFS */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Calendar className="text-blue-600" size={18} />
              <h3 className="text-sm font-bold text-slate-900 uppercase">Échéance Mensuelle</h3>
            </div>
            <div className="text-center py-2">
              <span className="text-4xl font-black text-slate-900">{config.current_month_index}</span>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Mois en cours de règlement</p>
            </div>
            <input 
              type="range" min="1" max="9" className="w-full accent-blue-600 cursor-pointer py-2"
              value={config.current_month_index || 1}
              onChange={(e)=>setConfig({...config, current_month_index: parseInt(e.target.value)})}
            />
          </div>

          <div className="md:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldCheck className="text-blue-600" size={18} />
              <h3 className="text-sm font-bold text-slate-900 uppercase">Tarification & Académique</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Inscription par défaut</label>
                <NumericInput
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition"
                  value={config.registration_fee_default ?? null}
                  onChange={(v)=>setConfig({...config, registration_fee_default: v ?? 0})}
                  maximumFractionDigits={0}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Moyenne de passage</label>
                <NumericInput
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition"
                  value={config.passing_grade ?? null}
                  onChange={(v)=>setConfig({...config, passing_grade: v ?? 10})}
                  maximumFractionDigits={1}
                />
              </div>
              <div className="flex items-end">
                <button 
                  type="button"
                  onClick={() => setConfig({...config, is_registration_open: !config.is_registration_open})}
                  className={`w-full py-2.5 rounded-xl font-bold uppercase text-xs transition cursor-pointer ${
                    config.is_registration_open 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  Inscriptions : {config.is_registration_open ? 'Ouvertes' : 'Fermées'}
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}