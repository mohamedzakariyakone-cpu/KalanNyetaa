"use client";

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'fr' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const translations: Record<Language, Record<string, any>> = {
  fr: {
    sidebar: {
      dashboard: 'Tableau de bord',
      classes: 'Classes',
      students: 'Élèves',
      teachers: 'Professeurs',
      finance: 'Comptabilité',
      recouvrement: 'Recouvrement',
      bulletins: 'Bulletins',
      performance: 'Performance',
      settings: 'Paramètres',
      logout: 'Déconnexion',
      more: 'Plus',
    },
    roleSelection: {
      title: 'Sélectionnez votre espace de travail :',
      welcomeDetails: 'Bienvenue dans votre espace de gestion. Veuillez choisir votre rôle pour commencer.',
      validationHint: 'Veuillez entrer le code secret pour déverrouiller l’accès à cet espace scolaire.',
      validateButton: 'Valider et Entrer',
      schoolSpace: 'Espace de Gestion Scolaire',
      loading: 'Chargement...',
      chooseLanguage: 'Choisir la langue',
    },
    dashboard: {
      overview: 'Vue d’ensemble',
      period: 'Période',
      month: 'Mois en cours',
      recoveryGlobal: 'Recouvrement Global',
      collected: 'Encaissé',
      goal: 'Objectif',
      remaining: 'Reste à recouvrer',
      financialFlow: 'Flux Financiers',
      criticalDelays: 'Retards Critiques',
      discipline: 'Suivi Disciplinaire',
      language: 'Langue',
      switchToArabic: 'Arabe',
      switchToFrench: 'Français',
    },
    common: {
      welcome: 'Bienvenue',
      schoolManagement: 'Espace de Gestion Scolaire',
      french: 'Français',
      arabic: 'العربية',
    },
  },
  ar: {
    sidebar: {
      dashboard: 'لوحة التحكم',
      classes: 'الفصول',
      students: 'الطلاب',
      teachers: 'المعلمون',
      finance: 'الحسابات',
      recouvrement: 'المقبوضات',
      bulletins: 'الشهادات',
      performance: 'الأداء',
      settings: 'الإعدادات',
      logout: 'تسجيل الخروج',
      more: 'المزيد',
    },
    roleSelection: {
      title: 'اختر مساحة العمل الخاصة بك :',
      welcomeDetails: 'مرحبًا بك في مساحة الإدارة الخاصة بك. الرجاء اختيار دورك للبدء.',
      validationHint: 'يرجى إدخال الرمز السري لفتح الوصول إلى هذه المساحة المدرسية.',
      validateButton: 'تأكيد والدخول',
      schoolSpace: 'مساحة إدارة المدرسة',
      loading: 'جارٍ التحميل...',
      chooseLanguage: 'اختر اللغة',
    },
    dashboard: {
      overview: 'نظرة عامة',
      period: 'الفترة',
      month: 'الشهر الحالي',
      recoveryGlobal: 'التحصيل العام',
      collected: 'المحصّل',
      goal: 'الهدف',
      remaining: 'المتبقي',
      financialFlow: 'التدفقات المالية',
      criticalDelays: 'التأخيرات الحرجة',
      discipline: 'متابعة السلوك',
      language: 'اللغة',
      switchToArabic: 'العربية',
      switchToFrench: 'Français',
    },
    common: {
      welcome: 'مرحبا',
      schoolManagement: 'مساحة إدارة المدرسة',
      french: 'Français',
      arabic: 'العربية',
    },
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('kan_language') as Language | null;
    if (saved === 'fr' || saved === 'ar') {
      setLanguageState(saved);
    } else if (navigator.language.startsWith('ar')) {
      setLanguageState('ar');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('kan_language', language);
    document.documentElement.lang = language === 'ar' ? 'ar' : 'fr';
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string, fallback?: string) => {
    const keys = key.split('.');
    let value: any = translations[language];

    for (const part of keys) {
      if (!value || typeof value !== 'object') {
        return fallback ?? key;
      }
      value = value[part];
    }

    return typeof value === 'string' ? value : fallback ?? key;
  };

  const contextValue = useMemo(
    () => ({ language, setLanguage, t }),
    [language],
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
