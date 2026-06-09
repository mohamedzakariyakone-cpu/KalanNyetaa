'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import NumericInput from '@/components/NumericInput';
import { 
  Save, Calendar, ShieldCheck, Store, 
  Loader2, Clock, GraduationCap, AlertCircle, Plus, Check
} from 'lucide-react';
import { label } from 'framer-motion/client';

const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", 
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export default function GlobalSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);
  
  // États pour la gestion de la table academic_years
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [newYear, setNewYear] = useState({ label: '', start_date: '', end_date: '' });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { 
    fetchSettings(); 
    fetchAcademicYears();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    let { data, error } = await supabase.from('school_settings').select('*').eq('id', 1).single();
    
    if (error || !data) {
      const initialConfig = { id: 1, school_name: "La Source", current_month_index: 1, current_academic_year: "" };
      const { data: newData } = await supabase.from('school_settings').insert(initialConfig).select().single();
      setConfig(newData);
    } else {
      setConfig(data);
    }
    setLoading(false);
  }

  // Récupération des années scolaires depuis la base de données
  async function fetchAcademicYears() {
    const { data, error } = await supabase.from('academic_years').select('*').order('created_at', { ascending: false });
    if (data) {
      setAcademicYears(data);
    }
    if (error) {
      console.error("Erreur lors de la récupération des années scolaires:", error);
    }
  }

  // Ajout d'une nouvelle année scolaire dans la base
  async function handleAddYear(e: React.FormEvent) {
    e.preventDefault();
    if (!newYear.label || !newYear.start_date || !newYear.end_date) return;

    const { data, error } = await supabase
      .from('academic_years')
      .insert([newYear])
      .select()
      .single();

    if (error) {
      alert("Erreur lors de l'ajout de l'année scolaire : " + error.message);
    } else {
      alert("✅ Année scolaire ajoutée avec succès !");
      setNewYear({ label: '', start_date: '', end_date: '' });
      setShowForm(false);
      fetchAcademicYears(); // Recharger la liste
    }
  }

  // Activer une année scolaire
  async function toggleActiveYear(year: { id: any; label: any; }) {
    // Mettre à jour l'état actif dans la table academic_years
    // Optionnel : Désactiver les autres
    await supabase.from('academic_years').update({ is_current: false }).neq('id', year.id);
    const { error } = await supabase.from('academic_years').update({ is_current: true }).eq('id', year.id);

    if (!error) {
      // Mettre à jour également l'année sélectionnée dans la config globale
      setConfig({ ...config, current_academic_year: year.label });
      fetchAcademicYears();
      alert(`Année ${year.label} activée !`);
    } else {
      alert("Erreur lors de l'activation.");
    }
  }

  async function saveSettings() {
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
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <Loader2 className="animate-spin text-green-600" size={50}/>
      <p className="font-black italic uppercase text-slate-400 animate-pulse">Initialisation du Cockpit...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto pb-20 px-4 space-y-10">
      
      {/* HEADER DYNAMIQUE */}
      <div className="mt-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
            <h1 className="text-3xl sm:text-5xl font-black italic uppercase tracking-tighter text-slate-900">
              Cockpit <span className="text-green-600">Système</span>
            </h1>
            <p className="text-slate-400 font-bold italic uppercase text-[10px] tracking-widest mt-2">
              Configuration active : {config.school_name} | {config.current_academic_year}
            </p>
        </div>
        <button 
          onClick={saveSettings} disabled={saving}
          className="bg-slate-900 text-white px-6 sm:px-10 py-3 sm:py-5 rounded-[2rem] font-black uppercase italic flex items-center gap-3 hover:bg-green-600 transition-all shadow-2xl active:scale-95 disabled:opacity-50 w-full sm:w-auto justify-center"
        >
          {saving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20} />}
          Appliquer les changements
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SECTION : IDENTITÉ ÉCOLE ET ANNÉE ACTIVE */}
        <div className="lg:col-span-4 bg-white p-6 md:p-8 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
                <Store className="text-blue-600" size={20} />
                <h3 className="font-black uppercase italic text-sm text-slate-800">Établissement</h3>
            </div>
            <div className="space-y-4">
              <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Nom de l'école</label>
                  <input 
                      type="text" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 ring-green-500"
                      value={config.school_name || ''} onChange={(e)=>setConfig({...config, school_name: e.target.value})}
                  />
              </div>
              <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Année scolaire active</label>
                  <select 
                    className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 ring-green-500 text-sm"
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

        {/* SECTION : GESTION DES ANNÉES SCOLAIRES */}
        <div className="lg:col-span-8 bg-white p-6 md:p-10 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-8">
          <div className="flex justify-between items-center border-b pb-6">
            <div className="flex items-center gap-3">
              <Calendar className="text-green-600" />
              <h3 className="font-black uppercase italic text-lg text-slate-800">Gestion des Années Scolaires</h3>
            </div>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-black uppercase italic text-[10px] rounded-2xl shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" /> Nouvelle année
              </button>
            )}
          </div>

          {/* Formulaire d'ajout */}
          {showForm && (
            <form onSubmit={handleAddYear} className="p-6 mb-6 bg-slate-50 border border-slate-200 rounded-3xl">
              <h4 className="text-xs font-black uppercase text-slate-700 mb-4">Créer une nouvelle année</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 ml-2 mb-1">Nom (ex: 2026-2027)</label>
                  <input
                    type="text"
                    value={newYear.label}
                    onChange={(e) => setNewYear({ ...newYear, label: e.target.value })}
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 ring-green-500"
                    placeholder="2026-2027"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 ml-2 mb-1">Date de début</label>
                  <input
                    type="date"
                    value={newYear.start_date}
                    onChange={(e) => setNewYear({ ...newYear, start_date: e.target.value })}
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 ml-2 mb-1">Date de fin</label>
                  <input
                    type="date"
                    value={newYear.end_date}
                    onChange={(e) => setNewYear({ ...newYear, end_date: e.target.value })}
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 ring-green-500"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-3 border border-slate-200 rounded-2xl text-xs font-black uppercase text-slate-700 hover:bg-slate-100 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-slate-900 hover:bg-green-600 text-white text-xs font-black uppercase rounded-2xl transition shadow-xl"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          )}

          {/* Liste des années scolaires */}
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
            {academicYears.length > 0 ? (
              academicYears.map((year) => (
                <div
                  key={year.id}
                  className={`flex justify-between items-center p-4 border rounded-2xl transition ${
                    year.is_current ? 'border-green-200 bg-green-50/50' : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <div>
                    <h4 className="font-black text-sm text-slate-800">{year.name}</h4>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">
                      Du {new Date(year.start_date).toLocaleDateString('fr-FR')} au{' '}
                      {new Date(year.end_date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div>
                    {year.is_current ? (
                      <span className="flex items-center gap-1 text-[10px] font-black text-green-700 bg-green-100 px-3 py-1.5 rounded-full uppercase">
                        <Check className="w-3.5 h-3.5" /> Actif
                      </span>
                    ) : (
                      <button
                        onClick={() => toggleActiveYear(year)}
                        className="text-[10px] text-green-600 font-black uppercase border border-green-200 px-3 py-2 rounded-xl hover:bg-green-50 transition"
                      >
                        Activer
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-xs font-bold text-slate-400 py-10">Aucune année scolaire trouvée en base.</p>
            )}
          </div>
        </div>

        {/* SECTION : ÉCHÉANCIER DES TRANCHES */}
        <div className="lg:col-span-12 bg-white p-6 md:p-10 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-8">
            <div className="flex items-center gap-3 border-b pb-6">
                <Clock className="text-green-600" />
                <h3 className="font-black uppercase italic text-lg text-slate-800">Calendrier des Tranches (Plan 3)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((num) => (
                <div key={num} className="space-y-4 p-4 sm:p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                    <p className="font-black text-center text-green-600 uppercase text-[10px]">Tranche {num}</p>
                    <div className="space-y-3">
                        <select 
                            className="w-full p-3 bg-white rounded-xl font-bold text-xs outline-none shadow-sm"
                            value={config[`t${num}_start_month`] ?? 0}
                            onChange={(e)=>setConfig({...config, [`t${num}_start_month`]: parseInt(e.target.value)})}
                        >
                            <option disabled>Début</option>
                            {MOIS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                        <select 
                            className="w-full p-3 bg-white rounded-xl font-bold text-xs outline-none shadow-sm"
                            value={config[`t${num}_end_month`] ?? 0}
                            onChange={(e)=>setConfig({...config, [`t${num}_end_month`]: parseInt(e.target.value)})}
                        >
                            <option disabled>Fin</option>
                            {MOIS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                    </div>
                </div>
              ))}
            </div>
        </div>

        {/* SECTION : PLAN 9 ET RÈGLES */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* PLAN 9 MOIS */}
            <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center gap-3 border-b pb-4">
                    <Calendar className="text-blue-600" />
                    <h3 className="font-black uppercase italic text-sm text-slate-800">Échéance Mensuelle</h3>
                </div>
                <div className="text-center">
                    <span className="text-5xl font-black text-slate-900 italic">{config.current_month_index}</span>
                    <p className="text-[9px] font-black uppercase text-slate-400 mt-1">Mois en cours de règlement</p>
                </div>
                <input 
                    type="range" min="1" max="9" className="w-full accent-slate-900"
                    value={config.current_month_index || 1}
                    onChange={(e)=>setConfig({...config, current_month_index: parseInt(e.target.value)})}
                />
            </div>

            {/* TARIFS DE BASE */}
            <div className="md:col-span-2 bg-slate-900 p-8 rounded-[3.5rem] shadow-xl space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                    <ShieldCheck className="text-green-400" />
                    <h3 className="font-black uppercase italic text-sm text-white">Tarification & Académique</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Inscription</label>
                        <NumericInput
                          className="w-full p-4 bg-slate-800 text-green-400 rounded-2xl font-black outline-none"
                          value={config.registration_fee_default ?? null}
                          onChange={(v)=>setConfig({...config, registration_fee_default: v ?? 0})}
                          maximumFractionDigits={0}
                        />
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Moyenne Passage</label>
                        <NumericInput
                          className="w-full p-4 bg-slate-800 text-blue-400 rounded-2xl font-black outline-none"
                          value={config.passing_grade ?? null}
                          onChange={(v)=>setConfig({...config, passing_grade: v ?? 10})}
                          maximumFractionDigits={1}
                        />
                    </div>
                    <div className="flex items-end">
                        <button 
                            onClick={() => setConfig({...config, is_registration_open: !config.is_registration_open})}
                            className={`w-full p-4 rounded-2xl font-black uppercase text-[10px] transition-all ${config.is_registration_open ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-rose-500 text-white'}`}
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