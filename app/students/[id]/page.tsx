"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { offlineFetch, offlineWrite } from "@/utils/offlineApi";
import { useCacheRefresh } from '@/hooks/useCacheRefresh';
import { useYear } from "@/context/YearContext";
import {
  Wallet,
  ShieldAlert,
  ArrowLeft,
  Plus,
  Loader2,
  Phone,
  MapPin,
  Edit3,
  X,
  CheckCircle2,
  Settings2,
  Save,
  Download,
  MessageSquare,
  Bell,
  BookOpen,
  Clock,
  ChevronRight,
  Sparkles,
  ReceiptText,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";

const PROFILE_DAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

export default function StudentDetails() {
  const { id } = useParams();
  const { selectedYearId, selectedYear, isReadOnly } = useYear();

  const [student, setStudent] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [extraPayments, setExtraPayments] = useState<any[]>([]);
  const [extraFeeTypes, setExtraFeeTypes] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulletinSubjects, setBulletinSubjects] = useState<any[]>([]);
  const [bulletinGrades, setBulletinGrades] = useState<any[]>([]);
  const [bulletinPeriod, setBulletinPeriod] = useState("1er Trimestre");
  const [bulletinLoading, setBulletinLoading] = useState(false);
  const [studentTimetable, setStudentTimetable] = useState<any[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<any[]>([]);
  const [studentAnnouncements, setStudentAnnouncements] = useState<any[]>([]);

  // États de saisie
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState("");
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState("Bas");

  const [selectedExtraType, setSelectedExtraType] = useState("");
  const [extraAmount, setExtraAmount] = useState("");

  const [showAvgForm, setShowAvgForm] = useState(false);
  const [newAvg, setNewAvg] = useState("");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    parent_phone: "",
    address: "",
    annual_fee: 0,
    payment_plan_tranches: 1,
  });

  // Fetch initial : Ne met "loading" à true QUE si on n'a pas encore de données de l'élève
  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        // 1. Profil de l'élève
        const { data: st } = await offlineFetch<any>(
          `student:${id}`,
          async () => {
            return await supabase
              .from("students")
              .select("*, classes(name)")
              .eq("id", id)
              .single();
          },
        );

        // 2. Journal de scolarité
        const { data: pay } = await offlineFetch<any[]>(
          `payments:${id}`,
          async () => {
            return await supabase
              .from("payments")
              .select("*")
              .eq("student_id", id)
              .order("created_at", { ascending: false });
          },
        );

        // 3. Discipline
        const { data: inc } = await offlineFetch<any[]>(
          `discipline:${id}`,
          async () => {
            return await supabase
              .from("discipline")
              .select("*")
              .eq("student_id", id)
              .order("incident_date", { ascending: false });
          },
        );

        // 4. Paiements Annexes
        const { data: exPay } = await offlineFetch<any[]>(
          `extra_payments:${id}`,
          async () => {
            return await supabase
              .from("student_extra_payments")
              .select("*, extra_fee_types(name)")
              .eq("student_id", id)
              .order("payment_date", { ascending: false });
          },
        );

        // 5. Types de frais généraux
        const { data: exTypes } = await offlineFetch<any[]>(
          `extra_fee_types`,
          async () => {
            return await supabase.from("extra_fee_types").select("*");
          },
        );

        if (st) {
          setStudent(st);
          setEditForm({
            first_name: st.first_name || "",
            last_name: st.last_name || "",
            parent_phone: st.parent_phone || "",
            address: st.address || "",
            annual_fee: Number(st.scolarite_totale || st.annual_fee || 0),
            payment_plan_tranches: st.payment_plan_tranches || 1,
          });
          setNewAvg(
            st.last_exam_avg !== null && st.last_exam_avg !== undefined
              ? String(st.last_exam_avg)
              : "",
          );

          const timetableYearId = selectedYearId || st.academic_year_id;

          if (st.class_id && timetableYearId) {
            const [timetableResult, attendanceResult, announcementResult] =
              await Promise.all([
                offlineFetch<any[]>(
                  `student_timetable:${st.class_id}:${timetableYearId}`,
                  async () => {
                    return await supabase
                      .from("class_timetables")
                      .select("*")
                      .eq("class_id", st.class_id)
                      .eq("academic_year_id", timetableYearId)
                      .order("day_of_week")
                      .order("start_time");
                  },
                ),
                offlineFetch<any[]>(
                  `student_attendance:${id}:${timetableYearId}`,
                  async () => {
                    return await supabase
                      .from("student_attendance")
                      .select("*")
                      .eq("student_id", id)
                      .order("date_checked", { ascending: false })
                      .limit(8);
                  },
                ),
                offlineFetch<any[]>(
                  `student_announcements:${timetableYearId}:${st.class_id}`,
                  async () => {
                    return await supabase
                      .from("announcements")
                      .select("*, classes:target_class_id(name)")
                      .eq("academic_year_id", timetableYearId)
                      .or(`target_audience.eq.Tous,and(target_audience.eq.Classes,target_class_id.eq.${st.class_id})`)
                      .order("is_pinned", { ascending: false })
                      .order("created_at", { ascending: false });
                  },
                ),
              ]);

            setStudentTimetable(timetableResult.data || []);
            setStudentAttendance(attendanceResult.data || []);
            setStudentAnnouncements(
              (announcementResult.data || []).filter(
                (announce) =>
                  announce.target_audience === "Tous" ||
                  (announce.target_audience === "Classes" &&
                    String(announce.target_class_id) === String(st.class_id)),
              ),
            );
          }
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
    },
    [id, selectedYearId],
  );

  const studentCacheKeys = useMemo(() => {
    if (!id) return [];
    return [`student:${id}`, `payments:${id}`, `discipline:${id}`, `extra_payments:${id}`];
  }, [id]);

  useCacheRefresh({
    cacheKeys: studentCacheKeys,
    cachePattern: /^(student:|payments:|discipline:|extra_payments:)/,
    onInvalidate: () => fetchData(true),
    debounceMs: 150,
  });

  useEffect(() => {
    if (id) fetchData(false);
  }, [id, selectedYearId, fetchData]);

  useEffect(() => {
    const loadBulletinData = async () => {
      if (!student) return;
      const bulletinYear = selectedYear?.label || student.academic_year || "";
      const classId = student.class_id;
      if (!classId || !bulletinYear) return;
      setBulletinLoading(true);

      const { data: subjects, error: subjError } = await offlineFetch<any[]>(
        `bulletin_subjects:${classId}:${bulletinYear}`,
        async () => {
          return await supabase
            .from("class_subjects")
            .select("*")
            .eq("class_id", classId)
            .eq("academic_year_id", selectedYearId || student.academic_year_id);
        },
      );

      const { data: grades, error: gradesError } = await offlineFetch<any[]>(
        `bulletin_grades:${student.id}:${bulletinPeriod}:${bulletinYear}`,
        async () => {
          return await supabase
            .from("student_grades")
            .select("*")
            .eq("student_id", student.id)
            .eq("period", bulletinPeriod)
            .eq("academic_year", bulletinYear);
        },
      );

      if (subjError) console.error("Erreur bulletin sujets :", subjError);
      if (gradesError) console.error("Erreur bulletin notes :", gradesError);

      setBulletinSubjects(subjects || []);
      setBulletinGrades(grades || []);
      setBulletinLoading(false);
    };

    loadBulletinData();
  }, [student, selectedYearId, selectedYear?.label, bulletinPeriod]);

  const formatInputDisplay = (val: string) => {
    const clean = val.replace(/\s/g, "");
    if (!clean) return "";
    const num = parseInt(clean, 10);
    if (isNaN(num)) return val;
    return new Intl.NumberFormat("fr-FR").format(num).replace(/,/g, " ");
  };

  const sendReceiptWhatsApp = (
    pAmount: number,
    pMonth: string,
    type: "SCOLAIRE" | "EXTRA",
  ) => {
    if (!student?.parent_phone) return;
    const cleanNumber = student.parent_phone.replace(/\D/g, "");
    const dateStr = new Date().toLocaleDateString("fr-FR");

    const message = encodeURIComponent(
      `✅ *REÇU DE PAIEMENT - ÉCOLE*\n\n` +
        `*Élève :* ${student.first_name} ${student.last_name}\n` +
        `*Type :* ${type}\n` +
        `*Montant :* ${new Intl.NumberFormat("fr-FR").format(pAmount)} FCFA\n` +
        `*Motif :* ${pMonth}\n` +
        `*Date :* ${dateStr}\n` +
        `---------------------------\n` +
        `Merci pour votre confiance. 🙏`,
    );
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, "_blank");
  };

  const bulletinSummary = useMemo(() => {
    if (!student || bulletinSubjects.length === 0) return null;

    let totalPoints = 0;
    let totalCoeffs = 0;
    const notes = bulletinSubjects.map((subject) => {
      const grade =
        bulletinGrades.find((g) => g.subject_name === subject.subject_name) ||
        {};
      const gradeClasse = parseFloat(grade.grade_value || "0") || 0;
      const gradeCompo = parseFloat(grade.compo_value || "0") || 0;
      const moyenne = Number(((gradeClasse + gradeCompo * 2) / 3).toFixed(2));
      totalPoints += moyenne * subject.coefficient;
      totalCoeffs += subject.coefficient;
      return {
        name: subject.subject_name,
        gradeClasse,
        gradeCompo,
        moyenne,
        coeff: subject.coefficient,
      };
    });

    const moyenne =
      totalCoeffs > 0 ? parseFloat((totalPoints / totalCoeffs).toFixed(2)) : 0;

    const getMention = (avg: number) => {
      if (avg >= 16) return "Très Bien";
      if (avg >= 14) return "Bien";
      if (avg >= 12) return "Assez Bien";
      if (avg >= 10) return "Passable";
      return "Insuffisant";
    };

    return {
      notes,
      moyenne,
      mention: getMention(moyenne),
      totalCoeffs,
      totalPoints,
    };
  }, [student, bulletinSubjects, bulletinGrades]);

  const groupedTimetable = useMemo(() => {
    return PROFILE_DAYS.map((day) => ({
      day,
      slots: studentTimetable.filter((slot) => slot.day_of_week === day),
    }));
  }, [studentTimetable]);

  const announcementsToShow = useMemo(() => {
    return studentAnnouncements.slice(0, 6).map((announce) => ({
      ...announce,
      audienceLabel:
        announce.target_audience === "Tous"
          ? "Tous"
          : announce.target_audience === "Classes"
            ? `Classe ${announce.classes?.name || ""}`
            : "Cible interne",
    }));
  }, [studentAnnouncements]);

  const latestAttendance = useMemo(
    () => studentAttendance.slice(0, 6),
    [studentAttendance],
  );

  const createBulletinPdf = async () => {
    if (!student) return null;
    const [{ jsPDF }, html2canvas] = await Promise.all([
      import("jspdf").then((m) => ({
        jsPDF:
          (m as any).jsPDF || (m as any).default?.jsPDF || (m as any).default,
      })),
      import("html2canvas").then((m) => (m as any).default || m),
    ]);

    const element = document.getElementById("student-bulletin-pdf");
    if (!element) return null;

    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.display = "block";
    clone.style.position = "fixed";
    clone.style.left = "-9999px";
    clone.style.top = "0";
    clone.style.width = "210mm";
    clone.style.boxSizing = "border-box";
    document.body.appendChild(clone);

    try {
      const canvas = await (html2canvas as any)(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new (jsPDF as any)({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const props = (pdf as any).getImageProperties(imgData);
      let pdfW = pageWidth;
      let pdfH = (props.height * pdfW) / props.width;
      if (pdfH > pageHeight) {
        const scale = pageHeight / pdfH;
        pdfW *= scale;
        pdfH = pageHeight;
      }
      const x = (pageWidth - pdfW) / 2;
      pdf.addImage(imgData, "JPEG", x, 0, pdfW, pdfH);
      const filename = `Bulletin_${student.first_name}_${student.last_name}_${bulletinPeriod}.pdf`;
      const blob = pdf.output("blob");
      return { pdf, blob, filename };
    } finally {
      document.body.removeChild(clone);
    }
  };

  const downloadBulletinPDF = async () => {
    const result = await createBulletinPdf();
    if (!result) return;
    result.pdf.save(result.filename);
  };

  const sendBulletinWhatsApp = async () => {
    if (!student?.parent_phone) return;
    const result = await createBulletinPdf();
    const cleanNumber = student.parent_phone.replace(/\D/g, "");
    const defaultMessage = `Bonjour, voici le bulletin de ${student.first_name} ${student.last_name} pour ${bulletinPeriod}.`;
    const encodedMessage = encodeURIComponent(defaultMessage);

    if (
      result &&
      navigator.canShare?.({
        files: [
          new File([result.blob], result.filename, { type: "application/pdf" }),
        ],
      })
    ) {
      const file = new File([result.blob], result.filename, {
        type: "application/pdf",
      });
      try {
        await navigator.share({
          title: `Bulletin ${student.first_name} ${student.last_name}`,
          text: defaultMessage,
          files: [file],
        });
        return;
      } catch (shareError) {
        console.error("Échec du partage Web Share :", shareError);
      }
    }

    window.open(
      `https://wa.me/${cleanNumber}?text=${encodedMessage}`,
      "_blank",
    );
  };

  // ⚡ INSTANTANÉ : Mise à jour de la moyenne de l'élève
  const handleUpdateAvg = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowAvgForm(false); // On ferme directement le volet pour le confort visuel

    const numericAvg = newAvg === "" ? null : parseFloat(newAvg);
    const backupAvg = student?.last_exam_avg;

    // Mise à jour optimiste immédiate de l'UI
    setStudent((prev: any) =>
      prev ? { ...prev, last_exam_avg: numericAvg } : null,
    );

    const { error } = await offlineWrite({
      table: "students",
      action: "UPDATE",
      payload: { last_exam_avg: numericAvg },
      options: { keyColumn: "id", keyValue: Array.isArray(id) ? id[0] : id },
      cacheKey: `student:${id}`,
      optimisticUpdate: () => {},
    });

    if (error) {
      // Rollback si problème
      setStudent((prev: any) =>
        prev ? { ...prev, last_exam_avg: backupAvg } : null,
      );
    } else {
      fetchData(true); // Rafraîchissement silencieux en tâche de fond
    }
  };

  // ⚡ INSTANTANÉ : Mise à jour de la fiche de configuration
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditModalOpen(false); // On ferme la modal instantanément

    const updatedFields = {
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      parent_phone: editForm.parent_phone,
      address: editForm.address,
      annual_fee: editForm.annual_fee,
      scolarite_totale: editForm.annual_fee,
      payment_plan_tranches: editForm.payment_plan_tranches,
    };
    const backupStudent = { ...student };

    // Application instantanée à l'écran
    setStudent((prev: any) => (prev ? { ...prev, ...updatedFields } : null));

    const { error } = await offlineWrite({
      table: "students",
      action: "UPDATE",
      payload: updatedFields,
      options: { keyColumn: "id", keyValue: Array.isArray(id) ? id[0] : id },
      cacheKey: `student:${id}`,
      optimisticUpdate: () => {},
    });

    if (error) {
      setStudent(backupStudent); // Rollback
    } else {
      fetchData(true); // Sync silencieuse
    }
  };

  // ⚡ INSTANTANÉ : Encaissement Scolarité sans aucun loader
  const handleBasePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    const payAmount = parseFloat(amount.replace(/\s/g, ""));
    if (isNaN(payAmount)) return;

    const currentMonth = month;
    const newCollectedTotal = Number(student?.scolarite_payee || 0) + payAmount;
    const todayStr = new Date().toISOString().split("T")[0];

    // Sauvegarde pour rollback potentiel
    const backupStudent = { ...student };
    const backupPayments = [...payments];

    // 1. Mise à jour instantanée des states UI (Compteurs + Ligne du tableau)
    setStudent((prev: any) =>
      prev
        ? {
            ...prev,
            scolarite_payee: newCollectedTotal,
            dernier_paiement: todayStr,
          }
        : null,
    );
    setPayments((prev) => [
      {
        id: `temp-${Date.now()}`,
        student_id: id,
        amount: payAmount,
        month: currentMonth,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);

    // Nettoyage immédiat des champs de saisie pour donner l'impression de rapidité
    setAmount("");
    setMonth("");

    // 2. Exécution de la mutation en arrière-plan
    const { error: payError } = await offlineWrite({
      table: "payments",
      action: "INSERT",
      payload: {
        student_id: id,
        amount: payAmount,
        month: currentMonth,
        academic_year_id: student?.academic_year_id,
        school_id: student?.school_id,
      },
      cacheKey: `payments:${id}`,
      optimisticUpdate: () => {},
    });

    if (!payError) {
      await offlineWrite({
        table: "students",
        action: "UPDATE",
        payload: {
          scolarite_payee: newCollectedTotal,
          dernier_paiement: todayStr,
        },
        options: { keyColumn: "id", keyValue: Array.isArray(id) ? id[0] : id },
        cacheKey: `student:${id}`,
        optimisticUpdate: () => {},
      });

      sendReceiptWhatsApp(payAmount, currentMonth, "SCOLAIRE");
      fetchData(true); // Resynchronise silencieusement les id réels de la bdd
    } else {
      // Rollback immédiat si le serveur ou le cache local renvoie une erreur
      setStudent(backupStudent);
      setPayments(backupPayments);
    }
  };

  // ⚡ INSTANTANÉ : Frais Compléments & Annexes
  const handleExtraPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    const payAmount = parseFloat(extraAmount.replace(/\s/g, ""));
    if (isNaN(payAmount)) return;

    const typeLabel =
      extraFeeTypes.find((t) => String(t.id) === String(selectedExtraType))
        ?.name || "Frais Divers";
    const backupExtraPayments = [...extraPayments];

    // Injection visuelle immédiate dans le journal comptable
    setExtraPayments((prev) => [
      {
        id: `temp-extra-${Date.now()}`,
        student_id: id,
        fee_type_id: selectedExtraType,
        amount_paid: payAmount,
        payment_date: new Date().toISOString(),
        extra_fee_types: { name: typeLabel },
      },
      ...prev,
    ]);

    setExtraAmount("");
    setSelectedExtraType("");

    const { error } = await offlineWrite({
      table: "student_extra_payments",
      action: "INSERT",
      payload: {
        student_id: id,
        fee_type_id: selectedExtraType,
        amount_paid: payAmount,
        academic_year_id: student?.academic_year_id,
        school_id: student?.school_id,
      },
      cacheKey: `extra_payments:${id}`,
      optimisticUpdate: () => {},
    });

    if (!error) {
      sendReceiptWhatsApp(payAmount, typeLabel, "EXTRA");
      fetchData(true);
    } else {
      setExtraPayments(backupExtraPayments); // Rollback
    }
  };

  // ⚡ INSTANTANÉ : Incident disciplinaire
  const handleAddIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    const todayStr = new Date().toISOString().split("T")[0];
    const currentReason = reason;
    const currentSeverity = severity;
    const backupIncidents = [...incidents];

    // Ajout instantané dans la liste à l'écran
    setIncidents((prev) => [
      {
        id: `temp-inc-${Date.now()}`,
        student_id: id,
        reason: currentReason,
        severity: currentSeverity,
        incident_date: todayStr,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);

    setReason("");

    const { error } = await offlineWrite({
      table: "discipline",
      action: "INSERT",
      payload: {
        student_id: id,
        reason: currentReason,
        severity: currentSeverity,
        incident_date: todayStr,
        academic_year_id: student?.academic_year_id,
        school_id: student?.school_id,
      },
      cacheKey: `discipline:${id}`,
      optimisticUpdate: () => {},
    });

    if (!error) {
      fetchData(true);
    } else {
      setIncidents(backupIncidents); // Rollback
    }
  };

  // Ne bloque l'écran que lors du TOUT PREMIER chargement à l'ouverture de la page
  if (loading && !student)
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-24 text-slate-400">
        <Loader2 className="animate-spin text-[#1763FF]" size={32} />
        <p className="text-xs font-semibold tracking-wide">
          Chargement du profil…
        </p>
      </div>
    );
  if (!student)
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-24 text-center">
        <p className="text-lg font-bold text-slate-800">Élève non trouvé</p>
        <p className="text-sm text-slate-400">
          Ce profil n'existe pas ou a été supprimé.
        </p>
      </div>
    );

  const annualFee = Number(student.scolarite_totale || student.annual_fee || 0);
  const totalPaid = Number(student.scolarite_payee || 0);

  const currentYearCoverage = Math.min(totalPaid, annualFee);
  const nextYearAdvance = Math.max(0, totalPaid - annualFee);
  const remaining = Math.max(0, annualFee - totalPaid);
  const isSolded = remaining === 0;
  const paidPct =
    annualFee > 0
      ? Math.min(100, Math.round((currentYearCoverage / annualFee) * 100))
      : 0;

  const numTranches = student.payment_plan_tranches || 1;
  const amountPerTranche = annualFee / numTranches;

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  const sectionHeader = (
    icon: React.ReactNode,
    title: string,
    subtitle?: string,
    accent = "blue",
  ) => (
    <div className="flex items-center gap-3 mb-4">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          accent === "rose"
            ? "bg-rose-50 text-rose-500"
            : accent === "emerald"
              ? "bg-emerald-50 text-emerald-600"
              : "bg-blue-50 text-[#1763FF]"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11px] text-slate-400 font-medium truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-24 px-3 sm:px-6 lg:px-8 w-full max-w-full overflow-x-hidden">
      {/* ACTIONS DE RETOUR */}
      <div className="flex items-center justify-between gap-3 pt-4">
        <Link
          href="/students"
          className="flex items-center gap-2 text-slate-500 hover:text-[#1763FF] active:scale-95 transition-all font-semibold text-xs"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white border border-slate-200/70 shadow-sm">
            <ArrowLeft size={15} />
          </span>
          <span className="hidden sm:inline">Retour au registre</span>
        </Link>
        <button
          onClick={() => setIsEditModalOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-white border border-slate-200/70 px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-[#1763FF]/30 hover:text-[#1763FF] active:scale-[0.97] transition-all"
        >
          <Settings2 size={14} />
          <span className="hidden xs:inline">Paramètres</span>
        </button>
      </div>

      {/* BANDEAU PROFIL */}
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200/60 bg-white shadow-[0_2px_20px_-8px_rgba(15,23,42,0.08)]">
        <div className="h-16 bg-gradient-to-r from-[#1763FF] via-[#3B7BFF] to-[#00246B]" />
        <div className="px-5 sm:px-8 pb-6 -mt-9 flex flex-col md:flex-row md:items-end gap-5">
          <div className="h-20 w-20 md:h-24 md:w-24 rounded-3xl bg-white p-1 shadow-lg shrink-0 mx-auto md:mx-0">
            <div className="h-full w-full rounded-[1.35rem] bg-gradient-to-br from-[#1763FF] to-[#00246B] text-white flex items-center justify-center text-2xl font-black">
              {student.first_name?.[0]}
              {student.last_name?.[0]}
            </div>
          </div>

          <div className="flex-1 min-w-0 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start gap-2 mt-1">
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight truncate">
                {student.first_name} {student.last_name}
              </h1>
              <span className="px-2.5 py-1 bg-blue-50 text-[#1763FF] rounded-full text-[10px] font-bold uppercase tracking-wide border border-blue-100 shrink-0">
                {student.classes?.name || "Aucune classe"}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-2.5 sm:gap-5 mt-3 text-slate-500 font-medium text-xs">
              <div className="flex items-center gap-1.5">
                <Phone size={13} className="text-slate-400" />
                {student.parent_phone || "Téléphone non renseigné"}
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-slate-400" />
                {student.address || "Adresse non renseignée"}
              </div>
            </div>
          </div>

          {/* COMPTEUR MOYENNE ACADÉMIQUE */}
          <div className="relative shrink-0 mx-auto md:mx-0 w-full sm:w-auto">
            <div className="flex items-center justify-between gap-6 sm:gap-4 bg-slate-50 rounded-2xl border border-slate-100 px-5 py-3.5 sm:flex-col sm:items-center sm:text-center sm:min-w-[130px]">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Dernière moyenne
              </p>
              <p className="text-2xl font-black text-slate-900">
                {student.last_exam_avg !== null &&
                student.last_exam_avg !== undefined
                  ? Number(student.last_exam_avg).toFixed(2)
                  : "—"}
                <span className="text-xs text-slate-400 font-semibold">
                  /20
                </span>
              </p>
            </div>
            <button
              onClick={() => setShowAvgForm(!showAvgForm)}
              className="absolute -top-2.5 -right-2.5 sm:top-auto sm:-bottom-2.5 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 bg-[#1763FF] text-white p-2 rounded-xl shadow-md shadow-blue-500/30 hover:bg-[#1252D4] active:scale-90 transition-all"
              aria-label="Modifier la moyenne"
            >
              {showAvgForm ? <X size={12} /> : <Edit3 size={12} />}
            </button>
          </div>
        </div>
      </div>

      {/* FORMULAIRE RAPIDE MOYENNE */}
      {showAvgForm && (
        <form
          onSubmit={handleUpdateAvg}
          className="bg-white p-4 rounded-2xl border border-slate-200/60 max-w-sm flex gap-2 items-center shadow-sm animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <input
            type="number"
            step="0.01"
            min="0"
            max="20"
            placeholder="Nouvelle moyenne..."
            className="flex-1 p-3 bg-slate-50 rounded-xl text-sm font-semibold border border-transparent outline-none text-slate-800 focus:border-[#1763FF]/30 focus:bg-white transition-colors"
            value={newAvg}
            onChange={(e) => setNewAvg(e.target.value)}
            required
          />
          <button
            type="submit"
            className="bg-[#1763FF] text-white text-xs px-4 py-3 rounded-xl font-bold shrink-0 hover:bg-[#1252D4] active:scale-95 transition-all"
          >
            Valider
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* COLONNE GAUCHE */}
        <div className="lg:col-span-4 space-y-5 lg:order-1 order-2">
          {/* FRAIS EXTRAS */}
          <div className="bg-white p-5 rounded-[28px] border border-slate-200/60 shadow-sm">
            {sectionHeader(
              <Plus size={16} />,
              "Compléments & annexes",
              "Frais divers hors scolarité",
            )}
            <form onSubmit={handleExtraPayment} className="space-y-2.5">
              <select
                className="w-full p-3.5 bg-slate-50 border border-transparent rounded-xl text-sm font-medium outline-none text-slate-800 focus:border-[#1763FF]/30 focus:bg-white transition-colors"
                value={selectedExtraType}
                onChange={(e) => setSelectedExtraType(e.target.value)}
                disabled={isReadOnly}
                required
              >
                <option value="">Sélectionner frais divers...</option>
                {extraFeeTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({Number(t.default_amount).toLocaleString()} F)
                  </option>
                ))}
              </select>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Montant perçu..."
                className="w-full p-3.5 bg-slate-50 border border-transparent rounded-xl text-sm font-medium outline-none text-slate-800 focus:border-[#1763FF]/30 focus:bg-white transition-colors"
                value={formatInputDisplay(extraAmount)}
                onChange={(e) => setExtraAmount(e.target.value)}
                disabled={isReadOnly}
                required
              />
              <button
                type="submit"
                disabled={isReadOnly}
                className="w-full bg-[#1763FF] text-white p-3.5 rounded-xl font-bold text-sm hover:bg-[#1252D4] active:scale-[0.98] transition-all shadow-md shadow-blue-500/15 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Valider l'encaissement
              </button>
            </form>
          </div>

          {/* DISCIPLINE */}
          <div className="bg-white p-5 rounded-[28px] border border-slate-200/60 shadow-sm space-y-4">
            {sectionHeader(
              <ShieldAlert size={16} />,
              "Dossier discipline",
              "Suivi comportemental",
              "rose",
            )}
            <form onSubmit={handleAddIncident} className="space-y-2.5">
              <textarea
                placeholder="Rédiger le motif du rapport..."
                className="w-full p-3.5 bg-slate-50 border border-transparent rounded-xl text-sm h-16 resize-none outline-none font-medium text-slate-800 focus:border-[#1763FF]/30 focus:bg-white transition-colors"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isReadOnly}
                required
              />
              <div className="flex gap-1.5">
                {["Bas", "Moyen", "Grave"].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setSeverity(l)}
                    disabled={isReadOnly}
                    className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${
                      severity === l
                        ? "bg-rose-500 text-white shadow-sm shadow-rose-500/30"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={isReadOnly}
                className="w-full bg-[#1763FF] text-white p-3.5 rounded-xl font-bold text-sm hover:bg-[#1252D4] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enregistrer l'incident
              </button>
            </form>

            {/* Historique interne de l'étudiant */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Registre disciplinaire
              </p>
              {incidents.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium italic py-2">
                  Aucun incident à signaler.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto no-scrollbar">
                  {incidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs flex justify-between items-start gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 leading-tight">
                          {inc.reason}
                        </p>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(
                            inc.incident_date || inc.created_at,
                          ).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                          inc.severity === "Grave"
                            ? "bg-rose-100 text-rose-700"
                            : inc.severity === "Moyen"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {inc.severity || "Bas"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLONNE DROITE */}
        <div className="lg:col-span-8 space-y-5 lg:order-2 order-1">
          {/* BARRES DE PROGRESSION SOLDE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="bg-white p-5 rounded-[28px] border border-slate-200/60 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wide">
                  Scolarité payée
                </p>
                <span className="text-[10px] font-bold text-slate-400">
                  {paidPct}%
                </span>
              </div>
              <h4 className="text-xl sm:text-2xl font-black text-slate-950">
                {fmt(currentYearCoverage)}{" "}
                <span className="text-xs font-semibold text-slate-400">
                  F CFA
                </span>
              </h4>
              <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${isSolded ? "bg-emerald-500" : "bg-gradient-to-r from-[#1763FF] to-[#3B7BFF]"}`}
                  style={{ width: `${paidPct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                sur {fmt(annualFee)} F CFA prévus
              </p>
            </div>

            {isSolded ? (
              <div className="relative overflow-hidden bg-gradient-to-br from-[#1763FF] to-[#00246B] p-5 rounded-[28px] text-white shadow-md shadow-blue-500/20">
                <Sparkles
                  size={64}
                  className="absolute -right-3 -top-3 text-white/10"
                />
                <p className="text-blue-100 text-[10px] font-bold uppercase tracking-wide mb-1">
                  Avance année suivante
                </p>
                <h4 className="text-xl sm:text-2xl font-black">
                  {fmt(nextYearAdvance)}{" "}
                  <span className="text-xs font-semibold text-blue-200">
                    F CFA
                  </span>
                </h4>
                <p className="text-[11px] text-blue-100/80 mt-2">
                  Scolarité entièrement soldée
                </p>
              </div>
            ) : (
              <div className="bg-white p-5 rounded-[28px] border border-rose-100 shadow-sm">
                <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wide mb-1">
                  Reliquat dû
                </p>
                <h4 className="text-xl sm:text-2xl font-black text-rose-600">
                  {fmt(remaining)}{" "}
                  <span className="text-xs font-semibold text-rose-400">
                    F CFA
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-2">
                  à percevoir avant fin d'échéancier
                </p>
              </div>
            )}
          </div>

          {/* RÉSUMÉ DES TRANCHES */}
          <div className="bg-white p-5 sm:p-6 rounded-[28px] border border-slate-200/60 shadow-sm">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <h3 className="text-xs font-bold text-slate-500">
                Échéancier de scolarité{" "}
                <span className="text-slate-400 font-medium">
                  ({numTranches})
                </span>
              </h3>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Montant unitaire
                </p>
                <p className="text-sm font-black text-slate-900">
                  {fmt(amountPerTranche)} F CFA
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1 snap-x snap-mandatory no-scrollbar sm:grid sm:grid-cols-4 sm:overflow-visible">
              {Array.from({ length: numTranches }).map((_, i) => {
                const trancheTarget = (i + 1) * amountPerTranche;
                const isTranchePaid = totalPaid >= trancheTarget;
                return (
                  <div
                    key={i}
                    className={`snap-start shrink-0 w-[42%] sm:w-auto p-3.5 rounded-2xl border transition-colors ${isTranchePaid ? "bg-emerald-50/70 border-emerald-100" : "bg-slate-50 border-slate-100"}`}
                  >
                    <p
                      className={`text-[9px] font-bold uppercase mb-1 ${isTranchePaid ? "text-emerald-600" : "text-slate-400"}`}
                    >
                      Échéance {i + 1}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {isTranchePaid ? (
                        <CheckCircle2 size={13} className="text-emerald-600" />
                      ) : (
                        <div className="h-2.5 w-2.5 rounded-full border-2 border-slate-300" />
                      )}
                      <span
                        className={`text-xs font-bold ${isTranchePaid ? "text-emerald-800" : "text-slate-400"}`}
                      >
                        {isTranchePaid ? "Réglée" : "En attente"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FORMULAIRE ENCAISSEMENT BRUT PAIEMENT */}
          <div className="bg-white p-5 sm:p-6 rounded-[28px] border border-slate-200/60 shadow-sm">
            {sectionHeader(
              <Wallet size={16} />,
              "Encaisser un paiement scolaire",
            )}
            <form
              onSubmit={handleBasePayment}
              className="flex flex-col sm:grid sm:grid-cols-3 gap-2.5"
            >
              <input
                type="text"
                inputMode="numeric"
                placeholder="Montant en francs..."
                className="p-3.5 bg-slate-50 border border-transparent rounded-xl font-medium outline-none text-sm text-slate-800 focus:border-[#1763FF]/30 focus:bg-white transition-colors"
                value={formatInputDisplay(amount)}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isReadOnly}
                required
              />
              <select
                className="p-3.5 bg-slate-50 border border-transparent rounded-xl outline-none font-medium text-sm text-slate-800 focus:border-[#1763FF]/30 focus:bg-white transition-colors"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                disabled={isReadOnly}
                required
              >
                <option value="">Sélectionner période...</option>
                {["Tranche 1", "Tranche 2", "Tranche 3", "Mensualité"].map(
                  (m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ),
                )}
              </select>
              <button
                disabled={isReadOnly}
                className="bg-[#1763FF] text-white p-3.5 rounded-xl font-bold text-sm hover:bg-[#1252D4] active:scale-[0.98] transition-all shadow-md shadow-blue-500/15 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Valider & générer reçu
              </button>
            </form>
          </div>

          {/* JOURNAL DES MUTATIONS FINANCIÈRES */}
          <div className="bg-white rounded-[28px] border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="p-5 pb-3 flex items-center gap-3 border-b border-slate-100">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1763FF]">
                <ReceiptText size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Journal comptable individuel
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Historique de tous les encaissements
                </p>
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto no-scrollbar">
              {[...payments, ...extraPayments].length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-400 font-medium">
                  Aucun mouvement enregistré.
                </p>
              ) : (
                [...payments, ...extraPayments]
                  .sort(
                    (a, b) =>
                      new Date(b.payment_date || b.created_at).getTime() -
                      new Date(a.payment_date || a.created_at).getTime(),
                  )
                  .map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-blue-50/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${p.extra_fee_types ? "bg-[#1763FF]" : "bg-slate-400"}`}
                        />
                        <div className="min-w-0">
                          <span
                            className={`text-[11px] font-bold ${p.extra_fee_types ? "text-[#1763FF]" : "text-slate-600"}`}
                          >
                            {p.extra_fee_types
                              ? p.extra_fee_types.name
                              : p.month}
                          </span>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {new Date(
                              p.payment_date || p.created_at,
                            ).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                      </div>
                      <span className="font-black text-slate-900 text-sm whitespace-nowrap">
                        {fmt(p.amount || p.amount_paid)} F
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* ENSEIGNEMENTS ET ASSIDUITE */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="bg-white p-5 sm:p-6 rounded-[28px] border border-slate-200/60 shadow-sm">
              {sectionHeader(
                <BookOpen size={16} />,
                "Emploi du temps",
                "Vue par jour pour la classe de l\u2019élève",
              )}
              {studentTimetable.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-center text-slate-400 text-sm">
                  Aucun créneau disponible pour cette année.
                </div>
              ) : (
                <div className="space-y-4 max-h-[420px] overflow-y-auto no-scrollbar pr-1">
                  {groupedTimetable.map((group) => (
                    <div key={group.day} className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        <span>{group.day}</span>
                        <span>{group.slots.length} cours</span>
                      </div>
                      {group.slots.length === 0 ? (
                        <div className="rounded-2xl bg-slate-50 p-3.5 text-slate-400 text-xs">
                          Aucun cours.
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          {group.slots.map((slot) => (
                            <div
                              key={
                                slot.id ??
                                `${group.day}-${slot.start_time}-${slot.subject_name}`
                              }
                              className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50 flex items-center gap-3"
                            >
                              <div className="w-1 self-stretch rounded-full bg-[#1763FF]/70 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-900 mb-1">
                                  <span className="truncate">
                                    {slot.subject_name}
                                  </span>
                                  <span className="text-slate-500 font-semibold shrink-0">
                                    {slot.start_time.substring(0, 5)}-
                                    {slot.end_time.substring(0, 5)}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-2">
                                  <span>
                                    {slot.teacher_name ||
                                      "Professeur non défini"}
                                  </span>
                                  <span className="text-slate-300">•</span>
                                  <span>
                                    Salle {slot.classroom_number || "N/A"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-[28px] border border-slate-200/60 shadow-sm">
              {sectionHeader(
                <Clock size={16} />,
                "Assiduité",
                "Historique récent des absences et retards",
              )}
              {latestAttendance.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-center text-slate-400 text-sm">
                  Aucun enregistrement d'assiduité pour cet élève.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {latestAttendance.map((log) => (
                    <div
                      key={
                        log.id ||
                        `${log.date_checked}-${log.student_id}-${log.attendance_status}`
                      }
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5"
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-2">
                        <span>
                          {new Date(log.date_checked).toLocaleDateString(
                            "fr-FR",
                          )}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${log.attendance_status === "retard" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}
                        >
                          {log.attendance_status === "retard"
                            ? "Retard"
                            : "Absence"}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        {log.description ||
                          (log.attendance_status === "retard"
                            ? "Retard signalé"
                            : "Absence signalée")}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        Durée estimée : {log.duration_hours ?? 1} heure(s)
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COMMUNICATIONS & ANNONCES */}
<div className="bg-white p-5 sm:p-6 rounded-[28px] border border-slate-200/60 shadow-sm">
  {sectionHeader(
    <Bell size={16} />,
    "Annonces & Infos",
    "Messages ciblés pour les parents et la classe",
  )}
  
  {announcementsToShow.length === 0 ? (
    <div className="rounded-2xl bg-slate-50 p-6 text-center text-slate-400 text-sm font-medium">
      Aucune annonce disponible pour le moment.
    </div>
  ) : (
    <div className="space-y-3">
      {announcementsToShow.map((announce) => (
        <div
          key={announce.id}
          className={`rounded-2xl border p-4 transition relative ${
            announce.is_pinned 
              ? "border-amber-200 bg-amber-50/40 ring-1 ring-amber-300/20" 
              : "border-slate-100 bg-slate-50/60"
          }`}
        >
          {/* Tags de Catégories & Badge Audience */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-black text-slate-500">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    announce.type === "event" 
                      ? "bg-emerald-500" 
                      : announce.type === "holiday" 
                        ? "bg-amber-500" 
                        : "bg-blue-500"
                  }`}
                />
                {announce.type === "event"
                  ? "Événement"
                  : announce.type === "holiday"
                    ? "Congés"
                    : "Annonce"}
              </span>

              {announce.is_pinned && (
                <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Important
                </span>
              )}
            </div>

            {/* Label de l'audience dynamique */}
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide bg-white px-2 py-0.5 rounded-md border border-slate-100 shadow-2xs">
              🎯 {announce.target_audience === "Tous" ? "Général" : "Votre Classe"}
            </span>
          </div>

          {/* Titre */}
          <h4 className="font-black text-slate-800 text-sm mb-1 uppercase tracking-wide">
            {announce.title}
          </h4>

          {/* Contenu */}
          <p className="text-[12px] text-slate-600 mb-2.5 font-medium whitespace-pre-line leading-relaxed">
            {announce.content}
          </p>

          {/* Pied d'infos de la carte */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 font-semibold border-t border-slate-200/40 pt-2">
            {announce.event_date && (
              <span className="text-slate-500 font-bold">
                📅 Date prévue :{" "}
                {new Date(announce.event_date).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                })}
              </span>
            )}
            <span>
              🕒 Publiée le{" "}
              {new Date(announce.created_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric"
              })}
            </span>
          </div>
        </div>
      ))}
    </div>
  )}
