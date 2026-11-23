'use client';

import { Fragment, useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { offlineFetch, offlineWrite } from '@/utils/offlineApi';
import { useCacheRefresh } from '@/hooks/useCacheRefresh';
import { useYear } from '@/context/YearContext';
import {
  Settings, PenTool, BarChart3, FileText, Plus, Trash2,
  Download, Trophy, Search, ChevronLeft, ChevronRight,
  Filter, ArrowRight, Maximize2, Minimize2,
  ArrowUp, ArrowDown, ArrowUpDown, Edit3, Check, X, Loader2,
  Languages, Columns2, Calculator, Database
} from 'lucide-react';
import FrancoArabicBulletinPdf, {
  SubjectLanguage,
  BulletinNoteItem,
  BulletinStudentData,
  getArabicMention,
} from './FrancoArabicBulletinPdf';

type BulletinMode = 'classic' | 'franco_arabic';

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const ARABIC_KEYWORD_REGEX =
  /\b(arabe|coran|qur'?an|fiqh|fikh|hadith|hadis|tawhid|taouhid|tajwid|tajweed|sira|sirah|nahw|sarf|incha|qiraa|tarbiya|islami|islamique|récitation coranique|recitation coranique|éducation islamique|education islamique|lecture arabe|grammaire arabe|conjugaison arabe|orthographe arabe|rédaction arabe|redaction arabe)\b/i;

function detectSubjectLanguage(subjectName: string): SubjectLanguage {
  if (!subjectName) return 'fr';
  if (ARABIC_CHAR_REGEX.test(subjectName) || ARABIC_KEYWORD_REGEX.test(subjectName)) {
    return 'ar';
  }
  return 'fr';
}

function isMissingColumnError(error: any, columnName: string): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || error.details || error.hint || '').toLowerCase();
  return code === '42703' || code === 'PGRST204' || msg.includes(columnName.toLowerCase());
}

