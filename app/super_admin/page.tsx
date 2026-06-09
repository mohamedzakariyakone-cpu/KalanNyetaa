'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  Plus, School, UserPlus, Trash2, ShieldAlert, Edit3, 
  CheckCircle, XCircle, Search, Settings, Loader2, 
  Mail, Lock, MapPin, Users, Activity, Filter, Phone
} from 'lucide-react';

export default function Super_admin() {
  const [schools, setSchools] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'schools' | 'users'>('schools');
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // NOUVEAU : ID de l'école en cours de modification
  const [editingId, setEditingId] = useState<string | null>(null);

  // État du formulaire enrichi
  const [formData, setFormData] = useState({
    schoolName: '',
    address: '',
    city: '',
    rive: 'Rive Gauche',
    cap: '',
    academie: '',
    phone: '',
    adminEmail: '',
    adminPassword: '',
    adminRole: 'directeur'
  });

  useEffect(() => {
    fetchEverything();
  }, []);

  async function fetchEverything() {
    setLoading(true);
    const { data: schoolsData } = await supabase.from('schools').select('*').order('created_at', { ascending: false });
    const { data: profilesData } = await supabase.from('profiles').select('*, schools(name)').order('created_at', { ascending: false });
    
    setSchools(schoolsData || []);
    setProfiles(profilesData || []);
    setLoading(false);
  }

  // Fonction pour ouvrir le modal en mode édition
  const openEditModal = (school: any) => {
    setEditingId(school.id);
    setFormData({
      ...formData,
      schoolName: school.name || '',
      address: school.address || '',
      city: school.city || '',
      rive: school.rive || 'Rive Gauche',
      cap: school.cap || '',
      academie: school.academie || '',
      phone: school.phone || '',
    });
    setShowModal(true);
  };

  const handleFullDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        // --- LOGIQUE DE MODIFICATION ---
        const { error } = await supabase
          .from('schools')
          .update({ 
            name: formData.schoolName, 
            address: formData.address,
            city: formData.city,
            rive: formData.rive,
            cap: formData.cap,
            academie: formData.academie,
            phone: formData.phone
          })
          .eq('id', editingId);
        
        if (error) throw error;
        alert("Informations de l'école mises à jour.");
      } else {
        // --- LOGIQUE DE CRÉATION ORIGINALE ---
        const { data: school, error: sErr } = await supabase
          .from('schools')
          .insert([{ 
            name: formData.schoolName, 
            address: formData.address,
            city: formData.city,
            rive: formData.rive,
            cap: formData.cap,
            academie: formData.academie,
            phone: formData.phone,
            status: 'active' 
          }])
          .select().single();
        
        if (sErr) throw sErr;

        const { data: authData, error: aErr } = await supabase.auth.signUp({
          email: formData.adminEmail,
          password: formData.adminPassword,
          options: { data: { school_id: school.id, role: formData.adminRole } }
        });
        if (aErr) throw aErr;

        const { error: pErr } = await supabase
          .from('profiles')
          .update({ school_id: school.id, role: formData.adminRole })
          .eq('id', authData.user?.id);
        
        alert("École et Admin créés avec succès !");
      }

      setShowModal(false);
      setEditingId(null);
      fetchEverything();
    } catch (err: any) {
      alert("Erreur: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteAnything = async (table: string, id: string) => {
    if (!confirm("Confirmer la suppression ?")) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) fetchEverything();
  };

  return (
    <div className="min-h-screen bg-[#f4f7fe] flex">
      {/* Sidebar (Inchangée) */}
      <div className="w-72 bg-slate-900 m-6 rounded-[3rem] p-8 flex flex-col shadow-2xl">
        <div className="mb-12 px-4">
          <h2 className="text-white font-black text-2xl italic tracking-tighter">KalanNyetaa<span className="text-green-500 text-4xl">.</span></h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Master Control v2.0</p>
        </div>
        <nav className="space-y-2 flex-1">
          <button onClick={() => setTab('schools')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-sm transition-all ${tab === 'schools' ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' : 'text-slate-400 hover:bg-slate-800'}`}>
            <School size={20} /> Établissements
          </button>
          <button onClick={() => setTab('users')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-sm transition-all ${tab === 'users' ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Users size={20} /> Comptes Utilisateurs
          </button>
        </nav>
      </div>

      <main className="flex-1 p-12 overflow-y-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic">
              {tab === 'schools' ? 'Gestion des Écoles' : 'Annuaire des Utilisateurs'}
            </h1>
          </div>
          <div className="flex gap-4">
            <input 
              type="text" placeholder="Rechercher..." 
              className="pl-6 pr-6 py-4 bg-white border-none rounded-2xl shadow-sm w-64 outline-none font-bold text-sm"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button onClick={() => { setEditingId(null); setShowModal(true); }} className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg">
              Nouveau Déploiement
            </button>
          </div>
        </header>

        <div className="bg-white rounded-[3.5rem] p-4 shadow-xl shadow-slate-200/50">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">École</th>
                <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Localisation</th>
                <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Contact</th>
                <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tab === 'schools' ? (
                schools.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map(s => (
                  <tr key={s.id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="p-6 font-black text-slate-900">
                      {s.name}
                      <p className="text-[10px] text-slate-400 uppercase">{s.academie}</p>
                    </td>
                    <td className="p-6 text-slate-500 text-xs">
                      <div className="font-bold text-slate-700">{s.city} ({s.rive})</div>
                      <div className="italic">{s.address}</div>
                    </td>
                    <td className="p-6 text-slate-500 text-xs font-bold">{s.phone}</td>
                    <td className="p-6 text-right flex justify-end gap-2">
                      <button onClick={() => openEditModal(s)} className="p-3 text-slate-300 hover:text-green-600 transition-colors"><Edit3 size={18} /></button>
                      <button onClick={() => deleteAnything('schools', s.id)} className="p-3 text-slate-300 hover:text-rose-600 transition-colors"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))
              ) : (
                profiles.map(p => (
                  <tr key={p.id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="p-6 font-black text-slate-900 uppercase text-xs">{p.email}</td>
                    <td className="p-6 text-slate-900 font-bold text-sm italic">{p.schools?.name}</td>
                    <td className="p-6"><span className="bg-slate-100 px-4 py-2 rounded-full text-[10px] font-black uppercase">{p.role}</span></td>
                    <td className="p-6 text-right">
                      <button onClick={() => deleteAnything('profiles', p.id)} className="p-3 text-slate-300 hover:text-rose-600"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* MODAL ENRICHI (Gère AJOUT et MODIFICATION) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center z-50 p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-[4rem] p-10 shadow-2xl my-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-slate-900 italic tracking-tighter">
                {editingId ? 'Modifier' : 'Déploiement'} <span className="text-green-600">{editingId ? 'École' : 'Complet'}</span>
              </h2>
              <button onClick={() => { setShowModal(false); setEditingId(null); }}><XCircle className="text-slate-300 hover:text-slate-900" size={32} /></button>
            </div>

            <form onSubmit={handleFullDeployment} className="space-y-4">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b pb-2">Informations Établissement</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input required value={formData.schoolName} className="p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-green-500 outline-none text-sm" placeholder="Nom de l'école" onChange={e => setFormData({...formData, schoolName: e.target.value})} />
                <input required value={formData.phone} className="p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-green-500 outline-none text-sm" placeholder="Téléphone école" onChange={e => setFormData({...formData, phone: e.target.value})} />
                <input required value={formData.city} className="p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-green-500 outline-none text-sm" placeholder="Ville" onChange={e => setFormData({...formData, city: e.target.value})} />
                <select value={formData.rive} className="p-4 bg-slate-50 rounded-2xl font-bold outline-none text-sm border-2 border-transparent focus:border-green-500" onChange={e => setFormData({...formData, rive: e.target.value})}>
                  <option value="Rive Gauche">Rive Gauche</option>
                  <option value="Rive Droite">Rive Droite</option>
                </select>
                <input value={formData.address} className="p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-green-500 outline-none text-sm" placeholder="Adresse complète" onChange={e => setFormData({...formData, address: e.target.value})} />
                <input value={formData.cap} className="p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-green-500 outline-none text-sm" placeholder="CAP" onChange={e => setFormData({...formData, cap: e.target.value})} />
                <input value={formData.academie} className="p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-green-500 outline-none text-sm col-span-1 md:col-span-2" placeholder="Académie" onChange={e => setFormData({...formData, academie: e.target.value})} />
              </div>

              {/* On cache les infos Admin en mode édition pour plus de clarté */}
              {!editingId && (
                <div className="bg-slate-900 rounded-[2.5rem] p-8 space-y-4 mt-6">
                  <p className="text-green-500 text-[10px] font-black uppercase tracking-widest mb-2">Accès Administrateur</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <input required type="email" className="p-4 bg-slate-800 text-white rounded-xl font-bold outline-none text-sm focus:ring-1 ring-green-500" placeholder="Email Admin" onChange={e => setFormData({...formData, adminEmail: e.target.value})} />
                     <input required type="password" title="6 caractères min" className="p-4 bg-slate-800 text-white rounded-xl font-bold outline-none text-sm focus:ring-1 ring-green-500" placeholder="Mot de passe" onChange={e => setFormData({...formData, adminPassword: e.target.value})} />
                  </div>
                  <select className="w-full p-4 bg-slate-800 text-white rounded-xl font-bold outline-none text-sm" onChange={e => setFormData({...formData, adminRole: e.target.value})}>
                    <option value="directeur">Directeur (Accès Total)</option>
                    <option value="promoteur">Promoteur (Surveillance)</option>
                    <option value="comptable">Comptable (Finances uniquement)</option>
                  </select>
                </div>
              )}

              <button disabled={loading} className="w-full py-5 bg-green-600 text-white rounded-full font-black uppercase tracking-widest text-xs shadow-xl hover:bg-green-700 transition-all flex justify-center items-center">
                {loading ? <Loader2 className="animate-spin" /> : editingId ? "Sauvegarder les modifications" : "Déployer l'école"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}