</div>

          {/* SECTION BULLETIN DE L'ÉLÈVE */}
          <div className="bg-white p-5 sm:p-6 rounded-[28px] border border-slate-200/60 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              {sectionHeader(
                <GraduationCap size={16} />,
                "Bulletin",
                "Accès direct aux notes et génération PDF",
              )}
              <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full sm:w-auto">
                <select
                  value={bulletinPeriod}
                  onChange={(e) => setBulletinPeriod(e.target.value)}
                  className="w-full sm:w-auto p-3 bg-slate-50 border border-transparent rounded-xl text-xs font-semibold outline-none text-slate-800 focus:border-[#1763FF]/30 focus:bg-white transition-colors"
                >
                  {["1er Trimestre", "2ème Trimestre", "3ème Trimestre"].map(
                    (period) => (
                      <option key={period} value={period}>
                        {period}
                      </option>
                    ),
                  )}
                </select>
                <button
                  onClick={downloadBulletinPDF}
                  disabled={!bulletinSummary || bulletinLoading}
                  className="bg-[#1763FF] text-white rounded-xl px-4 py-3 text-xs font-bold hover:bg-[#1252D4] active:scale-[0.97] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={14} /> PDF
                </button>
                <button
                  onClick={sendBulletinWhatsApp}
                  disabled={!student?.parent_phone || bulletinLoading}
                  className="bg-emerald-600 text-white rounded-xl px-4 py-3 text-xs font-bold hover:bg-emerald-700 active:scale-[0.97] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageSquare size={14} /> WhatsApp
                </button>
              </div>
            </div>

            {bulletinLoading ? (
              <div className="text-center py-10 text-slate-400 font-medium flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-[#1763FF]" size={20} />
                Chargement du bulletin…
              </div>
            ) : bulletinSummary ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400 mb-1.5 font-bold">
                      Moyenne
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-900">
                      {bulletinSummary.moyenne}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400 mb-1.5 font-bold">
                      Mention
                    </p>
                    <p className="text-sm sm:text-lg font-black text-slate-900 leading-tight">
                      {bulletinSummary.mention}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400 mb-1.5 font-bold">
                      Coefficients
                    </p>
                    <p className="text-lg sm:text-lg font-black text-slate-900">
                      {bulletinSummary.totalCoeffs}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {bulletinSummary.notes.map((note) => (
                    <div
                      key={note.name}
                      className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div className="font-bold text-slate-900 min-w-0 truncate flex-1">
                        {note.name}
                      </div>
                      <div className="text-slate-500 font-medium">
                        Classe {note.gradeClasse}
                      </div>
                      <div className="text-slate-500 font-medium">
                        Compo {note.gradeCompo}
                      </div>
                      <div className="font-black text-[#1763FF]">
                        {note.moyenne}/20
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 font-medium">
                Aucun bulletin disponible pour cette période.
              </div>
            )}

            <div
              id="student-bulletin-pdf"
              style={{
                position: "fixed",
                left: "-9999px",
                top: 0,
                width: "210mm",
                padding: "32px",
                background: "#ffffff",
                color: "#0f172a",
                fontFamily: "Inter, Arial, Helvetica, sans-serif",
                boxSizing: "border-box",
              }}
            >
              <div style={{ marginBottom: "24px" }}>
                <h1 style={{ fontSize: "28px", fontWeight: 900, margin: 0 }}>
                  {student.first_name} {student.last_name}
                </h1>
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: "14px",
                    color: "#475569",
                  }}
                >
                  Bulletin - {bulletinPeriod}
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "12px",
                    color: "#6b7280",
                  }}
                >
                  Classe : {student.classes?.name || "Non renseignée"}
                </p>
              </div>
              <div style={{ marginBottom: "20px" }}>
                <p
                  style={{
                    fontSize: "12px",
                    margin: "0 0 8px",
                    fontWeight: 700,
                  }}
                >
                  Moyenne générale
                </p>
                <p style={{ fontSize: "32px", margin: 0, fontWeight: 900 }}>
                  {bulletinSummary?.moyenne ?? "0.00"}
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    margin: "4px 0 0",
                    color: "#6b7280",
                  }}
                >
                  Mention : {bulletinSummary?.mention ?? "N/A"}
                </p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: "12px",
                }}
              >
                {bulletinSummary?.notes.map((note) => (
                  <div
                    key={note.name}
                    style={{
                      padding: "14px",
                      borderRadius: "24px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "12px",
                        color: "#475569",
                        fontWeight: 800,
                      }}
                    >
                      {note.name}
                    </p>
                    <p
                      style={{
                        margin: "10px 0 0",
                        fontSize: "12px",
                        color: "#0f172a",
                      }}
                    >
                      Classe: {note.gradeClasse}
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: "12px",
                        color: "#0f172a",
                      }}
                    >
                      Compo: {note.gradeCompo}
                    </p>
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: "14px",
                        color: "#111827",
                        fontWeight: 800,
                      }}
                    >
                      Moyenne: {note.moyenne}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* PARAMÈTRES ET MODAL DE CONFIGURATION */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] p-6 shadow-2xl overflow-y-auto max-h-[88vh] no-scrollbar animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Fiche de configuration
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">
                  Informations et échéancier de l'élève
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-blue-50 hover:text-[#1763FF] active:scale-90 transition-all"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">
                  Planification échéances
                </label>
                <select
                  className="w-full p-3.5 bg-slate-50 border border-transparent rounded-xl font-semibold text-sm text-slate-800 outline-none focus:border-[#1763FF]/30 focus:bg-white transition-colors"
                  value={editForm.payment_plan_tranches}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      payment_plan_tranches: parseInt(e.target.value),
                    })
                  }
                >
                  <option value={1}>1 versement unique</option>
                  <option value={3}>3 tranches (Trimestriel)</option>
                  <option value={9}>9 tranches (Mensuel)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">
                    Prénom
                  </label>
                  <input
                    type="text"
                    className="w-full p-3.5 bg-slate-50 border border-transparent rounded-xl font-semibold text-sm text-slate-800 outline-none focus:border-[#1763FF]/30 focus:bg-white transition-colors"
                    value={editForm.first_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, first_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">
                    Nom
                  </label>
                  <input
                    type="text"
                    className="w-full p-3.5 bg-slate-50 border border-transparent rounded-xl font-semibold text-sm text-slate-800 outline-none focus:border-[#1763FF]/30 focus:bg-white transition-colors"
                    value={editForm.last_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, last_name: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">
                  Contact parent
                </label>
                <input
                  type="text"
                  className="w-full p-3.5 bg-slate-50 border border-transparent rounded-xl font-semibold text-sm text-slate-800 outline-none focus:border-[#1763FF]/30 focus:bg-white transition-colors"
                  value={editForm.parent_phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, parent_phone: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">
                  Adresse habitation
                </label>
                <input
                  type="text"
                  className="w-full p-3.5 bg-slate-50 border border-transparent rounded-xl font-semibold text-sm text-slate-800 outline-none focus:border-[#1763FF]/30 focus:bg-white transition-colors"
                  value={editForm.address}
                  onChange={(e) =>
                    setEditForm({ ...editForm, address: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">
                  Montant scolarité annuelle requis
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full p-3.5 bg-slate-50 border border-transparent rounded-xl font-black text-sm text-[#1763FF] outline-none focus:border-[#1763FF]/30 focus:bg-white transition-colors"
                  value={formatInputDisplay(String(editForm.annual_fee ?? 0))}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\s/g, "");
                    setEditForm({
                      ...editForm,
                      annual_fee: clean === "" ? 0 : parseInt(clean, 10),
                    });
                  }}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#1763FF] text-white p-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mt-2 hover:bg-[#1252D4] active:scale-[0.98] transition-all shadow-md shadow-blue-500/20"
              >
                <Save size={14} /> Sauvegarder les modifications
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