export default function EngineScolaire() {
  const { selectedYearId, isReadOnly, isLoading: yearLoading, selectedYear } = useYear();

  const [tab, setTab] = useState<'saisie' | 'resultats' | 'config'>('saisie');
  const [loading, setLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [period, setPeriod] = useState('1er Trimestre');
  const [year, setYear] = useState(selectedYear?.label || '2025-2026');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [rawGrades, setRawGrades] = useState<any[]>([]);
  const [searchSaisie, setSearchSaisie] = useState('');
  const [searchBulletins, setSearchBulletins] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubCoeff, setNewSubCoeff] = useState('1');
  const [newSubLang, setNewSubLang] = useState<SubjectLanguage>('fr');
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [savedGrades, setSavedGrades] = useState<Set<string>>(new Set());
  const [deletedGrades, setDeletedGrades] = useState<Set<string>>(new Set());
  const [gradesRevision, setGradesRevision] = useState(0);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [sectionFilter, setSectionFilter] = useState<'all' | SubjectLanguage>('all');
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const loadRequestIdRef = useRef(0);
  const [school, setSchool] = useState<any>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);

  // Options Mode Bulletin : Classique (défaut) vs Franco-Arabe (paysage côte à côte)
  const [bulletinMode, setBulletinMode] = useState<BulletinMode>('classic');
  const [francoArabicCombined, setFrancoArabicCombined] = useState<boolean>(false);
  const [dbMissingLanguageCol, setDbMissingLanguageCol] = useState<boolean>(false);

  // États pour le réordonnancement et la modification des matières
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubCoeff, setEditSubCoeff] = useState('1');
  const [editSubLang, setEditSubLang] = useState<SubjectLanguage>('fr');

  const isFrancoArabic = bulletinMode === 'franco_arabic';

  useEffect(() => {
    if (selectedYear?.label) {
      setYear(selectedYear.label);
    }
  }, [selectedYear?.label]);

  useCacheRefresh({
    cachePattern: /^(class_subjects:|student_grades:)/,
    onInvalidate: () => {
      if (selectedClassId) {
        loadClassData(true);
      }
    },
    debounceMs: 150,
    refreshOnFocus: true,
    refreshOnVisibilityChange: true,
    refreshIntervalMs: 120000,
  });

  const isSecondCycle = useMemo(() => {
    const currentClass = classes.find(c => c.id === selectedClassId);
    if (!currentClass) return false;
    const name = currentClass.name.toLowerCase();
    return name.includes('7') || name.includes('8') || name.includes('9') || name.includes('10') || name.includes('11') || name.includes('12');
  }, [selectedClassId, classes]);

  const baseScale = isSecondCycle ? 20 : 10;

  useEffect(() => {
    async function getClasses() {
      if (!selectedYearId) return;
      const { data, error } = await offlineFetch<any[]>(`bulletins_classes:${selectedYearId}`, async () => {
        return await supabase.from('classes').select('*').eq('academic_year_id', selectedYearId);
      });
      if (error) console.error('Erreur récupération classes hors ligne :', error);
      setClasses(data || []);
    }
    if (!yearLoading && selectedYearId) {
      getClasses();
    }
  }, [selectedYearId, yearLoading]);

  useEffect(() => {
    async function fetchSchool() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('school_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.school_id) {
          const { data, error } = await offlineFetch<any>(`bulletins_school:${profile.school_id}`, async () => {
            return await supabase
              .from('schools')
              .select('*')
              .eq('id', profile.school_id)
              .maybeSingle();
          });
          if (error) throw error;
          if (data) {
            setSchool(data);
            // Synchroniser les options Franco-Arabe depuis la BDD si présentes, sinon depuis localStorage
            const localKey = `bulletin_options:${data.id}`;
            let localPrefs: { mode?: BulletinMode; combined?: boolean } = {};
            if (typeof window !== 'undefined') {
              try {
                localPrefs = JSON.parse(localStorage.getItem(localKey) || '{}');
              } catch { }
            }
            if (data.bulletin_mode === 'classic' || data.bulletin_mode === 'franco_arabic') {
              setBulletinMode(data.bulletin_mode);
            } else if (localPrefs.mode === 'classic' || localPrefs.mode === 'franco_arabic') {
              setBulletinMode(localPrefs.mode);
            }
            if (typeof data.franco_arabic_combined === 'boolean') {
              setFrancoArabicCombined(data.franco_arabic_combined);
            } else if (typeof localPrefs.combined === 'boolean') {
              setFrancoArabicCombined(localPrefs.combined);
            }
          }
        }
      } catch (error) {
        console.error('Erreur récupération école:', error);
      } finally {
        setLoadingSchool(false);
      }
    }
    fetchSchool();
  }, []);

  // Chargement initial local avant même la réponse école (évite le clignotement)
  useEffect(() => {
    if (typeof window === 'undefined' || school?.id) return;
    try {
      const saved = JSON.parse(localStorage.getItem('bulletin_options:default') || '{}');
      if (saved.mode === 'classic' || saved.mode === 'franco_arabic') {
        setBulletinMode(saved.mode);
      }
      if (typeof saved.combined === 'boolean') {
        setFrancoArabicCombined(saved.combined);
      }
    } catch { }
  }, [school?.id]);

  const persistBulletinOptions = async (mode: BulletinMode, combined: boolean) => {
    setBulletinMode(mode);
    setFrancoArabicCombined(combined);
    if (mode === 'classic') {
      setSectionFilter('all');
      setSelectedSubjectFilter('all');
    }

    if (typeof window !== 'undefined') {
      const payload = JSON.stringify({ mode, combined });
      localStorage.setItem('bulletin_options:default', payload);
      if (school?.id) {
        localStorage.setItem(`bulletin_options:${school.id}`, payload);
      }
    }

    if (school?.id) {
      try {
        const { error } = await supabase
          .from('schools')
          .update({
            bulletin_mode: mode,
            franco_arabic_combined: combined,
          })
          .eq('id', school.id);
        if (error && !isMissingColumnError(error, 'bulletin_mode') && !isMissingColumnError(error, 'franco_arabic_combined')) {
          console.error('Erreur sauvegarde options bulletin :', error);
        }
      } catch { }
    }
  };

  const getLocalLanguageMap = (classId: string, yearId: string): Record<string, SubjectLanguage> => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(`subject_language:${classId}:${yearId}`) || '{}');
    } catch {
      return {};
    }
  };

  const setLocalLanguageEntry = (classId: string, yearId: string, subjectId: string, lang: SubjectLanguage) => {
    if (typeof window === 'undefined') return;
    const key = `subject_language:${classId}:${yearId}`;
    const map = getLocalLanguageMap(classId, yearId);
    map[String(subjectId)] = lang;
    localStorage.setItem(key, JSON.stringify(map));
  };

  const enrichSubjectsWithLanguage = (subList: any[], classId: string, yearId: string) => {
    const localMap = getLocalLanguageMap(classId, yearId);
    let detectedDbColumn = false;

    const enriched = subList.map((sub) => {
      const hasDbValue = sub && (sub.language === 'fr' || sub.language === 'ar');
      if (hasDbValue) detectedDbColumn = true;
      const localOverride = localMap[String(sub.id)];
      const resolvedLang: SubjectLanguage = hasDbValue
        ? sub.language
        : localOverride === 'fr' || localOverride === 'ar'
          ? localOverride
          : detectSubjectLanguage(sub.subject_name);
      return {
        ...sub,
        language: resolvedLang,
      };
    });

    if (subList.length > 0) {
      setDbMissingLanguageCol(!detectedDbColumn);
    }

    return enriched;
  };

  useEffect(() => {
    if (selectedClassId) {
      loadClassData(false);
    } else {
      setSubjects([]);
      setStudents([]);
      setRawGrades([]);
    }
  }, [selectedClassId, period, year, selectedYearId]);

  const applySavedSubjectOrder = (subList: any[], classId: string, yearId: string) => {
    if (typeof window === 'undefined') return subList;
    const orderKey = `subject_order:${classId}:${yearId}`;
    const savedOrderRaw = localStorage.getItem(orderKey);
    if (!savedOrderRaw) return subList;
    try {
      const orderIds: string[] = JSON.parse(savedOrderRaw);
      return [...subList].sort((a, b) => {
        const idxA = orderIds.indexOf(String(a.id));
        const idxB = orderIds.indexOf(String(b.id));
        if (idxA === -1 && idxB === -1) return 0;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
    } catch {
      return subList;
    }
  };

  async function loadClassData(silent = false) {
    if (!selectedYearId || !selectedClassId) return;

    const currentRequestId = ++loadRequestIdRef.current;

    if (!silent) {
      setLoading(true);
      setRawGrades([]);
      setSavedGrades(new Set());
    }

    try {
      const [subRes, stuRes, grdRes] = await Promise.all([
        offlineFetch<any[]>(`bulletins_subjects:${selectedClassId}:${selectedYearId}`, async () => {
          return await supabase
            .from('class_subjects')
            .select('*')
            .eq('class_id', selectedClassId)
            .eq('academic_year_id', selectedYearId);
        }),
        offlineFetch<any[]>(`bulletins_students:${selectedClassId}:${selectedYearId}`, async () => {
          return await supabase
            .from('students')
            .select('*')
            .eq('class_id', selectedClassId)
            .eq('academic_year_id', selectedYearId);
        }),
        offlineFetch<any[]>(`bulletins_grades:${selectedClassId}:${period}:${year}`, async () => {
          return await supabase
            .from('student_grades')
            .select('*')
            .eq('class_id', selectedClassId)
            .eq('period', period)
            .eq('academic_year', year);
        })
      ]);

      if (currentRequestId !== loadRequestIdRef.current) return;

      if (subRes.error) console.error('Erreur récupération matières hors ligne :', subRes.error);
      if (stuRes.error) console.error('Erreur récupération élèves hors ligne :', stuRes.error);
      if (grdRes.error) console.error('Erreur récupération notes hors ligne :', grdRes.error);

      const orderedSubjects = applySavedSubjectOrder(subRes.data || [], selectedClassId, String(selectedYearId));
      const enrichedSubjects = enrichSubjectsWithLanguage(orderedSubjects, selectedClassId, String(selectedYearId));

      setSubjects(enrichedSubjects);
      setStudents(stuRes.data || []);
      setRawGrades(grdRes.data || []);
      if (!silent) {
        setCurrentStudentIndex(0);
      }
    } finally {
      if (currentRequestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }

  const moveSubject = (index: number, direction: 'up' | 'down', sectionLang?: SubjectLanguage) => {
    if (isReadOnly) return;

    let targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (sectionLang) {
      const step = direction === 'up' ? -1 : 1;
      targetIndex = -1;
      for (let i = index + step; i >= 0 && i < subjects.length; i += step) {
        const lang: SubjectLanguage = subjects[i].language === 'ar' ? 'ar' : 'fr';
        if (lang === sectionLang) {
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex < 0 || targetIndex >= subjects.length) return;

    const updated = [...subjects];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);

    setSubjects(updated);

    if (typeof window !== 'undefined' && selectedClassId && selectedYearId) {
      const orderKey = `subject_order:${selectedClassId}:${selectedYearId}`;
      localStorage.setItem(orderKey, JSON.stringify(updated.map((s) => String(s.id))));
    }
  };

  const startEditSubject = (subject: any) => {
    if (isReadOnly) return;
    setEditingSubjectId(String(subject.id));
    setEditSubName(subject.subject_name);
    setEditSubCoeff(String(subject.coefficient));
    setEditSubLang(subject.language === 'ar' ? 'ar' : 'fr');
  };

  const toggleSubjectLanguage = async (subject: any, targetLang: SubjectLanguage) => {
    if (isReadOnly || !selectedClassId || !selectedYearId) return;
    const subId = String(subject.id);

    setLocalLanguageEntry(selectedClassId, String(selectedYearId), subId, targetLang);
    setSubjects((prev) =>
      prev.map((s) => (String(s.id) === subId ? { ...s, language: targetLang } : s))
    );

    const { error } = await offlineWrite({
      table: 'class_subjects',
      action: 'UPDATE',
      payload: { language: targetLang },
      options: { keyColumn: 'id', keyValue: subId },
      cacheKey: `bulletins_subjects:${selectedClassId}:${selectedYearId}`,
    });

    if (error && isMissingColumnError(error, 'language')) {
      setDbMissingLanguageCol(true);
    } else if (!error) {
      setDbMissingLanguageCol(false);
    }
  };

  const saveEditSubject = async (subject: any) => {
    if (isReadOnly || !editSubName.trim() || !selectedClassId || !selectedYearId) return;

    const trimmedName = editSubName.trim();
    const parsedCoeff = parseFloat(editSubCoeff);
    if (isNaN(parsedCoeff) || parsedCoeff <= 0) return;

    const oldName = subject.subject_name;
    const subId = String(subject.id);
    const chosenLang: SubjectLanguage = isFrancoArabic ? editSubLang : (subject.language === 'ar' ? 'ar' : 'fr');

    setLocalLanguageEntry(selectedClassId, String(selectedYearId), subId, chosenLang);

    const optimisticUpdate = () => {
      setSubjects((prev) =>
        prev.map((s) =>
          String(s.id) === subId
            ? { ...s, subject_name: trimmedName, coefficient: parsedCoeff, language: chosenLang }
            : s
        )
      );
    };

    let { error } = await offlineWrite({
      table: 'class_subjects',
      action: 'UPDATE',
      payload: {
        subject_name: trimmedName,
        coefficient: parsedCoeff,
        language: chosenLang,
      },
      options: { keyColumn: 'id', keyValue: subId },
      cacheKey: `bulletins_subjects:${selectedClassId}:${selectedYearId}`,
      optimisticUpdate,
    });

    // Fallback résilient si la colonne "language" n'existe pas encore dans Supabase
    if (error && isMissingColumnError(error, 'language')) {
      setDbMissingLanguageCol(true);
      const retry = await offlineWrite({
        table: 'class_subjects',
        action: 'UPDATE',
        payload: {
          subject_name: trimmedName,
          coefficient: parsedCoeff,
        },
        options: { keyColumn: 'id', keyValue: subId },
        cacheKey: `bulletins_subjects:${selectedClassId}:${selectedYearId}`,
      });
      error = retry.error;
    }

    if (!error) {
      if (oldName !== trimmedName) {
        setRawGrades((prev) =>
          prev.map((g) =>
            g.subject_name === oldName ? { ...g, subject_name: trimmedName } : g
          )
        );
        try {
          await supabase
            .from('student_grades')
            .update({ subject_name: trimmedName })
            .eq('class_id', selectedClassId)
            .eq('subject_name', oldName);
        } catch (err) {
          console.error('Erreur mise à jour nom matière dans les notes :', err);
        }
      }
      setEditingSubjectId(null);
      loadClassData(true);
    }
  };

  const addSubject = async () => {
    if (!selectedClassId || !newSubName.trim() || isReadOnly || !selectedYearId) return;
    const trimmedName = newSubName.trim();
    const parsedCoeff = parseFloat(newSubCoeff) || 1;
    // En mode Classique, une nouvelle matière est toujours Française ('fr').
    // En mode Franco-Arabe, on respecte strictement la section choisie (FR ou AR), même si le nom est en alphabet latin.
    const chosenLang: SubjectLanguage = isFrancoArabic ? newSubLang : 'fr';
    const tempId = `offline-${Date.now()}`;

    const basePayload = {
      class_id: selectedClassId,
      subject_name: trimmedName,
      coefficient: parsedCoeff,
      academic_year_id: selectedYearId,
    };

    const optimisticUpdate = () => {
      setSubjects((prev) => [
        ...prev,
        { id: tempId, ...basePayload, language: chosenLang },
      ]);
    };

    let { error } = await offlineWrite({
      table: 'class_subjects',
      action: 'INSERT',
      payload: { ...basePayload, language: chosenLang },
      cacheKey: `bulletins_subjects:${selectedClassId}:${selectedYearId}`,
      optimisticUpdate,
    });

    if (error && isMissingColumnError(error, 'language')) {
      setDbMissingLanguageCol(true);
      const { data: insertedRows, error: retryErr } = await supabase
        .from('class_subjects')
        .insert([basePayload])
        .select('id');
      error = retryErr;
      if (!retryErr && insertedRows && insertedRows[0]?.id) {
        setLocalLanguageEntry(selectedClassId, String(selectedYearId), String(insertedRows[0].id), chosenLang);
      }
    }

    if (!error) {
      setNewSubName('');
      loadClassData(true);
    }
  };

  const deleteSubject = async (id: string) => {
    if (isReadOnly) return;
    const { error } = await offlineWrite({
      table: 'class_subjects',
      action: 'DELETE',
      payload: {},
      options: { keyColumn: 'id', keyValue: id },
      cacheKey: `bulletins_subjects:${selectedClassId}:${selectedYearId}`,
      optimisticUpdate: () => {
        setSubjects((prev) => prev.filter((s) => String(s.id) !== id));
      }
    });
    if (!error) loadClassData(true);
  };

  const filteredStudentsSaisie = useMemo(() => {
    return students.filter(s => `${s.last_name} ${s.first_name}`.toLowerCase().includes(searchSaisie.toLowerCase()));
  }, [students, searchSaisie]);

  const frenchSubjects = useMemo(
    () => subjects.filter((s) => (s.language === 'ar' ? 'ar' : 'fr') === 'fr'),
    [subjects]
  );

  const arabicSubjects = useMemo(
    () => subjects.filter((s) => s.language === 'ar'),
    [subjects]
  );

  const activeModeSubjects = useMemo(
    () => (isFrancoArabic ? subjects : frenchSubjects),
    [isFrancoArabic, subjects, frenchSubjects]
  );

  const displayedSubjects = useMemo(() => {
    let list = activeModeSubjects;
    if (isFrancoArabic && sectionFilter !== 'all') {
      list = list.filter((s) => (s.language === 'ar' ? 'ar' : 'fr') === sectionFilter);
    }
    if (selectedSubjectFilter !== 'all') {
      list = list.filter((s) => String(s.id) === String(selectedSubjectFilter));
    }
    return list;
  }, [activeModeSubjects, selectedSubjectFilter, isFrancoArabic, sectionFilter]);

  // Une matière est dispensée/exemptée lorsqu'une ligne existe avec grade_value === null ET compo_value === null (ou -1 hérité)
  const isGradeRecordExempt = (gradeRecord: any) => {
    if (!gradeRecord) return false;
    const gVal = gradeRecord.grade_value;
    const cVal = gradeRecord.compo_value;
    if (Number(gVal) === -1 || Number(cVal) === -1) return true;
    return (gVal === null || gVal === undefined) && (cVal === null || cVal === undefined);
  };

  const bulletinData = useMemo<BulletinStudentData[]>(() => {
    const rawList = students.map(student => {
      let totalPondere = 0;
      let totalCoeffs = 0;
      let totalPointsFr = 0;
      let totalCoeffsFr = 0;
      let totalPointsAr = 0;
      let totalCoeffsAr = 0;

      // En mode Classique, on n'inclut JAMAIS les matières arabes dans le bulletin français
      const effectiveSubjects = isFrancoArabic ? subjects : frenchSubjects;

      const detailNotes: BulletinNoteItem[] = effectiveSubjects.map(sub => {
        const coeff = Number(sub.coefficient) || 1;
        const lang: SubjectLanguage = sub.language === 'ar' ? 'ar' : 'fr';
        const matchingGrade = rawGrades.find(g => g.student_id === student.id && g.subject_name === sub.subject_name);

        if (isGradeRecordExempt(matchingGrade)) {
          return {
            name: sub.subject_name,
            language: lang,
            noteClasse: null,
            noteCompo: null,
            moyenneMatiere: null,
            coeff,
            points: 0,
            isExempt: true
          };
        }

        const noteClasse = matchingGrade && matchingGrade.grade_value !== null ? parseFloat(matchingGrade.grade_value) || 0 : 0;
        const noteCompo = matchingGrade && matchingGrade.compo_value !== null ? parseFloat(matchingGrade.compo_value) || 0 : 0;

        const normClasse = noteClasse / coeff;
        const normCompo = noteCompo / coeff;

        let moyenneMatiere = 0;
        if (isSecondCycle) {
          moyenneMatiere = (normClasse + (normCompo * 2)) / 3;
        } else {
          moyenneMatiere = normCompo;
        }

        const points = moyenneMatiere * coeff;
        totalPondere += points;
        totalCoeffs += coeff;

        if (lang === 'ar') {
          totalPointsAr += points;
          totalCoeffsAr += coeff;
        } else {
          totalPointsFr += points;
          totalCoeffsFr += coeff;
        }

        return {
          name: sub.subject_name,
          language: lang,
          noteClasse,
          noteCompo,
          moyenneMatiere: parseFloat(moyenneMatiere.toFixed(2)),
          coeff,
          points,
          isExempt: false
        };
      });

      const moyenne = totalCoeffs > 0 ? totalPondere / totalCoeffs : 0;
      const moyenneFr = totalCoeffsFr > 0 ? totalPointsFr / totalCoeffsFr : 0;
      const moyenneAr = totalCoeffsAr > 0 ? totalPointsAr / totalCoeffsAr : 0;

      return {
        ...student,
        notes: detailNotes,
        notesFr: detailNotes.filter((n) => n.language === 'fr'),
        notesAr: detailNotes.filter((n) => n.language === 'ar'),
        moyenne: parseFloat(moyenne.toFixed(2)),
        totalPoints: totalPondere,
        totalCoeffs,
        moyenneFr: parseFloat(moyenneFr.toFixed(2)),
        totalPointsFr,
        totalCoeffsFr,
        moyenneAr: parseFloat(moyenneAr.toFixed(2)),
        totalPointsAr,
        totalCoeffsAr,
        rang: 1,
        rangFr: 1,
        rangAr: 1,
      };
    });

    // Calcul des rangs globaux, français et arabes indépendamment
    const rankByGlobal = [...rawList].sort((a, b) => b.moyenne - a.moyenne);
    const rankByFr = [...rawList].sort((a, b) => b.moyenneFr - a.moyenneFr);
    const rankByAr = [...rawList].sort((a, b) => b.moyenneAr - a.moyenneAr);

    const globalRankMap = new Map<string, number>();
    const frRankMap = new Map<string, number>();
    const arRankMap = new Map<string, number>();

    rankByGlobal.forEach((s, idx) => globalRankMap.set(String(s.id), idx + 1));
    rankByFr.forEach((s, idx) => frRankMap.set(String(s.id), idx + 1));
    rankByAr.forEach((s, idx) => arRankMap.set(String(s.id), idx + 1));

    const ranked: BulletinStudentData[] = rawList
      .map((s) => ({
        ...s,
        rang: globalRankMap.get(String(s.id)) || 1,
        rangFr: frRankMap.get(String(s.id)) || 1,
        rangAr: arRankMap.get(String(s.id)) || 1,
      }))
      .sort((a, b) => {
        if (isFrancoArabic && !francoArabicCombined) {
          if (a.totalCoeffsFr > 0 || b.totalCoeffsFr > 0) {
            return b.moyenneFr - a.moyenneFr;
          }
          return b.moyenneAr - a.moyenneAr;
        }
        return b.moyenne - a.moyenne;
      });

    return ranked.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchBulletins.toLowerCase()));
  }, [students, subjects, frenchSubjects, rawGrades, isSecondCycle, searchBulletins, isFrancoArabic, francoArabicCombined]);

  const getMention = (m: number) => {
    const ratio = m / baseScale;
    if (ratio >= 0.8) return "Très Bien";
    if (ratio >= 0.7) return "Bien";
    if (ratio >= 0.6) return "Assez Bien";
    if (ratio >= 0.5) return "Passable";
    return "Insuffisant";
  };

  const getAppreciation = (note: number | null, isExempt?: boolean) => {
    if (isExempt || note === null) return "Non évalué (Justifié)";
    const ratio = note / baseScale;
    if (ratio >= 0.9) return "Excellent travail";
    if (ratio >= 0.8) return "Très bien";
    if (ratio >= 0.7) return "Bien";
    if (ratio >= 0.6) return "Assez bien";
    if (ratio >= 0.5) return "Passable, des efforts à faire";
    if (ratio >= 0.4) return "Insuffisant, doit travailler plus";
    if (ratio >= 0.25) return "Faible, attention";
    return "Très faible";
  };

  const formatInputDisplayValue = (gradeRecord: any, field: 'grade_value' | 'compo_value') => {
    if (!gradeRecord) return '';
    if (isGradeRecordExempt(gradeRecord)) return '—';
    const rawVal = gradeRecord[field];
    if (rawVal === null || rawVal === undefined || rawVal === '') return '';
    return String(rawVal);
  };

  const applyScaleToFit = (el: HTMLElement, isLandscape = false) => {
    el.style.transform = '';
    el.style.transformOrigin = '';
    el.style.lineHeight = '';
    el.style.fontSize = '';
    let needsAttach = !el.isConnected;
    if (needsAttach) {
      document.body.appendChild(el);
    }
    const h = el.scrollHeight;
    if (needsAttach) {
      document.body.removeChild(el);
    }
    const mmToPx = (mm: number) => mm * (96 / 25.4);
    const TARGET_HEIGHT_PX = isLandscape ? mmToPx(210) - 8 : mmToPx(297) - 20;
    if (h > TARGET_HEIGHT_PX) {
      const scale = Math.max(0.55, TARGET_HEIGHT_PX / h);
      el.style.transformOrigin = 'top left';
      el.style.transform = `scale(${scale})`;
      if (!isLandscape) {
        el.style.lineHeight = '1.05';
        el.style.fontSize = `calc(1rem * ${scale})`;
      }
      return () => {
        el.style.transform = '';
        el.style.transformOrigin = '';
        el.style.lineHeight = '';
        el.style.fontSize = '';
      };
    }
    return () => { };
  };

  const downloadPDF = async (student: any) => {
    const [{ jsPDF }, html2canvas] = await Promise.all([
      import('jspdf').then(m => ({ jsPDF: (m as any).jsPDF || (m as any).default?.jsPDF || (m as any).default })),
      import('html2canvas').then(m => (m as any).default || m)
    ]);
    const element = document.getElementById(`bulletin-pdf-${student.id}`);
    if (!element) return;
    const isLandscape = isFrancoArabic;
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.display = isLandscape ? 'flex' : 'block';
    clone.style.width = isLandscape ? '297mm' : '210mm';
    clone.style.boxSizing = 'border-box';
    clone.style.position = 'fixed';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    document.body.appendChild(clone);
    const reset = applyScaleToFit(clone, isLandscape);
    try {
      const canvas = await (html2canvas as any)(clone, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new (jsPDF as any)({
        unit: 'mm',
        format: 'a4',
        orientation: isLandscape ? 'landscape' : 'portrait',
      });
      const pageWidthMM = pdf.internal.pageSize.getWidth();
      const pageHeightMM = pdf.internal.pageSize.getHeight();
      const imgProps = (pdf as any).getImageProperties(imgData);
      let pdfW = pageWidthMM;
      let pdfH = (imgProps.height * pdfW) / imgProps.width;
      if (pdfH > pageHeightMM) {
        const scale = pageHeightMM / pdfH;
        pdfW = pdfW * scale;
        pdfH = pageHeightMM;
      }
      const x = (pageWidthMM - pdfW) / 2;
      const y = isLandscape ? (pageHeightMM - pdfH) / 2 : 0;
      pdf.addImage(imgData, 'JPEG', x, y, pdfW, pdfH);
      const suffix = isLandscape ? '_FrancoArabe' : '';
      const filename = `Bulletin${suffix}_${student.first_name}_${student.last_name}_${period}.pdf`;
      pdf.save(filename);
    } finally {
      reset();
      document.body.removeChild(clone);
    }
  };

  const downloadAllInOnePDF = async () => {
    if (bulletinData.length === 0) return;
    setIsExportingPdf(true);
    try {
      const [{ jsPDF }, html2canvas] = await Promise.all([
        import('jspdf').then(m => ({ jsPDF: (m as any).jsPDF || (m as any).default?.jsPDF || (m as any).default })),
        import('html2canvas').then(m => (m as any).default || m)
      ]);
      const isLandscape = isFrancoArabic;
      const pdf = new (jsPDF as any)({
        unit: 'mm',
        format: 'a4',
        orientation: isLandscape ? 'landscape' : 'portrait',
      });
      const pageWidthMM = pdf.internal.pageSize.getWidth();
      const pageHeightMM = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < bulletinData.length; i++) {
        const student = bulletinData[i];
        const element = document.getElementById(`bulletin-pdf-${student.id}`);
        if (!element) continue;
        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.display = isLandscape ? 'flex' : 'block';
        clone.style.width = isLandscape ? '297mm' : '210mm';
        clone.style.boxSizing = 'border-box';
        if (!isLandscape) {
          clone.style.padding = '16px';
          clone.style.fontSize = '12px';
          clone.style.lineHeight = '1.1';
        }
        try {
          Array.from(clone.querySelectorAll('img')).forEach((img: any) => {
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
          });
        } catch (_) { }
        clone.style.position = 'fixed';
        clone.style.left = '-9999px';
        clone.style.top = '0';
        document.body.appendChild(clone);
        const resetScale = applyScaleToFit(clone, isLandscape);
        const canvas = await (html2canvas as any)(clone, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const imgProps = (pdf as any).getImageProperties(imgData);

        let renderW = pageWidthMM;
        let renderH = (imgProps.height * renderW) / imgProps.width;
        let x = 0;
        let y = 0;

        if (isLandscape) {
          if (renderH > pageHeightMM) {
            const scale = pageHeightMM / renderH;
            renderW = renderW * scale;
            renderH = pageHeightMM;
          }
          x = (pageWidthMM - renderW) / 2;
          y = (pageHeightMM - renderH) / 2;
        } else {
          const pxToMm = (px: number) => (px * 25.4) / 96;
          const imgWmm = pxToMm(imgProps.width);
          const imgHmm = pxToMm(imgProps.height);
          const pageMarginMM = 10;
          const maxW = pageWidthMM - pageMarginMM * 2;
          const maxH = pageHeightMM - pageMarginMM * 2;
          renderW = Math.min(imgWmm, maxW);
          renderH = (imgHmm * renderW) / imgWmm;
          if (renderH > maxH) {
            renderH = maxH;
            renderW = (imgWmm * renderH) / imgHmm;
          }
          x = (pageWidthMM - renderW) / 2;
          y = pageMarginMM;
        }

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', x, y, renderW, renderH);
        try {
          resetScale();
        } catch (_) { }
        document.body.removeChild(clone);
      }
      const className = classes.find(c => c.id === selectedClassId)?.name || 'Classe';
      const suffix = isLandscape ? '_FrancoArabe' : '';
      pdf.save(`Bulletins_Complets${suffix}_${className}_${period}.pdf`);
    } catch (error) {
      console.error("Erreur lors de la génération du PDF groupé", error);
    }
    setIsExportingPdf(false);
  };

  const flashDeletedFeedback = (keys: string[]) => {
    setDeletedGrades((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
    setTimeout(() => {
      setDeletedGrades((prev) => {
        const next = new Set(prev);
        keys.forEach((k) => next.delete(k));
        return next;
      });
    }, 800);
  };

  const clearSubjectGrade = async (studentId: string, subjectName: string) => {
    if (isReadOnly) return;
    const existingGrade = rawGrades.find(
      (g) =>
        String(g.student_id) === String(studentId) &&
        g.subject_name === subjectName &&
        g.period === period &&
        String(g.academic_year) === String(year)
    );
    if (!existingGrade?.id) return;

    const cacheKey = `bulletins_grades:${selectedClassId}:${period}:${year}`;

    if (String(existingGrade.id).startsWith('temp-')) {
      setRawGrades((prev) => prev.filter((g) => g.id !== existingGrade.id));
    } else {
      const { error } = await offlineWrite({
        table: 'student_grades',
        action: 'DELETE',
        payload: {},
        options: { keyColumn: 'id', keyValue: existingGrade.id },
        cacheKey,
        optimisticUpdate: () => {
          setRawGrades((prev) => prev.filter((g) => g.id !== existingGrade.id));
        },
      });
      if (error) {
        console.error('Erreur DELETE note :', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return;
      }
    }

    const gradeInput = inputRefs.current[`${studentId}-${subjectName}-grade`];
    const compoInput = inputRefs.current[`${studentId}-${subjectName}-compo`];
    if (gradeInput) gradeInput.value = '';
    if (compoInput) compoInput.value = '';
    setGradesRevision((v) => v + 1);
    flashDeletedFeedback([
      `${studentId}-${subjectName}-grade_value`,
      `${studentId}-${subjectName}-compo_value`,
    ]);
  };

  const clearStudentGrades = async (studentId: string, studentLabel: string) => {
    if (isReadOnly) return;
    const allowedSubjectNames = new Set(displayedSubjects.map((s) => s.subject_name));
    const gradesToDelete = rawGrades.filter(
      (g) =>
        String(g.student_id) === String(studentId) &&
        allowedSubjectNames.has(g.subject_name) &&
        g.period === period &&
        String(g.academic_year) === String(year)
    );

    if (gradesToDelete.length === 0) return;

    const confirmed = window.confirm(
      `Supprimer ${gradesToDelete.length} note(s) enregistrée(s) pour ${studentLabel} (${period}) ?`
    );
    if (!confirmed) return;

    const idsToDelete = gradesToDelete.map((g) => g.id);
    const persistedIds = idsToDelete.filter((id) => !String(id).startsWith('temp-'));

    setRawGrades((prev) => prev.filter((g) => !idsToDelete.includes(g.id)));

    if (persistedIds.length > 0) {
      const { error } = await supabase
        .from('student_grades')
        .delete()
        .in('id', persistedIds);
      if (error) {
        console.error('Erreur suppression notes élève :', error);
        loadClassData(true);
        return;
      }
    }

    gradesToDelete.forEach((g) => {
      const gradeInput = inputRefs.current[`${studentId}-${g.subject_name}-grade`];
      const compoInput = inputRefs.current[`${studentId}-${g.subject_name}-compo`];
      if (gradeInput) gradeInput.value = '';
      if (compoInput) compoInput.value = '';
    });
    setGradesRevision((v) => v + 1);
  };

  const saveGrade = async (
    studentId: string,
    subjectName: string,
    field: 'grade_value' | 'compo_value',
    value: string,
    inputEl?: HTMLInputElement | null
  ) => {
    if (isReadOnly) return;
    const trimmed = value.trim();
    if (trimmed === '—') return;

    const existingGrade = rawGrades.find(
      (g) =>
        String(g.student_id) === String(studentId) &&
        g.subject_name === subjectName &&
        g.period === period &&
        String(g.academic_year) === String(year)
    );

    const gradeKey = `${studentId}-${subjectName}-${field}`;
    const cacheKey = `bulletins_grades:${selectedClassId}:${period}:${year}`;

    // SUPPRESSION D'UNE NOTE DÉJÀ SAISIE LORSQUE LE CHAMP EST VIDÉ
    if (trimmed === '') {
      if (!existingGrade) return;

      const otherField: 'grade_value' | 'compo_value' =
        field === 'grade_value' ? 'compo_value' : 'grade_value';
      const otherFieldHasValue =
        isSecondCycle &&
        !isGradeRecordExempt(existingGrade) &&
        existingGrade[otherField] !== null &&
        existingGrade[otherField] !== undefined &&
        existingGrade[otherField] !== '';

      // Si l'autre note (Classe ou Compo en 2nd cycle) existe encore, on met uniquement ce champ à null
      if (otherFieldHasValue) {
        const currentFieldWasEmpty =
          existingGrade[field] === null || existingGrade[field] === undefined || existingGrade[field] === '';
        if (currentFieldWasEmpty) return;

        const { error } = await offlineWrite({
          table: 'student_grades',
          action: 'UPDATE',
          payload: { [field]: null },
          options: { keyColumn: 'id', keyValue: existingGrade.id },
          cacheKey,
          optimisticUpdate: () => {
            setRawGrades((prev) =>
              prev.map((g) => (g.id === existingGrade.id ? { ...g, [field]: null } : g))
            );
          },
        });

        if (!error) {
          flashDeletedFeedback([gradeKey]);
        } else {
          console.error('Erreur suppression partielle note :', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
      } else {
        // Sinon, plus aucune note restante (ou dispense effacée) : on supprime la ligne complète
        if (String(existingGrade.id).startsWith('temp-')) {
          setRawGrades((prev) => prev.filter((g) => g.id !== existingGrade.id));
          flashDeletedFeedback([gradeKey]);
          return;
        }

        const { error } = await offlineWrite({
          table: 'student_grades',
          action: 'DELETE',
          payload: {},
          options: { keyColumn: 'id', keyValue: existingGrade.id },
          cacheKey,
          optimisticUpdate: () => {
            setRawGrades((prev) => prev.filter((g) => g.id !== existingGrade.id));
          },
        });

        if (!error) {
          const otherInputKey =
            field === 'grade_value'
              ? `${studentId}-${subjectName}-compo`
              : `${studentId}-${subjectName}-grade`;
          if (inputRefs.current[otherInputKey]?.value === '—') {
            inputRefs.current[otherInputKey]!.value = '';
          }
          flashDeletedFeedback([gradeKey]);
        } else {
          console.error('Erreur DELETE note :', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
      }
      return;
    }

    // Détection du code "000" ou "0000" pour neutraliser la matière (null sur les deux notes)
    const isExemptionCode = /^0{3,}$/.test(trimmed);
    let valToSave: number | null = null;

    if (isExemptionCode) {
      if (inputEl) {
        inputEl.value = '—';
      }
    } else {
      const normalized = trimmed.replace(',', '.');
      const val = parseFloat(normalized);
      const subjectObj = subjects.find((s) => s.subject_name === subjectName);
      const coeff = Number(subjectObj?.coefficient) || 1;
      const maxGrade = baseScale * coeff;

      if (isNaN(val) || val < 0 || val > maxGrade) return;
      valToSave = val;
    }

    const updatePayload = isExemptionCode
      ? { grade_value: null, compo_value: null }
      : { [field]: valToSave };

    if (existingGrade?.id && !String(existingGrade.id).startsWith('temp-')) {
      const { error } = await offlineWrite({
        table: 'student_grades',
        action: 'UPDATE',
        payload: updatePayload,
        options: { keyColumn: 'id', keyValue: existingGrade.id },
        cacheKey: cacheKey,
        optimisticUpdate: () => {
          setRawGrades((prev) =>
            prev.map((g) => (g.id === existingGrade.id ? { ...g, ...updatePayload } : g))
          );
        },
      });

      if (!error) {
        setSavedGrades((prev) => new Set(prev).add(gradeKey));
        setTimeout(() => {
          setSavedGrades((prev) => {
            const next = new Set(prev);
            next.delete(gradeKey);
            return next;
          });
        }, 800);
      } else {
        console.error('Erreur UPDATE note :', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      }
    } else {
      const newGradePayload: any = {
        student_id: studentId,
        class_id: selectedClassId,
        subject_name: subjectName,
        period: period,
        academic_year: year,
        academic_year_id: selectedYearId,
        ...updatePayload,
      };

      if (school?.id) {
        newGradePayload.school_id = school.id;
      }

      const tempId = `temp-${Date.now()}`;

      const { error } = await offlineWrite({
        table: 'student_grades',
        action: 'INSERT',
        payload: [newGradePayload],
        cacheKey: cacheKey,
        optimisticUpdate: () => {
          setRawGrades((prev) => [...prev, { id: tempId, ...newGradePayload }]);
        },
      });

      if (!error) {
        setSavedGrades((prev) => new Set(prev).add(gradeKey));
        setTimeout(() => {
          setSavedGrades((prev) => {
            const next = new Set(prev);
            next.delete(gradeKey);
            return next;
          });
        }, 800);
        loadClassData(true);
      } else {
        console.error('Erreur INSERT note :', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      }
    }
  };

  const handleMatrixKeyDown = (
    e: React.KeyboardEvent,
    studentIdx: number,
    subIdx: number,
    field: 'grade' | 'compo'
  ) => {
    const numStudents = filteredStudentsSaisie.length;
    const numSubjects = displayedSubjects.length;

    let targetStudentIdx = studentIdx;
    let targetSubIdx = subIdx;
    let targetField = field;

    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      if (studentIdx < numStudents - 1) {
        targetStudentIdx = studentIdx + 1;
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (studentIdx > 0) {
        targetStudentIdx = studentIdx - 1;
      }
    } else if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
      if (e.key === 'ArrowRight') e.preventDefault();
      if (isSecondCycle && field === 'grade') {
        targetField = 'compo';
      } else if (subIdx < numSubjects - 1) {
        targetSubIdx = subIdx + 1;
        targetField = isSecondCycle ? 'grade' : 'compo';
      }
    } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
      if (e.key === 'ArrowLeft') e.preventDefault();
      if (isSecondCycle && field === 'compo') {
        targetField = 'grade';
      } else if (subIdx > 0) {
        targetSubIdx = subIdx - 1;
        targetField = isSecondCycle ? 'compo' : 'compo';
      }
    } else {
      return;
    }

    const nextStudent = filteredStudentsSaisie[targetStudentIdx];
    const nextSub = displayedSubjects[targetSubIdx];
    if (nextStudent && nextSub) {
      const targetKey = `${nextStudent.id}-${nextSub.subject_name}-${targetField}`;
      inputRefs.current[targetKey]?.focus();
      inputRefs.current[targetKey]?.select();
    }
  };

  const activeMobileStudent = filteredStudentsSaisie[currentStudentIndex];

  return (
    <div className="w-full text-slate-900 font-sans antialiased pb-24">

      {/* 1. EN-TÊTE ÉPURÉ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 border-b border-slate-200/80 pb-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

          <div className="flex items-center gap-3">
            {loadingSchool ? (
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 animate-pulse">
                <BarChart3 size={20} />
              </div>
            ) : school?.logo_url ? (
              <img src={school.logo_url} alt="Logo" className="w-10 h-10 rounded-xl object-cover border border-slate-200" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <BarChart3 size={20} />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Bulletins de Notes</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 capitalize">
                {school?.name || 'Gestion des Évaluations'}
              </h1>
            </div>
          </div>

          {/* Onglets de contrôle */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 self-start sm:self-auto shadow-xs">
            {[
              { id: 'saisie', icon: PenTool, label: 'Saisie Notes' },
              { id: 'resultats', icon: Trophy, label: 'Bulletins' },
              { id: 'config', icon: Settings, label: 'Matières' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setTab(item.id as any)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${tab === item.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
              >
                <item.icon size={14} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">

        {/* 2. BARRE DE SÉLECTION CLASSE, PÉRIODE & OPTIONS BULLETIN */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Classe</label>
              <select
                onChange={(e) => setSelectedClassId(e.target.value)}
                value={selectedClassId}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-600 transition cursor-pointer"
              >
                <option value="">Sélectionner une classe...</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Période d'évaluation</label>
              <select
                onChange={(e) => setPeriod(e.target.value)}
                value={period}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-600 transition cursor-pointer"
              >
                <option>1er Trimestre</option>
                <option>2e Trimestre</option>
                <option>3e Trimestre</option>
                <option>Examen Final</option>
                <option>composition du mois de janvier</option>
                <option>composition du mois de février</option>
                <option>composition du mois de mars</option>
                <option>composition du mois d'avril</option>
                <option>composition du mois de mai</option>
                <option>composition du mois de juin</option>
                <option>composition du mois de juillet</option>
                <option>composition du mois d'août</option>
                <option>composition du mois de septembre</option>
                <option>composition du mois d'octobre</option>
                <option>composition du mois de novembre</option>
                <option>composition du mois de décembre</option>
              </select>
            </div>
          </div>

          {/* OPTIONS FORMAT BULLETIN : CLASSIQUE VS FRANCO-ARABE */}
          <div className="pt-3.5 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
                <Languages size={14} className="text-blue-600" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Modèle de bulletin :</span>
              </div>

              <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start">
                <button
                  type="button"
                  onClick={() => persistBulletinOptions('classic', francoArabicCombined)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${!isFrancoArabic
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  Classique (Portrait)
                </button>
                <button
                  type="button"
                  onClick={() => persistBulletinOptions('franco_arabic', francoArabicCombined)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${isFrancoArabic
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <Columns2 size={13} />
                  <span>Franco-Arabe (Paysage)</span>
                </button>
              </div>
            </div>

            {isFrancoArabic && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
                  <Calculator size={14} className="text-emerald-600" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Calcul :</span>
                </div>

                <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start">
                  <button
                    type="button"
                    onClick={() => persistBulletinOptions('franco_arabic', false)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${!francoArabicCombined
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    Séparés (FR | AR)
                  </button>
                  <button
                    type="button"
                    onClick={() => persistBulletinOptions('franco_arabic', true)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${francoArabicCombined
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    Rassemblés (FR + AR)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {!selectedClassId && (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <BarChart3 className="mx-auto text-slate-300 mb-2" size={28} />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Sélectionnez une classe ci-dessus pour gérer les notes et bulletins.
            </p>
          </div>
        )}

        {/* ========================================================== */}
        {/* ONGLET 1 : SAISIE DES NOTES OPTIMISÉE (PC MATRICE + MOBILE) */}
        {/* ========================================================== */}
        {tab === 'saisie' && selectedClassId && (
          <div className={isExpanded ? 'fixed inset-0 z-[100] w-screen h-screen bg-white p-4 sm:p-6 overflow-y-auto space-y-4' : 'space-y-4'}>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold" size={15} />
                <input
                  type="text"
                  value={searchSaisie}
                  onChange={(e) => setSearchSaisie(e.target.value)}
                  placeholder="Filtrer un élève par nom ou prénom..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="hidden lg:inline-block text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                  Videz une case pour supprimer • Tapez <strong className="text-slate-800">000</strong> pour dispenser (—)
                </span>

                {isFrancoArabic && (
                  <div className="inline-flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl">
                    {[
                      { id: 'all', label: 'Toutes' },
                      { id: 'fr', label: `FR (${frenchSubjects.length})` },
                      { id: 'ar', label: `AR (${arabicSubjects.length})` },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSectionFilter(opt.id as 'all' | SubjectLanguage);
                          setSelectedSubjectFilter('all');
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${sectionFilter === opt.id
                            ? opt.id === 'ar'
                              ? 'bg-emerald-600 text-white'
                              : opt.id === 'fr'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                <Filter size={14} className="text-slate-400 shrink-0 hidden sm:block" />
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-600 transition cursor-pointer"
                >
                  <option value="all">Toutes les matières ({activeModeSubjects.length})</option>
                  {activeModeSubjects
                    .filter((s) => !isFrancoArabic || sectionFilter === 'all' || (s.language === 'ar' ? 'ar' : 'fr') === sectionFilter)
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {isFrancoArabic ? `[${s.language === 'ar' ? 'AR' : 'FR'}] ` : ''}{s.subject_name}
                      </option>
                    ))}
                </select>

                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition shadow-xs shrink-0"
                  title={isExpanded ? "Réduire l'affichage" : "Agrandir en plein écran"}
                >
                  {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  <span className="hidden sm:inline">{isExpanded ? 'Réduire' : 'Agrandir'}</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-16 shadow-xs flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="animate-spin text-blue-600" size={32} />
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Chargement des notes...
                  </p>
                  <p className="text-[11px] font-medium text-slate-400 mt-1">
                    Récupération des évaluations pour « {period} »
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* VUE TABLETTE & PC : MATRICE SPREADSHEET PRO AVEC NAVIGATION FLÈCHES/ENTRÉE */}
                <div
                  key={`matrix-${selectedClassId}-${period}-${year}-${gradesRevision}`}
                  className={`hidden md:block bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs ${isExpanded ? 'border-2 border-blue-600/40' : ''}`}
                >
                  {filteredStudentsSaisie.length === 0 ? (
                    <div className="p-12 text-center text-xs font-bold text-slate-400">
                      Aucun élève trouvé dans cette classe.
                    </div>
                  ) : (
                    <div className={`overflow-x-auto relative ${isExpanded ? 'max-h-[calc(100vh-160px)]' : 'max-h-[600px]'}`}>
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 z-20 bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4 sticky left-0 bg-slate-50 z-30 min-w-[200px] border-r border-slate-200">
                              Élève
                            </th>
                            {displayedSubjects.map(sub => {
                              const coeff = Number(sub.coefficient) || 1;
                              const maxSubjectGrade = baseScale * coeff;
                              const isArabicSub = sub.language === 'ar';
                              return (
                                <th key={sub.id} className="py-2.5 px-3 text-center border-r border-slate-200 min-w-[130px]" colSpan={isSecondCycle ? 2 : 1}>
                                  <div className="flex items-center justify-center gap-1.5">
                                    {isFrancoArabic && (
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${isArabicSub ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {isArabicSub ? 'AR' : 'FR'}
                                      </span>
                                    )}
                                    <div className="font-extrabold text-slate-900 truncate">{sub.subject_name}</div>
                                  </div>
                                  <span className={`text-[9px] font-semibold ${isFrancoArabic && isArabicSub ? 'text-emerald-600' : 'text-blue-600'}`}>
                                    Coeff. {coeff} • /{maxSubjectGrade}
                                  </span>
                                </th>
                              );
                            })}
                          </tr>
                          {isSecondCycle && (
                            <tr className="bg-slate-100/60 text-[9px] text-slate-500 border-b border-slate-200">
                              <th className="py-1 px-4 sticky left-0 bg-slate-100 z-30 border-r border-slate-200"></th>
                              {displayedSubjects.map(sub => (
                                <Fragment key={`sub-cols-${sub.id}`}>
                                  <th className="py-1 text-center font-bold">Classe</th>
                                  <th className="py-1 text-center font-bold border-r border-slate-200 text-blue-700">Compo</th>
                                </Fragment>
                              ))}
                            </tr>
                          )}
                        </thead>

                        <tbody className="divide-y divide-slate-100 font-medium">
                          {filteredStudentsSaisie.map((student, studentIdx) => {
                            const hasAnyDisplayedGrade = displayedSubjects.some((sub) =>
                              rawGrades.some((g) => g.student_id === student.id && g.subject_name === sub.subject_name)
                            );
                            return (
                              <tr key={student.id} className="hover:bg-slate-50/70 transition-colors group">

                                <td className="py-2.5 px-4 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="capitalize block truncate">{student.last_name} {student.first_name}</span>
                                    {!isReadOnly && hasAnyDisplayedGrade && (
                                      <button
                                        type="button"
                                        onClick={() => clearStudentGrades(student.id, `${student.last_name} ${student.first_name}`)}
                                        title="Effacer les notes de cet élève"
                                        className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md opacity-70 group-hover:opacity-100 transition shrink-0 cursor-pointer"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                </td>

                                {displayedSubjects.map((sub, subIdx) => {
                                  const grade = rawGrades.find(g => g.student_id === student.id && g.subject_name === sub.subject_name);
                                  const keyClasse = `${student.id}-${sub.subject_name}-grade_value`;
                                  const keyCompo = `${student.id}-${sub.subject_name}-compo_value`;
                                  const isExempt = isGradeRecordExempt(grade);

                                  return (
                                    <Fragment key={`${student.id}-${sub.id}-${period}`}>
                                      {isSecondCycle && (
                                        <td className="p-1.5 text-center">
                                          <input
                                            ref={(el) => {
                                              if (el) inputRefs.current[`${student.id}-${sub.subject_name}-grade`] = el;
                                            }}
                                            type="text"
                                            inputMode="decimal"
                                            disabled={isReadOnly}
                                            defaultValue={formatInputDisplayValue(grade, 'grade_value')}
                                            onFocus={(e) => {
                                              e.target.select();
                                            }}
                                            onBlur={(e) => saveGrade(student.id, sub.subject_name, 'grade_value', e.target.value, e.target)}
                                            onKeyDown={(e) => handleMatrixKeyDown(e, studentIdx, subIdx, 'grade')}
                                            className={`w-14 h-8 text-center font-bold text-xs rounded-lg border outline-none transition disabled:opacity-50 ${savedGrades.has(keyClasse)
                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                                                : deletedGrades.has(keyClasse)
                                                  ? 'border-rose-400 bg-rose-50 text-rose-700'
                                                  : isExempt
                                                    ? 'border-amber-300 bg-amber-50/70 text-amber-800'
                                                    : 'border-slate-200 bg-slate-50/60 focus:bg-white focus:border-blue-600'
                                              }`}
                                            placeholder="—"
                                          />
                                        </td>
                                      )}

                                      <td className="p-1.5 text-center border-r border-slate-200">
                                        <input
                                          ref={(el) => {
                                            if (el) inputRefs.current[`${student.id}-${sub.subject_name}-compo`] = el;
                                          }}
                                          type="text"
                                          inputMode="decimal"
                                          disabled={isReadOnly}
                                          defaultValue={formatInputDisplayValue(grade, 'compo_value')}
                                          onFocus={(e) => {
                                            e.target.select();
                                          }}
                                          onBlur={(e) => saveGrade(student.id, sub.subject_name, 'compo_value', e.target.value, e.target)}
                                          onKeyDown={(e) => handleMatrixKeyDown(e, studentIdx, subIdx, 'compo')}
                                          className={`w-14 h-8 text-center font-bold text-xs rounded-lg border outline-none transition disabled:opacity-50 ${savedGrades.has(keyCompo)
                                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                                              : deletedGrades.has(keyCompo)
                                                ? 'border-rose-400 bg-rose-50 text-rose-700'
                                                : isExempt
                                                  ? 'border-amber-300 bg-amber-50/70 text-amber-800'
                                                  : 'border-slate-200 bg-blue-50/40 text-blue-900 focus:bg-white focus:border-blue-600'
                                            }`}
                                          placeholder="—"
                                        />
                                      </td>
                                    </Fragment>
                                  );
                                })}

                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* VUE MOBILE : FICHE FLUIDE ET CLAVIER OPTIMISÉ */}
                <div
                  key={`mobile-${selectedClassId}-${period}-${year}-${activeMobileStudent?.id || 'none'}-${gradesRevision}`}
                  className="md:hidden space-y-4"
                >
                  {filteredStudentsSaisie.length === 0 ? (
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs font-bold text-slate-400">
                      Aucun élève trouvé
                    </div>
                  ) : activeMobileStudent && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">

                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                            {activeMobileStudent.first_name?.[0]}{activeMobileStudent.last_name?.[0]}
                          </div>
                          <div>
                            <h3 className="text-sm font-extrabold text-slate-900 capitalize leading-tight">
                              {activeMobileStudent.first_name} {activeMobileStudent.last_name}
                            </h3>
                            <span className="text-[10px] text-slate-400 font-bold block">
                              Élève {currentStudentIndex + 1} sur {filteredStudentsSaisie.length}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setCurrentStudentIndex(Math.max(0, currentStudentIndex - 1))}
                            disabled={currentStudentIndex === 0}
                            className="p-2 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-30"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            onClick={() => setCurrentStudentIndex(Math.min(filteredStudentsSaisie.length - 1, currentStudentIndex + 1))}
                            disabled={currentStudentIndex === filteredStudentsSaisie.length - 1}
                            className="p-2 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-30"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>

                      <p className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-lg text-center">
                        Videz un champ ou appuyez sur la corbeille pour supprimer • <strong className="text-slate-800">000</strong> = dispensé
                      </p>

                      <div className="space-y-3">
                        {displayedSubjects.map(sub => {
                          const grade = rawGrades.find(g => g.student_id === activeMobileStudent.id && g.subject_name === sub.subject_name);
                          const coeff = Number(sub.coefficient) || 1;
                          const maxSubjectGrade = baseScale * coeff;
                          const isExempt = isGradeRecordExempt(grade);

                          return (
                            <div key={`${sub.id}-${period}`} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                              <div className="flex justify-between items-center gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {isFrancoArabic && (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${sub.language === 'ar' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                      }`}>
                                      {sub.language === 'ar' ? 'AR' : 'FR'}
                                    </span>
                                  )}
                                  <span className="text-xs font-bold text-slate-800 truncate">{sub.subject_name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isFrancoArabic && sub.language === 'ar'
                                      ? 'text-emerald-700 bg-emerald-50'
                                      : 'text-blue-600 bg-blue-50'
                                    }`}>
                                    Coeff. {coeff} • /{maxSubjectGrade}
                                  </span>
                                  {!isReadOnly && grade && (
                                    <button
                                      type="button"
                                      onClick={() => clearSubjectGrade(activeMobileStudent.id, sub.subject_name)}
                                      title="Supprimer cette note"
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="flex gap-2.5">
                                {isSecondCycle && (
                                  <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                      Classe /{maxSubjectGrade}
                                    </label>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      disabled={isReadOnly}
                                      defaultValue={formatInputDisplayValue(grade, 'grade_value')}
                                      onFocus={(e) => {
                                        e.target.select();
                                      }}
                                      onBlur={(e) => saveGrade(activeMobileStudent.id, sub.subject_name, 'grade_value', e.target.value, e.target)}
                                      className={`w-full h-11 border text-center font-bold text-base rounded-lg outline-none focus:border-blue-600 disabled:opacity-50 ${isExempt
                                          ? 'bg-amber-50/70 border-amber-300 text-amber-800'
                                          : 'bg-white border-slate-300 text-slate-900'
                                        }`}
                                      placeholder="—"
                                    />
                                  </div>
                                )}

                                <div className="flex-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                    {isSecondCycle ? `Composition /${maxSubjectGrade}` : `Note d'examen /${maxSubjectGrade}`}
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    disabled={isReadOnly}
                                    defaultValue={formatInputDisplayValue(grade, 'compo_value')}
                                    onFocus={(e) => {
                                      e.target.select();
                                    }}
                                    onBlur={(e) => saveGrade(activeMobileStudent.id, sub.subject_name, 'compo_value', e.target.value, e.target)}
                                    className={`w-full h-11 border text-center font-bold text-base rounded-lg outline-none focus:border-blue-600 disabled:opacity-50 ${isExempt
                                        ? 'bg-amber-50/70 border-amber-300 text-amber-800'
                                        : 'bg-white border-slate-300 text-blue-600'
                                      }`}
                                    placeholder="—"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => setCurrentStudentIndex(Math.min(filteredStudentsSaisie.length - 1, currentStudentIndex + 1))}
                        disabled={currentStudentIndex === filteredStudentsSaisie.length - 1}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-40"
                      >
                        <span>Passer à l'élève suivant</span>
                        <ArrowRight size={15} />
                      </button>

                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        )}

        {/* ======================================================== */}
        {/* ONGLET 2 : RESULTATS & BULLETINS                         */}
        {/* ======================================================== */}
        {tab === 'resultats' && selectedClassId && (
          <div className="space-y-6">
            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-16 shadow-xs flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="animate-spin text-blue-600" size={32} />
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Calcul des bulletins...
                  </p>
                  <p className="text-[11px] font-medium text-slate-400 mt-1">
                    Délibération en cours pour « {period} »
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {bulletinData.length} bulletin{bulletinData.length > 1 ? 's' : ''} délibéré{bulletinData.length > 1 ? 's' : ''}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${isFrancoArabic
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                      {isFrancoArabic
                        ? `Franco-Arabe • Paysage (${francoArabicCombined ? 'Combiné' : 'Séparé'})`
                        : 'Classique • Portrait'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="text"
                        value={searchBulletins}
                        onChange={(e) => setSearchBulletins(e.target.value)}
                        placeholder="Rechercher un élève..."
                        className="w-full sm:w-52 pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 transition"
                      />
                    </div>
                    <button
                      onClick={downloadAllInOnePDF}
                      disabled={isExportingPdf || bulletinData.length === 0}
                      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-white rounded-xl text-xs font-bold transition disabled:opacity-40 shadow-xs cursor-pointer ${isFrancoArabic
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                      <Download size={14} />
                      <span>
                        {isExportingPdf
                          ? 'Génération du PDF...'
                          : isFrancoArabic
                            ? 'Télécharger tous (Paysage)'
                            : 'Télécharger tous les bulletins'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bulletinData.map((s) => (
                    <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                      <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-3">
                        <div className="min-w-0">
                          <h3 className="text-base font-extrabold text-slate-900 capitalize truncate">
                            {s.first_name} {s.last_name}
                          </h3>
                        </div>
                        {!isFrancoArabic ? (
                          <span className="text-xs font-black px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                            Rang : {s.rang} / {students.length}
                          </span>
                        ) : francoArabicCombined ? (
                          <span className="text-xs font-black px-2.5 py-1 rounded-md bg-slate-900 text-white shrink-0">
                            Rang Global : {s.rang} / {students.length}
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            2 Bulletins • Paysage
                          </span>
                        )}
                      </div>

                      {!isFrancoArabic ? (
                        <>
                          <div className="grid grid-cols-2 gap-3 text-center">
                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Moyenne Générale</span>
                              <span className="text-2xl font-black text-blue-600 mt-0.5 block">
                                {s.moyenne} <span className="text-xs font-normal text-slate-400">/{baseScale}</span>
                              </span>
                            </div>

                            <div className={`p-3 rounded-xl border flex flex-col justify-center ${s.moyenne >= (isSecondCycle ? 10 : 5)
                                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
                                : 'bg-rose-50/50 border-rose-200 text-rose-800'
                              }`}>
                              <span className="text-[10px] font-bold uppercase block opacity-70">Mention</span>
                              <span className="text-sm font-black mt-0.5 block">{getMention(s.moyenne)}</span>
                            </div>
                          </div>

                          <div className="max-h-[140px] overflow-y-auto space-y-1.5 divide-y divide-slate-100">
                            {s.notes.map((n: any) => (
                              <div key={n.name} className="flex justify-between items-center pt-1.5 text-xs">
                                <span className="font-semibold text-slate-700 truncate pr-2">{n.name}</span>
                                <span className={`font-bold ${n.isExempt ? 'text-slate-400' : 'text-slate-900'}`}>
                                  {n.isExempt ? '—' : n.moyenneMatiere}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          {/* DEUX VOLETS FR / AR CÔTE À CÔTE DANS LA CARTE APERÇU */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Volet Français */}
                            <div className="p-3.5 rounded-xl bg-blue-50/40 border border-blue-100 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                                  Section Français
                                </span>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-white text-blue-700 border border-blue-100">
                                  Rang {s.totalCoeffsFr > 0 ? s.rangFr : '—'}/{students.length}
                                </span>
                              </div>
                              <div className="flex items-baseline justify-between">
                                <span className="text-xl font-black text-blue-600">
                                  {s.totalCoeffsFr > 0 ? s.moyenneFr : '—'}
                                  <span className="text-[11px] font-normal text-slate-400">/{baseScale}</span>
                                </span>
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${s.totalCoeffsFr === 0
                                    ? 'bg-slate-100 text-slate-500'
                                    : s.moyenneFr >= (isSecondCycle ? 10 : 5)
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-rose-100 text-rose-700'
                                  }`}>
                                  {s.totalCoeffsFr > 0 ? getMention(s.moyenneFr) : 'Non évalué'}
                                </span>
                              </div>
                              <div className="max-h-[96px] overflow-y-auto space-y-1 border-t border-blue-100/80 pt-2">
                                {s.notesFr.length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic">Aucune matière FR</p>
                                ) : (
                                  s.notesFr.map((n) => (
                                    <div key={n.name} className="flex justify-between items-center text-[11px]">
                                      <span className="font-semibold text-slate-700 truncate pr-2">{n.name}</span>
                                      <span className={`font-bold ${n.isExempt ? 'text-slate-400' : 'text-slate-900'}`}>
                                        {n.isExempt ? '—' : n.moyenneMatiere}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* Volet Arabe */}
                            <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-100 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                                  Section Arabe
                                </span>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-white text-emerald-700 border border-emerald-100">
                                  Rang {s.totalCoeffsAr > 0 ? s.rangAr : '—'}/{students.length}
                                </span>
                              </div>
                              <div className="flex items-baseline justify-between">
                                <span className="text-xl font-black text-emerald-600">
                                  {s.totalCoeffsAr > 0 ? s.moyenneAr : '—'}
                                  <span className="text-[11px] font-normal text-slate-400">/{baseScale}</span>
                                </span>
                                <span dir="rtl" className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${s.totalCoeffsAr === 0
                                    ? 'bg-slate-100 text-slate-500'
                                    : s.moyenneAr >= (isSecondCycle ? 10 : 5)
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-rose-100 text-rose-700'
                                  }`}>
                                  {s.totalCoeffsAr > 0 ? getArabicMention(s.moyenneAr, baseScale) : 'غير مقيم'}
                                </span>
                              </div>
                              <div className="max-h-[96px] overflow-y-auto space-y-1 border-t border-emerald-100/80 pt-2">
                                {s.notesAr.length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic">Aucune matière AR</p>
                                ) : (
                                  s.notesAr.map((n) => (
                                    <div key={n.name} className="flex justify-between items-center text-[11px]">
                                      <span className="font-semibold text-slate-700 truncate pr-2">{n.name}</span>
                                      <span className={`font-bold ${n.isExempt ? 'text-slate-400' : 'text-slate-900'}`}>
                                        {n.isExempt ? '—' : n.moyenneMatiere}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Bandeau Combiné si l'option "Calculs rassemblés" est activée */}
                          {francoArabicCombined && (
                            <div className="p-3 rounded-xl bg-slate-900 text-white flex items-center justify-between gap-3">
                              <div>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                                  Moyenne Générale Combinée (FR + AR)
                                </span>
                                <span className="text-xs font-extrabold text-emerald-300">
                                  {getMention(s.moyenne)} • Rang {s.rang}/{students.length}
                                </span>
                              </div>
                              <span className="text-xl font-black text-white shrink-0">
                                {s.moyenne}
                                <span className="text-xs font-normal text-slate-400">/{baseScale}</span>
                              </span>
                            </div>
                          )}
                        </>
                      )}

                      <button
                        onClick={() => downloadPDF(s)}
                        className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <FileText size={14} className={isFrancoArabic ? 'text-emerald-600' : 'text-blue-600'} />
                        <span>
                          {isFrancoArabic
                            ? 'Télécharger le bulletin Franco-Arabe (Paysage)'
                            : 'Télécharger le bulletin'}
                        </span>
                      </button>

                      {/* Template PDF Masqué : Classique (Portrait) OU Franco-Arabe (Paysage 2 volets) */}
                      <div style={{ position: 'absolute', top: '-10000px', left: 0 }}>
                        {isFrancoArabic ? (
                          <FrancoArabicBulletinPdf
                            student={s}
                            school={school}
                            classNameLabel={classes.find(c => c.id === selectedClassId)?.name || ''}
                            period={period}
                            year={year}
                            isSecondCycle={isSecondCycle}
                            baseScale={baseScale}
                            totalStudents={students.length}
                            isCombined={francoArabicCombined}
                            getMention={getMention}
                            getAppreciation={getAppreciation}
                          />
                        ) : (
                          <div
                            id={`bulletin-pdf-${s.id}`}
                            style={{
                              padding: '40px',
                              background: 'white',
                              color: '#0f172a',
                              fontFamily: '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif',
                              width: '210mm',
                              minHeight: '297mm',
                              boxSizing: 'border-box',
                              pageBreakAfter: 'always',
                              breakAfter: 'page',
                              pageBreakInside: 'avoid'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '35px' }}>
                              <div>
                                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '900', color: '#4f46e5', letterSpacing: '-0.5px' }}>
                                  {school?.name || 'Ecole'}
                                </h1>
                                <h2 style={{ margin: '8px 0 0 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', fontWeight: 'bold' }}>
                                  {school?.academie ? `${school.academie}` : ''} {school?.rive ? `• ${school.rive}` : ''}
                                </h2>
                                <h3 style={{ margin: '4px 0 0 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8' }}>
                                  {school?.cap ? ` ${school.cap}` : ''}
                                </h3>
                                <h3 style={{ margin: '6px 0 0 0', fontSize: '10px', color: '#94a3b8' }}>
                                  {school?.address || ''}{school?.city ? `, ${school.city}` : ''}{school?.phone ? ` • ${school.phone}` : ''}
                                </h3>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-block', background: '#4f46e5', color: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                                  Bulletin de Notes
                                </div>
                                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                                  Période : <span style={{ color: '#4f46e5' }}>{period}</span>
                                </p>
                                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                                  Année Scolaire : {year}
                                </p>
                              </div>
                            </div>

                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '35px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <p style={{ margin: '0 0 4px 0', fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '1px' }}>
                                  Identité de l'élève
                                </p>
                                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase' }}>
                                  {s.first_name} {s.last_name}
                                </h2>
                                <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                                  <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                                    <strong style={{ color: '#0f172a' }}>Classe :</strong> {classes.find(c => c.id === selectedClassId)?.name}
                                  </p>
                                  <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                                    <strong style={{ color: '#0f172a' }}>Régime :</strong> {isSecondCycle ? "Second Cycle" : "Premier Cycle"}
                                  </p>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', background: 'white', padding: '12px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <p style={{ margin: '0 0 4px 0', fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700' }}>
                                  Rang de l'élève
                                </p>
                                <p style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: '#4f46e5' }}>
                                  {s.rang} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: '600' }}>/ {students.length}</span>
                                </p>
                              </div>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                              <thead>
                                <tr>
                                  <th style={{ background: '#f1f5f9', color: '#334155', padding: '12px 15px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0', borderTopLeftRadius: '8px' }}>
                                    Matière
                                  </th>
                                  <th style={{ background: '#f1f5f9', color: '#334155', padding: '12px 15px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0' }}>
                                    Coeff
                                  </th>
                                  {isSecondCycle && (
                                    <th style={{ background: '#f1f5f9', color: '#334155', padding: '12px 15px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0' }}>
                                      Classe
                                    </th>
                                  )}
                                  {isSecondCycle && (
                                    <th style={{ background: '#f1f5f9', color: '#334155', padding: '12px 15px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0' }}>
                                      Compo
                                    </th>
                                  )}
                                  <th style={{ background: '#f1f5f9', color: '#334155', padding: '12px 15px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0' }}>
                                    Moy/{baseScale}
                                  </th>
                                  <th style={{ background: '#f1f5f9', color: '#334155', padding: '12px 15px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0' }}>
                                    Pondéré
                                  </th>
                                  <th style={{ background: '#f1f5f9', color: '#334155', padding: '12px 15px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #e2e8f0', borderTopRightRadius: '8px' }}>
                                    Appréciation
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.notes.map((n: any, idx: number) => (
                                  <tr key={n.name} style={{ background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                                    <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                                      {n.name}
                                    </td>
                                    <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                      {n.isExempt ? '—' : n.coeff}
                                    </td>
                                    {isSecondCycle && (
                                      <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                        {n.isExempt ? '—' : n.noteClasse}
                                      </td>
                                    )}
                                    {isSecondCycle && (
                                      <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                        {n.isExempt ? '—' : n.noteCompo}
                                      </td>
                                    )}
                                    <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: n.isExempt ? '#94a3b8' : '#0f172a' }}>
                                      {n.isExempt ? '—' : n.moyenneMatiere}
                                    </td>
                                    <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                                      {n.isExempt ? '—' : n.points.toFixed(2)}
                                    </td>
                                    <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '12px', fontStyle: 'italic', color: '#475569' }}>
                                      {getAppreciation(n.moyenneMatiere, n.isExempt)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '50px' }}>
                              <div style={{ width: '380px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                                    Total Pondéré
                                  </span>
                                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                                    {s.totalPoints.toFixed(2)}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                  <span style={{ fontSize: '15px', color: '#0f172a', fontWeight: '800', textTransform: 'uppercase' }}>
                                    Moyenne Générale
                                  </span>
                                  <span style={{ fontSize: '26px', fontWeight: '900', color: '#4f46e5' }}>
                                    {s.moyenne}
                                    <span style={{ fontSize: '14px', color: '#94a3b8' }}>/{baseScale}</span>
                                  </span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      background: s.moyenne >= (isSecondCycle ? 10 : 5) ? '#dcfce7' : '#fee2e2',
                                      color: s.moyenne >= (isSecondCycle ? 10 : 5) ? '#166534' : '#991b1b',
                                      padding: '8px 16px',
                                      borderRadius: '8px',
                                      fontSize: '12px',
                                      fontWeight: '800',
                                      textTransform: 'uppercase',
                                      letterSpacing: '1px'
                                    }}
                                  >
                                    Mention : {getMention(s.moyenne)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <div style={{ width: '35%' }}>
                                <p style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                  Signature des parents
                                </p>
                              </div>
                              <div style={{ width: '35%', textAlign: 'right' }}>
                                <p style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                  Le Directeur des Études
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* ONGLET 3 : CONFIGURATION DES MATIÈRES                    */}
        {/* ======================================================== */}
        {tab === 'config' && selectedClassId && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase">
                  {isFrancoArabic ? 'Matières de la classe (Sections Français & Arabe)' : 'Matières de la classe'}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {isFrancoArabic
                    ? 'Classez chaque matière dans la section Français (FR) ou Arabe (AR) pour les bulletins côte à côte'
                    : 'Définissez, modifiez ou réorganisez les disciplines et leurs coefficients'}
                </p>
              </div>

              {!isReadOnly && subjects.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsReorderMode(!isReorderMode)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition self-start sm:self-auto ${isReorderMode
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                >
                  <ArrowUpDown size={14} />
                  <span>{isReorderMode ? 'Terminer le tri' : 'Changer la place'}</span>
                </button>
              )}
            </div>

            {isFrancoArabic && dbMissingLanguageCol && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-2.5 text-amber-900">
                <Database size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-extrabold">Classification FR/AR enregistrée localement sur cet appareil</p>
                  <p className="font-medium text-amber-800 mt-0.5">
                    Pour synchroniser la langue des matières entre tous les appareils dans Supabase, exécutez le script SQL <code className="bg-amber-100 px-1.5 py-0.5 rounded font-bold">migrations/add_franco_arabic_bulletins.sql</code> dans l'éditeur SQL de Supabase.
                  </p>
                </div>
              </div>
            )}

            {!isReadOnly && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pb-5 border-b border-slate-100 items-end">
                <div className={isFrancoArabic ? 'sm:col-span-5 space-y-1' : 'sm:col-span-6 space-y-1'}>
                  <label className="text-xs font-bold text-slate-700">Intitulé de la matière</label>
                  <input
                    value={newSubName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewSubName(val);
                      if (isFrancoArabic && val.trim().length >= 2) {
                        if (ARABIC_CHAR_REGEX.test(val) || ARABIC_KEYWORD_REGEX.test(val)) {
                          setNewSubLang('ar');
                        }
                      }
                    }}
                    type="text"
                    placeholder={isFrancoArabic ? 'Ex: Mathématiques, القرآن, الفقه, Arabe...' : 'Ex: Mathématiques, Histoire, Anglais...'}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>

                {isFrancoArabic && (
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">Section</label>
                    <select
                      value={newSubLang}
                      onChange={(e) => setNewSubLang(e.target.value as SubjectLanguage)}
                      className={`w-full px-3 py-2.5 border rounded-xl font-bold text-xs outline-none transition cursor-pointer ${newSubLang === 'ar'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 focus:border-emerald-600'
                          : 'bg-blue-50 border-blue-200 text-blue-800 focus:border-blue-600'
                        }`}
                    >
                      <option value="fr">Français (FR)</option>
                      <option value="ar">Arabe (AR)</option>
                    </select>
                  </div>
                )}

                <div className={isFrancoArabic ? 'sm:col-span-2 space-y-1' : 'sm:col-span-3 space-y-1'}>
                  <label className="text-xs font-bold text-slate-700">Coefficient</label>
                  <input
                    value={newSubCoeff}
                    onChange={(e) => setNewSubCoeff(e.target.value)}
                    type="number"
                    step="1"
                    placeholder="1"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>
                <div className="sm:col-span-3">
                  <button
                    onClick={addSubject}
                    className={`w-full text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${isFrancoArabic && newSubLang === 'ar'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                  >
                    <Plus size={15} />
                    <span>Ajouter la matière</span>
                  </button>
                </div>
              </div>
            )}

            {activeModeSubjects.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-xs font-medium text-slate-400">Aucune matière configurée pour le moment.</p>
                {!isFrancoArabic && arabicSubjects.length > 0 && (
                  <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl">
                    <span>
                      {arabicSubjects.length} matière{arabicSubjects.length > 1 ? 's' : ''} arabe{arabicSubjects.length > 1 ? 's' : ''} masquée{arabicSubjects.length > 1 ? 's' : ''} en mode Classique.
                    </span>
                    <button
                      type="button"
                      onClick={() => persistBulletinOptions('franco_arabic', francoArabicCombined)}
                      className="underline font-black cursor-pointer"
                    >
                      Voir en Franco-Arabe
                    </button>
                  </p>
                )}
              </div>
            ) : !isFrancoArabic ? (
              <div className="space-y-2">
                {arabicSubjects.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-600">
                      <strong className="text-emerald-700">{arabicSubjects.length} matière{arabicSubjects.length > 1 ? 's' : ''} arabe{arabicSubjects.length > 1 ? 's' : ''}</strong> enregistrée{arabicSubjects.length > 1 ? 's' : ''} {arabicSubjects.length > 1 ? 'sont' : 'est'} exclue{arabicSubjects.length > 1 ? 's' : ''} du bulletin Classique.
                    </span>
                    <button
                      type="button"
                      onClick={() => persistBulletinOptions('franco_arabic', francoArabicCombined)}
                      className="text-emerald-700 hover:text-emerald-800 font-black uppercase text-[10px] tracking-wider self-start sm:self-auto cursor-pointer"
                    >
                      Passer en Franco-Arabe →
                    </button>
                  </div>
                )}

                {frenchSubjects.map((s, idx) => {
                  const globalIdx = subjects.findIndex((item) => String(item.id) === String(s.id));
                  const isEditing = editingSubjectId === String(s.id);
                  const coeff = Number(s.coefficient) || 1;

                  return (
                    <div
                      key={s.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition ${isEditing
                          ? 'bg-blue-50/40 border-blue-300'
                          : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-50'
                        }`}
                    >
                      {isEditing ? (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
                          <input
                            type="text"
                            value={editSubName}
                            onChange={(e) => setEditSubName(e.target.value)}
                            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-900 outline-none focus:border-blue-600"
                            placeholder="Nom de la matière"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600 shrink-0">Coeff :</span>
                            <input
                              type="number"
                              step="1"
                              min="1"
                              value={editSubCoeff}
                              onChange={(e) => setEditSubCoeff(e.target.value)}
                              className="w-20 px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-900 outline-none focus:border-blue-600 text-center"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => saveEditSubject(s)}
                              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition"
                              title="Enregistrer"
                            >
                              <Check size={14} />
                              <span>Valider</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSubjectId(null)}
                              className="p-2 border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 rounded-lg transition"
                              title="Annuler"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            {isReorderMode && !isReadOnly && (
                              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => moveSubject(globalIdx, 'up', 'fr')}
                                  disabled={idx === 0}
                                  className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 transition"
                                  title="Monter"
                                >
                                  <ArrowUp size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveSubject(globalIdx, 'down', 'fr')}
                                  disabled={idx === frenchSubjects.length - 1}
                                  className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 transition"
                                  title="Descendre"
                                >
                                  <ArrowDown size={14} />
                                </button>
                              </div>
                            )}

                            <div>
                              <p className="font-bold text-slate-900 text-sm">{s.subject_name}</p>
                              <span className="text-xs font-bold text-blue-600">
                                Coefficient : {coeff} • Barème : /{baseScale * coeff}
                              </span>
                            </div>
                          </div>

                          {!isReadOnly && (
                            <div className="flex items-center gap-1.5 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() => startEditSubject(s)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Modifier la matière ou le coefficient"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSubject(s.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Supprimer la matière"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* MODE FRANCO-ARABE : DEUX SECTIONS SÉPARÉES (FRANÇAIS À GAUCHE, ARABE À DROITE) */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {[
                  {
                    lang: 'fr' as SubjectLanguage,
                    title: 'Section Française (FR)',
                    subtitle: 'Affichée sur le bulletin de gauche',
                    items: frenchSubjects,
                    accentBorder: 'border-blue-200/80',
                    accentHeader: 'bg-blue-50/70 text-blue-800 border-blue-100',
                    badgeClass: 'text-blue-600',
                    switchLabel: 'Passer en AR',
                    switchTarget: 'ar' as SubjectLanguage,
                  },
                  {
                    lang: 'ar' as SubjectLanguage,
                    title: 'Section Arabe (AR)',
                    subtitle: 'Affichée sur le bulletin de droite (كشف النقاط العربي)',
                    items: arabicSubjects,
                    accentBorder: 'border-emerald-200/80',
                    accentHeader: 'bg-emerald-50/70 text-emerald-800 border-emerald-100',
                    badgeClass: 'text-emerald-600',
                    switchLabel: 'Passer en FR',
                    switchTarget: 'fr' as SubjectLanguage,
                  },
                ].map((section) => (
                  <div key={section.lang} className={`rounded-2xl border ${section.accentBorder} overflow-hidden flex flex-col`}>
                    <div className={`px-4 py-3 border-b ${section.accentHeader} flex items-center justify-between`}>
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider">{section.title}</h3>
                        <p className="text-[11px] font-medium opacity-80">{section.subtitle}</p>
                      </div>
                      <span className="text-xs font-black bg-white/90 px-2.5 py-1 rounded-lg">
                        {section.items.length}
                      </span>
                    </div>

                    <div className="p-3 space-y-2 flex-1 bg-white">
                      {section.items.length === 0 ? (
                        <p className="text-xs font-medium text-slate-400 py-8 text-center">
                          Aucune matière dans cette section.
                        </p>
                      ) : (
                        section.items.map((s, sectionIdx) => {
                          const globalIdx = subjects.findIndex((item) => String(item.id) === String(s.id));
                          const isEditing = editingSubjectId === String(s.id);
                          const coeff = Number(s.coefficient) || 1;

                          return (
                            <div
                              key={s.id}
                              className={`flex flex-col gap-2.5 p-3 rounded-xl border transition ${isEditing
                                  ? 'bg-blue-50/40 border-blue-300'
                                  : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-50'
                                }`}
                            >
                              {isEditing ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={editSubName}
                                    onChange={(e) => setEditSubName(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-900 outline-none focus:border-blue-600"
                                    placeholder="Nom de la matière"
                                    autoFocus
                                  />
                                  <div className="flex flex-wrap items-center gap-2">
                                    <select
                                      value={editSubLang}
                                      onChange={(e) => setEditSubLang(e.target.value as SubjectLanguage)}
                                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-900 outline-none focus:border-blue-600"
                                    >
                                      <option value="fr">Français (FR)</option>
                                      <option value="ar">Arabe (AR)</option>
                                    </select>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-slate-600">Coeff :</span>
                                      <input
                                        type="number"
                                        step="1"
                                        min="1"
                                        value={editSubCoeff}
                                        onChange={(e) => setEditSubCoeff(e.target.value)}
                                        className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-900 outline-none focus:border-blue-600 text-center"
                                      />
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-auto">
                                      <button
                                        type="button"
                                        onClick={() => saveEditSubject(s)}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition"
                                      >
                                        <Check size={14} />
                                        <span>Valider</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingSubjectId(null)}
                                        className="p-1.5 border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 rounded-lg transition"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {isReorderMode && !isReadOnly && (
                                      <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => moveSubject(globalIdx, 'up', section.lang)}
                                          disabled={sectionIdx === 0}
                                          className="p-1 text-slate-600 hover:text-blue-600 rounded disabled:opacity-30 transition"
                                          title="Monter"
                                        >
                                          <ArrowUp size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => moveSubject(globalIdx, 'down', section.lang)}
                                          disabled={sectionIdx === section.items.length - 1}
                                          className="p-1 text-slate-600 hover:text-blue-600 rounded disabled:opacity-30 transition"
                                          title="Descendre"
                                        >
                                          <ArrowDown size={13} />
                                        </button>
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-900 text-sm truncate">{s.subject_name}</p>
                                      <span className={`text-[11px] font-bold ${section.badgeClass}`}>
                                        Coeff. {coeff} • Barème /{baseScale * coeff}
                                      </span>
                                    </div>
                                  </div>

                                  {!isReadOnly && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => toggleSubjectLanguage(s, section.switchTarget)}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border transition cursor-pointer ${section.lang === 'fr'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                            : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                          }`}
                                        title={`Déplacer vers la section ${section.switchTarget.toUpperCase()}`}
                                      >
                                        {section.switchLabel}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => startEditSubject(s)}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                        title="Modifier"
                                      >
                                        <Edit3 size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteSubject(s.id)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                        title="Supprimer"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}