'use client';

import { useState, useEffect, useCallback, cloneElement } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { 
  Wallet, ShieldAlert, ArrowLeft, Plus, 
  Loader2, AlertTriangle, Phone, MapPin, 
  Edit3, X, CheckCircle2, Settings2, Save, Receipt, Trash2
} from 'lucide-react';
import Link from 'next/link';
import NumericInput from '@/components/NumericInput';

export default function StudentDetails() {
  const { id } = useParams();
  const [student, setStudent] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [extraPayments, setExtraPayments] = useState<any[]>([]);
  const [extraFeeTypes, setExtraFeeTypes] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États de saisie
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState('');
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState('Bas');

  const [selectedExtraType, setSelectedExtraType] = useState('');
  const [extraAmount, setExtraAmount] = useState('');

  const [showAvgForm, setShowAvgForm] = useState(false);
  const [newAvg, setNewAvg] = useState('');
  const [updatingAvg, setUpdatingAvg] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    parent_phone: '',
    address: '',
    annual_fee: 0,
    payment_plan_tranches: 1
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Jointure sécurisée à plat sur classes
      const { data: st } = await supabase.from('students').select('*, classes(name)').eq('id', id).single();
      const { data: pay } = await supabase.from('payments').select('*').eq('student_id', id).order('created_at', { ascending: false });
      const { data: inc } = await supabase.from('discipline').select('*').eq('student_id', id).order('incident_date', { ascending: false });
      const { data: exPay } = await supabase.from('student_extra_payments').select('*, extra_fee_types(name)').eq('student_id', id).order('payment_date', { ascending: false });
      const { data: exTypes } = await supabase.from('extra_fee_types').select('*');

      setStudent(st);
      if (st) {
        setEditForm({
          first_name: st.first_name || '',
          last_name: st.last_name || '',
          parent_phone: st.parent_phone || '',
          address: st.address || '',
          annual_fee: Number(st.scolarite_totale || st.annual_fee || 0),
          payment_plan_tranches: st.payment_plan_tranches || 1
        });
        setNewAvg(st.last_exam_avg ? String(st.last_exam_avg) : '');
      }
      setPayments(pay || []);
      setIncidents(inc || []);
      setExtraPayments(exPay || []);
      setExtraFeeTypes(exTypes || []);
    } catch (error) {
      console.error("Erreur de chargement général :", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sendReceiptWhatsApp = (pAmount: number, pMonth: string, type: 'SCOLAIRE' | 'EXTRA') => {
    if (!student?.parent_phone) return;
    const cleanNumber = student.parent_phone.replace(/\D/g, '');
    const dateStr = new Date().toLocaleDateString('fr-FR');
    
    const message = encodeURIComponent(
      `✅ *REÇU DE PAIEMENT - ÉCOLE*\n\n` +
      `*Élève :* ${student.first_name} ${student.last_name}\n` +
      `*Type :* ${type}\n` +
      `*Montant :* ${new Intl.NumberFormat('fr-FR').format(pAmount)} FCFA\n` +
      `*Motif :* ${pMonth}\n` +
      `*Date :* ${dateStr}\n` +
      `---------------------------\n` +
      `Merci pour votre confiance. 🙏`
    );
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
  };

  // Mise à jour de la moyenne de l'élève en direct
  const handleUpdateAvg = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingAvg(true);
    const { error } = await supabase
      .from('students')
      .update({ last_exam_avg: newAvg === '' ? null : parseFloat(newAvg) })
      .eq('id', id);
    
    if (!error) {
      setShowAvgForm(false);
      fetchData();
    }
    setUpdatingAvg(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    // Synchronisation sur scolarite_totale lors du changement du montant annuel
    const { error } = await supabase
      .from('students')
      .update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        parent_phone: editForm.parent_phone,
        address: editForm.address,
        annual_fee: editForm.annual_fee,
        scolarite_totale: editForm.annual_fee,
        payment_plan_tranches: editForm.payment_plan_tranches
      })
      .eq('id', id);
    if (!error) { setIsEditModalOpen(false); fetchData(); }
  };

  // Encaissement Scolarité
  const handleBasePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const payAmount = parseFloat(amount);
    if (isNaN(payAmount)) return;

    // Nouveau calcul cumulatif
    const newCollectedTotal = Number(student?.scolarite_payee || 0) + payAmount;

    // Insertion transactionnelle dans payments + mise à jour compteur élève
    const { error: payError } = await supabase.from('payments').insert([{ 
      student_id: id, 
      amount: payAmount, 
      month,
      academic_year_id: student?.academic_year_id,
      school_id: student?.school_id
    }]);

    if (!payError) {
      await supabase.from('students').update({ scolarite_payee: newCollectedTotal, dernier_paiement: new Date().toISOString().split('T')[0] }).eq('id', id);
      sendReceiptWhatsApp(payAmount, month, 'SCOLAIRE');
      setAmount(''); setMonth(''); fetchData();
    }
  };

  const handleExtraPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const payAmount = parseFloat(extraAmount);
    if (isNaN(payAmount)) return;

    const { error } = await supabase.from('student_extra_payments').insert([{
      student_id: id,
      fee_type_id: selectedExtraType,
      amount_paid: payAmount,
      academic_year_id: student?.academic_year_id,
      school_id: student?.school_id
    }]);

    if (!error) {
      const typeLabel = extraFeeTypes.find(t => t.id === selectedExtraType)?.name;
      sendReceiptWhatsApp(payAmount, typeLabel || 'Frais Divers', 'EXTRA');
      setExtraAmount(''); fetchData();
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#1763FF]" size={40} /></div>;
  if (!student) return <div className="text-center p-20 font-bold text-slate-800">Élève non trouvé.</div>;

  // Utilisation exclusive des colonnes réelles de ton schéma
  const annualFee = Number(student.scolarite_totale || student.annual_fee || 0);
  const totalPaid = Number(student.scolarite_payee || 0);
  
  const currentYearCoverage = Math.min(totalPaid, annualFee);
  const nextYearAdvance = Math.max(0, totalPaid - annualFee);
  const remaining = Math.max(0, annualFee - totalPaid);
  const isSolded = remaining === 0;

  const numTranches = student.payment_plan_tranches || 1;
  const amountPerTranche = annualFee / numTranches;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-2 sm:px-6 lg:px-8 w-full max-w-full overflow-x-hidden">
      
      {/* ACTIONS DE RETOUR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-4">
        <Link href="/students" className="flex items-center gap-2 text-slate-400 hover:text-[#1763FF] transition-colors font-bold text-[10px] uppercase tracking-widest">
          <ArrowLeft size={14} /> Retour au registre
        </Link>
        <button onClick={() => setIsEditModalOpen(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1763FF] text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-[#1252D4] transition-all shadow-md shadow-blue-500/10">
          <Settings2 size={14} /> Paramètres & Tranches
        </button>
      </div>

      {/* BANDEAU COMPLET FILTRÉ PROFIL */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm flex flex-col md:flex-row items-center gap-6 relative">
        <div className="h-20 w-20 md:h-24 md:w-24 bg-gradient-to-br from-[#1763FF] to-[#00246B] text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-md shrink-0">
          {student.first_name?.[0]}{student.last_name?.[0]}
        </div>
        
        <div className="flex-1 text-center md:text-left w-full min-w-0">
          <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight uppercase truncate">{student.first_name} {student.last_name}</h1>
            <span className="px-2.5 py-0.5 bg-blue-50 text-[#1763FF] rounded-md text-[9px] font-bold uppercase border border-blue-100 shrink-0">
              {student.classes?.name || 'Aucune classe'}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 sm:gap-6 mt-3 text-slate-500 font-semibold text-xs">
            <div className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400" /> {student.parent_phone || "Téléphone non renseigné"}</div>
            <div className="flex items-center gap-1.5"><MapPin size={13} className="text-slate-400" /> {student.address || "Adresse non renseignée"}</div>
          </div>
        </div>

        {/* COMPTEUR MOYENNE ACADÉMIQUE */}
        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-50 text-center w-full md:w-auto min-w-[130px] relative shrink-0">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Dernière Moyenne</p>
          <p className="text-2xl font-black text-[#1763FF]">
            {student.last_exam_avg !== null ? Number(student.last_exam_avg).toFixed(2) : "00"}
            <span className="text-xs text-slate-400 font-medium">/20</span>
          </p>
          <button onClick={() => setShowAvgForm(!showAvgForm)} className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-[#1763FF] text-white p-1.5 rounded-lg shadow-md hover:bg-[#1252D4] transition-all">
            {showAvgForm ? <X size={10} /> : <Edit3 size={10} />}
          </button>
        </div>
      </div>

      {/* FORMULAIRE RAPIDE MOYENNE */}
      {showAvgForm && (
        <form onSubmit={handleUpdateAvg} className="bg-white p-4 rounded-2xl border border-slate-200/60 max-w-sm flex gap-2 items-center shadow-sm">
          <input 
            type="number" 
            step="0.01" 
            min="0" 
            max="20" 
            placeholder="Nouvelle moyenne..." 
            className="flex-1 p-2.5 bg-slate-50 rounded-xl text-xs font-bold border-none outline-none text-slate-800"
            value={newAvg} 
            onChange={(e) => setNewAvg(e.target.value)}
            required 
          />
          <button type="submit" disabled={updatingAvg} className="bg-[#1763FF] text-white text-xs px-4 py-2.5 rounded-xl font-bold uppercase shrink-0 hover:bg-[#1252D4] transition-colors">
            {updatingAvg ? '...' : 'Valider'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLONNE GAUCHE */}
        <div className="lg:col-span-4 space-y-6">
            
            {/* FRAIS EXTRAS */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-200/60 shadow-sm">
                <h3 className="font-black mb-4 flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-900"><Plus size={14} className="text-[#1763FF]" /> Compléments & Annexes</h3>
                <form onSubmit={handleExtraPayment} className="space-y-3">
                    <select className="w-full p-3.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none text-slate-800" value={selectedExtraType} onChange={(e)=>setSelectedExtraType(e.target.value)} required>
                        <option value="">Sélectionner frais divers...</option>
                        {extraFeeTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({Number(t.default_amount).toLocaleString()} F)</option>)}
                    </select>
                    <NumericInput
                      placeholder="Montant perçu..."
                      className="w-full p-3.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none text-slate-800"
                      value={extraAmount === '' ? undefined : Number(extraAmount)}
                      onChange={(v)=>setExtraAmount(v === null ? '' : String(v))}
                      maximumFractionDigits={0}
                      required
                    />
                    <button type="submit" className="w-full bg-[#1763FF] text-white p-3.5 rounded-xl font-black text-[10px] uppercase hover:bg-[#1252D4] transition-all shadow-md shadow-blue-500/10">Valider l'encaissement</button>
                </form>
            </div>

            {/* DISCIPLINE ENRICHIE */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-200/60 shadow-sm space-y-4">
                <h3 className="font-black flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-900"><ShieldAlert size={14} className="text-rose-500" /> Dossier Discipline</h3>
                <form onSubmit={async (e) => { 
                  e.preventDefault(); 
                  await supabase.from('discipline').insert([{ student_id: id, reason, severity, incident_date: new Date().toISOString().split('T')[0], academic_year_id: student?.academic_year_id, school_id: student?.school_id }]); 
                  setReason(''); fetchData(); 
                }} className="space-y-3">
                    <textarea placeholder="Rédiger le motif du rapport..." className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs h-16 resize-none outline-none font-medium text-slate-800" value={reason} onChange={(e) => setReason(e.target.value)} required />
                    <div className="flex gap-1">
                        {['Bas', 'Moyen', 'Grave'].map(l => (
                            <button key={l} type="button" onClick={() => setSeverity(l)} className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all ${severity === l ? 'bg-rose-600 text-white font-black' : 'bg-slate-100 text-slate-500'}`}>{l}</button>
                        ))}
                    </div>
                    <button type="submit" className="w-full bg-[#1763FF] text-white p-3.5 rounded-xl font-black text-[10px] uppercase hover:bg-[#1252D4] transition-colors">Enregistrer l'incident</button>
                </form>

                {/* Historique interne de l'étudiant */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <p className="text-[9px] font-black uppercase text-slate-400">Registre disciplinaire de l'élève</p>
                  {incidents.length === 0 ? (
                    <p className="text-[11px] text-slate-400 font-medium italic">Aucun incident à signaler.</p>
                  ) : (
                    incidents.map((inc) => (
                      <div key={inc.id} className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 leading-tight">{inc.reason}</p>
                          <span className="text-[10px] text-slate-400 font-medium">{new Date(inc.incident_date || inc.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase shrink-0 ${
                          inc.severity === 'Grave' ? 'bg-rose-100 text-rose-700' : inc.severity === 'Moyen' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
                        }`}>{inc.severity || 'Bas'}</span>
                      </div>
                    ))
                  )}
                </div>
            </div>
        </div>

        {/* COLONNE DROITE */}
        <div className="lg:col-span-8 space-y-6">
            
            {/* RÉSUMÉ DES TRANCHES */}
            <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200/60 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Échéancier de Scolarité ({numTranches})</h3>
                   <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Montant unitaire d'appel</p>
                      <p className="text-base font-black text-slate-900">{new Intl.NumberFormat('fr-FR').format(amountPerTranche)} F CFA</p>
                   </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Array.from({ length: numTranches }).map((_, i) => {
                        const trancheTarget = (i + 1) * amountPerTranche;
                        const isTranchePaid = totalPaid >= trancheTarget;
                        return (
                            <div key={i} className={`p-3 rounded-xl border ${isTranchePaid ? 'bg-emerald-50/60 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                                <p className={`text-[8px] font-black uppercase mb-0.5 ${isTranchePaid ? 'text-emerald-600' : 'text-slate-400'}`}>Échéance {i+1}</p>
                                <div className="flex items-center gap-1.5">
                                    {isTranchePaid ? <CheckCircle2 size={11} className="text-emerald-600"/> : <div className="h-2 w-2 rounded-full border border-slate-300"/>}
                                    <span className={`text-[9px] font-bold ${isTranchePaid ? 'text-emerald-800' : 'text-slate-400'}`}>{isTranchePaid ? 'Réglée' : 'En attente'}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* BARRES DE PROGRESSION SOLDE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-[2rem] border border-slate-200/60 shadow-sm">
                    <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1 italic">Scolarité Payée</p>
                    <h4 className="text-2xl font-black text-slate-950 italic">{new Intl.NumberFormat('fr-FR').format(currentYearCoverage)} F CFA</h4>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${isSolded ? 'bg-emerald-500' : 'bg-[#1763FF]'}`} style={{ width: `${annualFee > 0 ? (currentYearCoverage / annualFee) * 100 : 0}%` }} />
                    </div>
                </div>

                {isSolded ? (
                  <div className="bg-[#1763FF] p-5 rounded-[2rem] text-white shadow-md shadow-blue-500/10">
                      <p className="text-blue-100 text-[9px] font-black uppercase tracking-widest mb-1 italic">Surplus / Avance Année Suivante</p>
                      <h4 className="text-2xl font-black italic">{new Intl.NumberFormat('fr-FR').format(nextYearAdvance)} F CFA</h4>
                  </div>
                ) : (
                  <div className="bg-rose-500 p-5 rounded-[2rem] text-white shadow-sm">
                      <p className="text-rose-200 text-[9px] font-black uppercase tracking-widest mb-1 italic">Créance / Reliquat Dû</p>
                      <h4 className="text-2xl font-black italic">{new Intl.NumberFormat('fr-FR').format(remaining)} F CFA</h4>
                  </div>
                )}
            </div>

            {/* FORMULAIRE ENCAISSEMENT BRUT PAIEMENT */}
            <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200/60 shadow-sm">
                <h3 className="font-black mb-4 text-[10px] uppercase tracking-widest flex items-center gap-2"><Wallet size={14} className="text-[#1763FF]"/> Encaisser Paiement Scolaire</h3>
                <form onSubmit={handleBasePayment} className="flex flex-col sm:grid sm:grid-cols-3 gap-3">
                    <NumericInput
                      placeholder="Montant en Francs..."
                      className="p-3.5 bg-slate-50 rounded-xl font-bold outline-none text-xs text-slate-800"
                      value={amount === '' ? undefined : Number(amount)}
                      onChange={(v)=>setAmount(v === null ? '' : String(v))}
                      maximumFractionDigits={0}
                      required
                    />
                    <select className="p-3.5 bg-slate-50 rounded-xl outline-none font-bold text-xs text-slate-800" value={month} onChange={(e)=>setMonth(e.target.value)} required>
                        <option value="">Sélectionner période...</option>
                        {['Tranche 1', 'Tranche 2', 'Tranche 3', 'Mensualité'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button className="bg-[#1763FF] text-white p-3.5 rounded-xl font-black text-[10px] uppercase hover:bg-[#1252D4] transition-colors shadow-md shadow-blue-500/10">Valider & Générer Reçu</button>
                </form>
            </div>

            {/* JOURNAL DES MUTATIONS FINANCIÈRES */}
            <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden">
                <p className="p-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 italic">Journal Comptable Individuel</p>
                <div className="w-full overflow-x-auto no-scrollbar">
                    <table className="w-full text-left min-w-[320px]">
                        <tbody className="divide-y divide-slate-100">
                            {[...payments, ...extraPayments].sort((a,b) => new Date(b.payment_date || b.created_at).getTime() - new Date(a.payment_date || a.created_at).getTime()).map((p, idx) => (
                                <tr key={idx} className="text-xs font-bold text-slate-700 hover:bg-blue-50/20 transition-colors">
                                    <td className="px-4 py-3 text-slate-400 italic text-[10px] whitespace-nowrap">
                                      {new Date(p.payment_date || p.created_at).toLocaleDateString('fr-FR')}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`px-2 py-0.5 rounded-md text-[8px] uppercase font-black inline-block ${p.extra_fee_types ? 'bg-blue-50 text-[#1763FF] border border-blue-100' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                        {p.extra_fee_types ? p.extra_fee_types.name : p.month}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-black text-slate-900 whitespace-nowrap">
                                        {new Intl.NumberFormat('fr-FR').format(p.amount || p.amount_paid)} F
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>

      {/* PARAMÈTRES ET MODAL DE CONFIGURATION */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-3">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-xl overflow-y-auto max-h-[85vh] no-scrollbar">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-black uppercase tracking-tight text-slate-900">Fiche de Configuration de l'élève</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 bg-slate-100 rounded-full text-slate-600 hover:bg-blue-50"><X size={14} /></button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Planification Échéances</label>
                <select className="w-full p-3.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800" value={editForm.payment_plan_tranches} onChange={(e)=>setEditForm({...editForm, payment_plan_tranches: parseInt(e.target.value)})}>
                    <option value={1}>1 versement unique</option>
                    <option value={3}>3 tranches (Trimestriel)</option>
                    <option value={9}>9 tranches (Mensuel)</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Prénom</label>
                  <input type="text" className="w-full p-3.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800" value={editForm.first_name} onChange={(e)=>setEditForm({...editForm, first_name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Nom</label>
                  <input type="text" className="w-full p-3.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800" value={editForm.last_name} onChange={(e)=>setEditForm({...editForm, last_name: e.target.value})} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Contact Parent</label>
                <input type="text" className="w-full p-3.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800" value={editForm.parent_phone} onChange={(e)=>setEditForm({...editForm, parent_phone: e.target.value})} />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Adresse Habitation</label>
                <input type="text" className="w-full p-3.5 bg-slate-50 rounded-xl font-bold text-xs text-slate-800" value={editForm.address} onChange={(e)=>setEditForm({...editForm, address: e.target.value})} />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Montant Scolarité Annuelle Requis</label>
                <NumericInput
                  className="w-full p-3.5 bg-slate-50 rounded-xl font-black text-xs text-[#1763FF]"
                  value={editForm.annual_fee ?? undefined}
                  onChange={(v)=>setEditForm({...editForm, annual_fee: v ?? 0})}
                  maximumFractionDigits={0}
                />
              </div>

              <button type="submit" className="w-full bg-[#1763FF] text-white p-3.5 rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 mt-2 hover:bg-[#1252D4] transition-colors shadow-md shadow-blue-500/10">
                <Save size={14} /> Sauvegarder les modifications
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}