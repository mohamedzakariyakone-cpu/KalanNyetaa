'use client';

import { useYear } from '@/context/YearContext';
import { Calendar, ChevronDown, Lock } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function YearSelector() {
  const { selectedYear, years, isLoading, isReadOnly, changeYear } = useYear();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl animate-pulse">
        <div className="h-3.5 w-3.5 bg-slate-200 rounded"></div>
        <div className="h-3.5 w-16 bg-slate-200 rounded"></div>
      </div>
    );
  }

  if (!selectedYear || years.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-slate-400 text-xs font-bold uppercase tracking-wider">
        <Calendar size={14} />
        <span>Aucune année</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton principal optimisé et compact */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide
          transition-all duration-200 ease-in-out shrink-0 select-none
          ${isReadOnly 
            ? 'bg-amber-50 text-amber-700 border border-amber-200/60 hover:bg-amber-100/80 active:scale-95' 
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100/80 active:scale-95'
          }
        `}
      >
        {isReadOnly ? <Lock size={12} className="shrink-0 text-amber-600" /> : <Calendar size={12} className="shrink-0" />}
        <span className="truncate max-w-20 sm:max-w-none">{selectedYear.label}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 opacity-60 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Un seul Dropdown unique qui contient tout */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 origin-top-right">
          
          {/* Liste des années scolaires */}
          <div className="max-h-45 overflow-y-auto no-scrollbar">
            {years.map((year) => (
              <button
                key={year.id}
                onClick={() => {
                  changeYear(year);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center justify-between px-4 py-2 text-left text-xs font-bold uppercase tracking-wide
                  transition-colors duration-150
                  ${year.id === selectedYear.id
                    ? 'bg-emerald-50 text-emerald-700 font-black'
                    : 'text-slate-600 hover:bg-slate-50'
                  }
                `}
              >
                <span>{year.label}</span>
                {year.is_current && (
                  <span className="text-[9px] font-black bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-md uppercase tracking-tight">
                    Actuelle
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Section d'information Lecture Seule déplacée ici (Ne déborde plus jamais sur la Navbar) */}
          {isReadOnly && (
            <div className="mt-1.5 mx-1.5 p-2.5 bg-amber-50/70 border border-amber-200/40 rounded-xl">
              <div className="flex gap-1.5">
                <Lock size={12} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black text-amber-800 uppercase tracking-tight">Mode archive</p>
                  <p className="text-[9px] font-medium text-amber-600 leading-normal mt-0.5">
                    Historique verrouillé. Aucune modification possible sur cette année scolaire.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}