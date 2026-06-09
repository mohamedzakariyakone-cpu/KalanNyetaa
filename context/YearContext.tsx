'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/utils/supabase';

export interface AcademicYear {
  id: number;
  label: string;
  is_current: boolean;
  start_date?: string;
  end_date?: string;
}

interface YearContextType {
  selectedYearId: number | null;
  selectedYear: AcademicYear | null;
  years: AcademicYear[];
  isLoading: boolean;
  isReadOnly: boolean;
  changeYear: (year: AcademicYear) => void;
  refreshYears: () => Promise<void>;
}

const YearContext = createContext<YearContextType | undefined>(undefined);

export function YearProvider({ children }: { children: ReactNode }) {
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const fetchYears = async () => {
    try {
      const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .order('label', { ascending: false });

      if (error) throw error;

      const yearList = (data || []) as AcademicYear[];
      setYears(yearList);

      const storedYearId = typeof window !== 'undefined'
        ? Number(localStorage.getItem('selectedAcademicYearId'))
        : null;

      const current = yearList.find((y) => y.is_current);
      let selected: AcademicYear | undefined;

      if (storedYearId) {
        selected = yearList.find((y) => y.id === storedYearId);
      }

      if (!selected) {
        selected = current || yearList[0];
      }

      if (selected) {
        setSelectedYearId(selected.id);
        setSelectedYear(selected);
        setIsReadOnly(!selected.is_current);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des années académiques:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchYears();
  }, []);

  const changeYear = (year: AcademicYear) => {
    setSelectedYearId(year.id);
    setSelectedYear(year);
    setIsReadOnly(!year.is_current);

    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedAcademicYearId', String(year.id));
    }
  };

  const refreshYears = async () => {
    await fetchYears();
  };

  return (
    <YearContext.Provider
      value={{
        selectedYearId,
        selectedYear,
        years,
        isLoading,
        isReadOnly,
        changeYear,
        refreshYears,
      }}
    >
      {children}
    </YearContext.Provider>
  );
}

export function useYear() {
  const context = useContext(YearContext);
  if (context === undefined) {
    throw new Error('useYear doit être utilisé à l\'intérieur d\'un YearProvider');
  }
  return context;
}