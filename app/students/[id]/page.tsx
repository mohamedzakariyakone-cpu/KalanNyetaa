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
  const [mobileSection, setMobileSection] = useState<"overview" | "payments" | "discipline" | "bulletin">("overview");

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
    setShowAvgForm(false);

    const numericAvg = newAvg === "" ? null : parseFloat(newAvg);
    const backupAvg = student?.last_exam_avg;

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
      setStudent((prev: any) =>
        prev ? { ...prev, last_exam_avg: backupAvg } : null,
      );
    } else {
      fetchData(true);
    }
  };

  // ⚡ INSTANTANÉ : Mise à jour de la fiche de configuration
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditModalOpen(false);

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
      setStudent(backupStudent);
    } else {
      fetchData(true);
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

    const backupStudent = { ...student };
    const backupPayments = [...payments];

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

    setAmount("");
    setMonth("");

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
      fetchData(true);
    } else {
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
      setExtraPayments(backupExtraPayments);
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
      setIncidents(backupIncidents);
    }
  };

  // Ne bloque l'écran que lors du TOUT PREMIER chargement à l'ouverture de la page
  if (loading && !student)
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-24 bg-gradient-to-br from-blue-50 to-indigo-50 text-slate-400">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <p className="text-xs font-bold tracking-wide">
          Chargement du profil…
        </p>
      </div>
    );
  if (!student)
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-24 bg-gradient-to-br from-red-50 to-orange-50 text-center">
        <p className="text-lg font-black text-slate-900">Élève non trouvé</p>
        <p className="text-sm text-slate-500 font-medium">
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

  const mobileSectionClass = (section: "overview" | "payments" | "discipline" | "bulletin") =>
    mobileSection === section ? "block" : "hidden sm:block"

  const sectionHeader = (
    icon: React.ReactNode,
    title: string,
    subtitle?: string,
    accent = "blue",
  ) => (
    <div className="flex items-center gap-3 mb-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-bold text-lg shadow-md ${
          accent === "rose"
            ? "bg-gradient-to-br from-rose-400 to-rose-600 text-white"
            : accent === "emerald"
              ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white"
              : accent === "amber"
                ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
                : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-black text-slate-900 tracking-tight truncate">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11px] text-slate-500 font-bold truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 space-y-5 pb-24 px-3 sm:px-6 lg:px-8 w-full max-w-full overflow-x-hidden">
      {/* ACTIONS DE RETOUR */}
      <div className="flex items-center justify-between gap-3 pt-4 max-w-7xl mx-auto w-full">
        <Link
          href="/students"
          className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 active:scale-95 transition-all font-bold text-xs hover:shadow-lg"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white border-2 border-indigo-200 shadow-md hover:shadow-lg hover:border-indigo-400 transition-all">
            <ArrowLeft size={16} className="font-bold" />
          </span>
          <span className="hidden sm:inline">Retour au registre</span>
        </Link>
        <button
          onClick={() => setIsEditModalOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-4 py-2.5 text-xs font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
        >
          <Settings2 size={15} className="font-bold" />
          <span className="hidden xs:inline">Paramètres</span>
        </button>
      </div>

      {/* BANDEAU PROFIL */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-white to-blue-50 shadow-xl max-w-7xl mx-auto w-full">
        <div className="h-20 bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-500" />
        <div className="px-5 sm:px-8 pb-6 -mt-10 flex flex-col md:flex-row md:items-end gap-5">
          <div className="h-20 w-20 md:h-28 md:w-28 rounded-3xl bg-white p-1.5 shadow-xl shrink-0 mx-auto md:mx-0 border-4 border-indigo-200">
            <div className="h-full w-full rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center text-3xl font-black shadow-lg">
              {student.first_name?.[0]}
              {student.last_name?.[0]}
            </div>
          </div>

          <div className="flex-1 min-w-0 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start gap-2 mt-1">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate">
                {student.first_name} {student.last_name}
              </h1>
              <span className="px-3 py-1.5 bg-gradient-to-r from-indigo-100 to-blue-100 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-indigo-300 shrink-0 shadow-md">
                {student.classes?.name || "Aucune classe"}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-2.5 sm:gap-5 mt-3 text-slate-600 font-bold text-xs">
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
                <Phone size={14} className="text-indigo-600" />
                {student.parent_phone || "Téléphone non renseigné"}
              </div>
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
                <MapPin size={14} className="text-indigo-600" />
                {student.address || "Adresse non renseignée"}
              </div>
            </div>
          </div>

          {/* COMPTEUR MOYENNE ACADÉMIQUE */}
          <div className="relative shrink-0 mx-auto md:mx-0 w-full sm:w-auto">
            <div className="flex items-center justify-between gap-6 sm:gap-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border-2 border-indigo-200 px-5 py-4 sm:flex-col sm:items-center sm:text-center sm:min-w-[140px] shadow-lg">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">
                Dernière moyenne
              </p>
              <p className="text-3xl font-black text-indigo-700">
                {student.last_exam_avg !== null &&
                student.last_exam_avg !== undefined
                  ? Number(student.last_exam_avg).toFixed(2)
                  : "—"}
                <span className="text-xs text-slate-500 font-bold">
                  /20
                </span>
              </p>
            </div>
            <button
              onClick={() => setShowAvgForm(!showAvgForm)}
              className="absolute -top-2.5 -right-2.5 sm:top-auto sm:-bottom-2.5 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-2.5 rounded-xl shadow-lg hover:shadow-xl hover:scale-110 active:scale-90 transition-all font-bold"
              aria-label="Modifier la moyenne"
            >
              {showAvgForm ? <X size={13} /> : <Edit3 size={13} />}
            </button>
          </div>
        </div>
      </div>

      {/* FORMULAIRE RAPIDE MOYENNE */}
      {showAvgForm && (
        <form
          onSubmit={handleUpdateAvg}
          className="bg-white p-4 rounded-2xl border-2 border-indigo-200 max-w-sm flex gap-2 items-center shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 max-w-7xl mx-auto w-full"
        >
          <input
            type="number"
            step="0.01"
            min="0"
            max="20"
            placeholder="Nouvelle moyenne..."
            className="flex-1 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl text-sm font-bold border-2 border-indigo-200 outline-none text-slate-800 focus:border-indigo-500 focus:bg-white transition-all"
            value={newAvg}
            onChange={(e) => setNewAvg(e.target.value)}
            required
          />
          <button
            type="submit"
            className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs px-5 py-3 rounded-xl font-black shrink-0 hover:shadow-lg active:scale-95 transition-all shadow-md"
          >
            Valider
          </button>
        </form>
      )}

      <div className="mt-4 sm:hidden max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-4 gap-2">
          {[
            { key: "overview", label: "Résumé" },
            { key: "payments", label: "Paiements" },
            { key: "discipline", label: "Discipline" },
            { key: "bulletin", label: "Bulletin" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMobileSection(tab.key as any)}
              className={`rounded-2xl border-2 px-2 py-2 text-[11px] font-black transition-all ${
                mobileSection === tab.key
                  ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-indigo-600 shadow-lg"
                  : "bg-white text-slate-600 border-slate-300 hover:border-indigo-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-7xl mx-auto w-full">
        {/* COLONNE GAUCHE */}
        <div className="lg:col-span-4 space-y-5 lg:order-1 order-2">
          {/* FRAIS EXTRAS */}
          <div className={`${mobileSectionClass("payments")} bg-gradient-to-br from-white to-amber-50 p-6 rounded-3xl border-2 border-amber-200 shadow-lg`}>
            {sectionHeader(
              <Plus size={18} />,
              "Compléments & annexes",
              "Frais divers hors scolarité",
              "amber",
            )}
            <form onSubmit={handleExtraPayment} className="space-y-3">
              <select
                className="w-full p-3.5 bg-amber-50 border-2 border-amber-200 rounded-xl text-sm font-bold outline-none text-slate-800 focus:border-amber-400 focus:bg-white transition-all"
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
                className="w-full p-3.5 bg-amber-50 border-2 border-amber-200 rounded-xl text-sm font-bold outline-none text-slate-800 focus:border-amber-400 focus:bg-white transition-all"
                value={formatInputDisplay(extraAmount)}
                onChange={(e) => setExtraAmount(e.target.value)}
                disabled={isReadOnly}
                required
              />
              <button
                type="submit"
                disabled={isReadOnly}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white p-3.5 rounded-xl font-black text-sm hover:shadow-lg active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Valider l'encaissement
              </button>
            </form>
          </div>

          {/* DISCIPLINE */}
          <div className={`${mobileSectionClass("discipline")} bg-gradient-to-br from-white to-rose-50 p-6 rounded-3xl border-2 border-rose-200 shadow-lg space-y-4`}>
            {sectionHeader(
              <ShieldAlert size={18} />,
              "Dossier discipline",
              "Suivi comportemental",
              "rose",
            )}
            <form onSubmit={handleAddIncident} className="space-y-3">
              <textarea
                placeholder="Rédiger le motif du rapport..."
                className="w-full p-3.5 bg-rose-50 border-2 border-rose-200 rounded-xl text-sm h-16 resize-none outline-none font-medium text-slate-800 focus:border-rose-400 focus:bg-white transition-all"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isReadOnly}
                required
              />
              <div className="flex gap-2">
                {["Bas", "Moyen", "Grave"].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setSeverity(l)}
                    disabled={isReadOnly}
                    className={`flex-1 py-2.5 rounded-lg text-[11px] font-black transition-all ${
                      severity === l
                        ? "bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-slate-200"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={isReadOnly}
                className="w-full bg-gradient-to-r from-rose-500 to-red-600 text-white p-3.5 rounded-xl font-black text-sm hover:shadow-lg active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enregistrer l'incident
              </button>
            </form>

            {/* Historique interne de l'étudiant */}
            <div className="pt-4 border-t-2 border-rose-200 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wide text-rose-600">
                Registre disciplinaire
              </p>
              {incidents.length === 0 ? (
                <p className="text-xs text-slate-500 font-bold italic py-2">
                  Aucun incident à signaler.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
                  {incidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="p-3 bg-white border-2 border-rose-100 rounded-xl text-xs flex justify-between items-start gap-2 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 leading-tight">
                          {inc.reason}
                        </p>
                        <span className="text-[10px] text-slate-500 font-bold">
                          {new Date(
                            inc.incident_date || inc.created_at,
                          ).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[9px] font-black shrink-0 ${
                          inc.severity === "Grave"
                            ? "bg-rose-200 text-rose-800"
                            : inc.severity === "Moyen"
                              ? "bg-amber-200 text-amber-800"
                              : "bg-slate-200 text-slate-700"
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
          <div className={`${mobileSectionClass("overview")} grid grid-cols-1 sm:grid-cols-2 gap-4`}>
            <div className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-3xl border-2 border-blue-200 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <p className="text-blue-600 text-[10px] font-black uppercase tracking-wide">
                  Scolarité payée
                </p>
                <span className="text-[11px] font-black text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
                  {paidPct}%
                </span>
              </div>
              <h4 className="text-2xl sm:text-3xl font-black text-slate-900">
                {fmt(currentYearCoverage)}{" "}
                <span className="text-xs font-bold text-slate-500">
                  F CFA
                </span>
              </h4>
              <div className="w-full bg-slate-200 h-3 rounded-full mt-4 overflow-hidden border-2 border-blue-200">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${isSolded ? "bg-gradient-to-r from-emerald-500 to-green-600" : "bg-gradient-to-r from-indigo-600 to-blue-500"}`}
                  style={{ width: `${paidPct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-600 font-bold mt-3">
                sur {fmt(annualFee)} F CFA prévus
              </p>
            </div>

            {isSolded ? (
              <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-green-600 p-6 rounded-3xl text-white shadow-xl border-2 border-emerald-400">
                <Sparkles
                  size={70}
                  className="absolute -right-5 -top-5 text-white/20"
                />
                <p className="text-emerald-100 text-[10px] font-black uppercase tracking-wide mb-2">
                  Avance année suivante
                </p>
                <h4 className="text-2xl sm:text-3xl font-black">
                  {fmt(nextYearAdvance)}{" "}
                  <span className="text-xs font-bold text-emerald-100">
                    F CFA
                  </span>
                </h4>
                <p className="text-[11px] text-emerald-100/90 mt-3 font-bold">
                  Scolarité entièrement soldée ✓
                </p>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-white to-red-50 p-6 rounded-3xl border-2 border-red-200 shadow-lg">
                <p className="text-red-600 text-[10px] font-black uppercase tracking-wide mb-2">
                  Reliquat dû
                </p>
                <h4 className="text-2xl sm:text-3xl font-black text-red-700">
                  {fmt(remaining)}{" "}
                  <span className="text-xs font-bold text-red-500">
                    F CFA
                  </span>
                </h4>
                <p className="text-[11px] text-slate-600 font-bold mt-3">
                  à percevoir avant fin d'échéancier
                </p>
              </div>
            )}
          </div>

          {/* RÉSUMÉ DES TRANCHES */}
          <div className="bg-gradient-to-br from-white to-indigo-50 p-6 sm:p-7 rounded-3xl border-2 border-indigo-200 shadow-lg">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
              <h3 className="text-xs font-black text-slate-900">
                Échéancier de scolarité{" "}
                <span className="text-indigo-600 font-bold">
                  ({numTranches})
                </span>
              </h3>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase">
                  Montant unitaire
                </p>
                <p className="text-sm font-black text-indigo-700">
                  {fmt(amountPerTranche)} F CFA
                </p>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar sm:grid sm:grid-cols-4 sm:overflow-visible">
              {Array.from({ length: numTranches }).map((_, i) => {
                const trancheTarget = (i + 1) * amountPerTranche;
                const isTranchePaid = totalPaid >= trancheTarget;
                return (
                  <div
                    key={i}
                    className={`snap-start shrink-0 w-[42%] sm:w-auto p-4 rounded-2xl border-2 transition-all font-bold ${isTranchePaid ? "bg-gradient-to-br from-emerald-100 to-green-100 border-emerald-300 shadow-md" : "bg-white border-slate-300 shadow-sm hover:shadow-md"}`}
                  >
                    <p
                      className={`text-[9px] font-black uppercase mb-2 ${isTranchePaid ? "text-emerald-700" : "text-slate-600"}`}
                    >
                      Échéance {i + 1}
                    </p>
                    <div className="flex items-center gap-2">
                      {isTranchePaid ? (
                        <CheckCircle2 size={14} className="text-emerald-600 font-bold" />
                      ) : (
                        <div className="h-3 w-3 rounded-full border-2 border-slate-400" />
                      )}
                      <span
                        className={`text-xs font-black ${isTranchePaid ? "text-emerald-800" : "text-slate-600"}`}
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
          <div className={`${mobileSectionClass("payments")} bg-gradient-to-br from-white to-indigo-50 p-6 sm:p-7 rounded-3xl border-2 border-indigo-200 shadow-lg`}>
            {sectionHeader(
              <Wallet size={18} />,
              "Encaisser un paiement scolaire",
            )}
            <form
              onSubmit={handleBasePayment}
              className="flex flex-col sm:grid sm:grid-cols-3 gap-3"
            >
              <input
                type="text"
                inputMode="numeric"
                placeholder="Montant en francs..."
                className="p-3.5 bg-indigo-50 border-2 border-indigo-200 rounded-xl font-bold outline-none text-sm text-slate-800 focus:border-indigo-400 focus:bg-white transition-all"
                value={formatInputDisplay(amount)}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isReadOnly}
                required
              />
              <select
                className="p-3.5 bg-indigo-50 border-2 border-indigo-200 rounded-xl outline-none font-bold text-sm text-slate-800 focus:border-indigo-400 focus:bg-white transition-all"
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
                className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-3.5 rounded-xl font-black text-sm hover:shadow-lg active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Valider & générer reçu
              </button>
            </form>
          </div>

          {/* JOURNAL DES MUTATIONS FINANCIÈRES */}
          <div className={`${mobileSectionClass("payments")} bg-gradient-to-br from-white to-indigo-50 rounded-3xl border-2 border-indigo-200 shadow-lg overflow-hidden`}>
            <div className="p-6 pb-4 flex items-center gap-3 border-b-2 border-indigo-200">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-bold">
                <ReceiptText size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Journal comptable individuel
                </h3>
                <p className="text-[11px] text-slate-600 font-bold">
                  Historique de tous les encaissements
                </p>
              </div>
            </div>
            <div className="divide-y-2 divide-indigo-100 max-h-[420px] overflow-y-auto no-scrollbar">
              {[...payments, ...extraPayments].length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500 font-bold">
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
                      className="flex items-center justify-between gap-3 px-6 py-4 hover:bg-indigo-100/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`h-3 w-3 rounded-full shrink-0 font-bold ${p.extra_fee_types ? "bg-amber-500" : "bg-indigo-600"}`}
                        />
                        <div className="min-w-0">
                          <span
                            className={`text-[11px] font-black ${p.extra_fee_types ? "text-amber-700" : "text-indigo-700"}`}
                          >
                            {p.extra_fee_types
                              ? p.extra_fee_types.name
                              : p.month}
                          </span>
                          <p className="text-[10px] text-slate-600 font-bold">
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
          <div className={`${mobileSectionClass("overview")} grid grid-cols-1 xl:grid-cols-2 gap-5`}>
            <div className="bg-gradient-to-br from-white to-emerald-50 p-6 sm:p-7 rounded-3xl border-2 border-emerald-200 shadow-lg">
              {sectionHeader(
                <BookOpen size={18} />,
                "Emploi du temps",
                "Vue par jour pour la classe de l'élève",
                "emerald",
              )}
              {studentTimetable.length === 0 ? (
                <div className="rounded-2xl bg-emerald-50 p-6 text-center text-slate-600 text-sm font-bold">
                  Aucun créneau disponible pour cette année.
                </div>
              ) : (
                <div className="space-y-4 max-h-[420px] overflow-y-auto no-scrollbar pr-1">
                  {groupedTimetable.map((group) => (
                    <div key={group.day} className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-emerald-700 font-black">
                        <span>{group.day}</span>
                        <span className="bg-emerald-200 px-2.5 py-1 rounded-full">{group.slots.length} cours</span>
                      </div>
                      {group.slots.length === 0 ? (
                        <div className="rounded-2xl bg-emerald-100 p-3.5 text-slate-600 text-xs font-bold">
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
                              className="p-3.5 rounded-2xl border-2 border-emerald-200 bg-white flex items-center gap-3 hover:shadow-md transition-all"
                            >
                              <div className="w-1.5 self-stretch rounded-full bg-emerald-600 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2 text-xs font-black text-slate-900 mb-1">
                                  <span className="truncate">
                                    {slot.subject_name}
                                  </span>
                                  <span className="text-slate-600 font-bold shrink-0">
                                    {slot.start_time.substring(0, 5)}-
                                    {slot.end_time.substring(0, 5)}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-2 font-bold">
                                  <span>
                                    {slot.teacher_name ||
                                      "Professeur non défini"}
                                  </span>
                                  <span className="text-slate-400">•</span>
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

            <div className="bg-gradient-to-br from-white to-purple-50 p-6 sm:p-7 rounded-3xl border-2 border-purple-200 shadow-lg">
              {sectionHeader(
                <Clock size={18} />,
                "Assiduité",
                "Historique récent des absences et retards",
                "purple",
              )}
              {latestAttendance.length === 0 ? (
                <div className="rounded-2xl bg-purple-50 p-6 text-center text-slate-600 text-sm font-bold">
                  Aucun enregistrement d'assiduité pour cet élève.
                </div>
              ) : (
                <div className="space-y-3">
                  {latestAttendance.map((log) => (
                    <div
                      key={
                        log.id ||
                        `${log.date_checked}-${log.student_id}-${log.attendance_status}`
                      }
                      className="rounded-2xl border-2 border-purple-200 bg-white p-4 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-wide text-slate-600 font-black mb-2">
                        <span>
                          {new Date(log.date_checked).toLocaleDateString(
                            "fr-FR",
                          )}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black ${log.attendance_status === "retard" ? "bg-amber-200 text-amber-800" : "bg-rose-200 text-rose-800"}`}
                        >
                          {log.attendance_status === "retard"
                            ? "Retard"
                            : "Absence"}
                        </span>
                      </div>
                      <p className="text-sm font-black text-slate-900">
                        {log.description ||
                          (log.attendance_status === "retard"
                            ? "Retard signalé"
                            : "Absence signalée")}
                      </p>
                      <p className="text-[11px] text-slate-600 font-bold mt-2">
                        Durée estimée : {log.duration_hours ?? 1} heure(s)
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COMMUNICATIONS & ANNONCES */}
          <div className={`${mobileSectionClass("overview")} bg-gradient-to-br from-white to-cyan-50 p-6 sm:p-7 rounded-3xl border-2 border-cyan-200 shadow-lg`}>
            {sectionHeader(
              <Bell size={18} />,
              "Annonces & Infos",
              "Messages ciblés pour les parents et la classe",
            )}

            {announcementsToShow.length === 0 ? (
              <div className="rounded-2xl bg-cyan-50 p-6 text-center text-slate-600 text-sm font-bold">
                Aucune annonce disponible pour le moment.
              </div>
            ) : (
              <div className="space-y-3">
                {announcementsToShow.map((announce) => (
                  <div
                    key={announce.id}
                    className={`rounded-2xl border-2 p-4 transition relative font-bold ${
                      announce.is_pinned
                        ? "border-amber-300 bg-gradient-to-br from-amber-100 to-yellow-50 shadow-md"
                        : "border-cyan-200 bg-white hover:shadow-md"
                    }`}
                  >
                    {/* Tags de Catégories & Badge Audience */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-black text-slate-700">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              announce.type === "event"
                                ? "bg-emerald-600"
                                : announce.type === "holiday"
                                  ? "bg-amber-600"
                                  : "bg-indigo-600"
                            }`}
                          />
                          {announce.type === "event"
                            ? "Événement"
                            : announce.type === "holiday"
                              ? "Congés"
                              : "Annonce"}
                        </span>

                        {announce.is_pinned && (
                          <span className="text-[9px] bg-amber-300 text-amber-900 font-black px-2 py-0.5 rounded uppercase tracking-wider">
                            Important
                          </span>
                        )}
                      </div>

                      {/* Label de l'audience dynamique */}
                      <span className="text-[10px] text-slate-700 font-black uppercase tracking-wide bg-white px-2.5 py-1 rounded-lg border-2 border-slate-300 shadow-sm">
                        🎯 {announce.target_audience === "Tous" ? "Général" : "Votre Classe"}
                      </span>
                    </div>

                    {/* Titre */}
                    <h4 className="font-black text-slate-900 text-sm mb-2 uppercase tracking-wide">
                      {announce.title}
                    </h4>

                    {/* Contenu */}
                    <p className="text-[12px] text-slate-700 mb-3 font-bold whitespace-pre-line leading-relaxed">
                      {announce.content}
                    </p>

                    {/* Pied d'infos de la carte */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-600 font-bold border-t-2 border-slate-200 pt-2">
                      {announce.event_date && (
                        <span className="text-slate-700 font-black">
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
          <div className={`${mobileSectionClass("bulletin")} bg-gradient-to-br from-white to-violet-50 p-6 sm:p-7 rounded-3xl border-2 border-violet-200 shadow-lg`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
              {sectionHeader(
                <GraduationCap size={18} />,
                "Bulletin",
                "Accès direct aux notes et génération PDF",
              )}
              <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full sm:w-auto">
                <select
                  value={bulletinPeriod}
                  onChange={(e) => setBulletinPeriod(e.target.value)}
                  className="w-full sm:w-auto p-3 bg-violet-50 border-2 border-violet-200 rounded-xl text-xs font-black outline-none text-slate-800 focus:border-violet-400 focus:bg-white transition-all"
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
                  className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl px-4 py-3 text-xs font-black hover:shadow-lg active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={15} /> PDF
                </button>
                <button
                  onClick={sendBulletinWhatsApp}
                  disabled={!student?.parent_phone || bulletinLoading}
                  className="bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl px-4 py-3 text-xs font-black hover:shadow-lg active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageSquare size={15} /> WhatsApp
                </button>
              </div>
            </div>

            {bulletinLoading ? (
              <div className="text-center py-10 text-slate-600 font-bold flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-indigo-600" size={22} />
                Chargement du bulletin…
              </div>
            ) : bulletinSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gradient-to-br from-indigo-100 to-blue-100 p-5 rounded-2xl border-2 border-indigo-200 text-center shadow-md">
                    <p className="text-[9px] uppercase tracking-wide text-indigo-700 mb-2 font-black">
                      Moyenne
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-indigo-900">
                      {bulletinSummary.moyenne}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-100 to-violet-100 p-5 rounded-2xl border-2 border-purple-200 text-center shadow-md">
                    <p className="text-[9px] uppercase tracking-wide text-purple-700 mb-2 font-black">
                      Mention
                    </p>
                    <p className="text-sm sm:text-lg font-black text-purple-900 leading-tight">
                      {bulletinSummary.mention}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-pink-100 to-rose-100 p-5 rounded-2xl border-2 border-pink-200 text-center shadow-md">
                    <p className="text-[9px] uppercase tracking-wide text-pink-700 mb-2 font-black">
                      Coefficients
                    </p>
                    <p className="text-lg sm:text-lg font-black text-pink-900">
                      {bulletinSummary.totalCoeffs}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {bulletinSummary.notes.map((note) => (
                    <div
                      key={note.name}
                      className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-white border-2 border-slate-200 text-xs font-bold hover:shadow-md transition-all"
                    >
                      <div className="font-black text-slate-900 min-w-0 truncate flex-1">
                        {note.name}
                      </div>
                      <div className="text-slate-700 font-black bg-slate-100 px-2.5 py-1 rounded-lg">
                        Classe {note.gradeClasse}
                      </div>
                      <div className="text-slate-700 font-black bg-slate-100 px-2.5 py-1 rounded-lg">
                        Compo {note.gradeCompo}
                      </div>
                      <div className="font-black text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-lg">
                        {note.moyenne}/20
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-600 font-bold">
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center">
          <div className="bg-gradient-to-br from-white to-blue-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-7 shadow-2xl overflow-y-auto max-h-[88vh] no-scrollbar animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 border-2 border-indigo-200">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-indigo-300 sm:hidden" />
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Fiche de configuration
                </h2>
                <p className="text-[11px] text-slate-600 font-bold">
                  Informations et échéancier de l'élève
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2.5 bg-indigo-200 rounded-full text-indigo-700 hover:bg-indigo-300 active:scale-90 transition-all font-bold"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-indigo-700 ml-1">
                  Planification échéances
                </label>
                <select
                  className="w-full p-3.5 bg-indigo-50 border-2 border-indigo-200 rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white transition-all"
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-indigo-700 ml-1">
                    Prénom
                  </label>
                  <input
                    type="text"
                    className="w-full p-3.5 bg-indigo-50 border-2 border-indigo-200 rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                    value={editForm.first_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, first_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-indigo-700 ml-1">
                    Nom
                  </label>
                  <input
                    type="text"
                    className="w-full p-3.5 bg-indigo-50 border-2 border-indigo-200 rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                    value={editForm.last_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, last_name: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-indigo-700 ml-1">
                  Contact parent
                </label>
                <input
                  type="text"
                  className="w-full p-3.5 bg-indigo-50 border-2 border-indigo-200 rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  value={editForm.parent_phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, parent_phone: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-indigo-700 ml-1">
                  Adresse habitation
                </label>
                <input
                  type="text"
                  className="w-full p-3.5 bg-indigo-50 border-2 border-indigo-200 rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  value={editForm.address}
                  onChange={(e) =>
                    setEditForm({ ...editForm, address: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-indigo-700 ml-1">
                  Montant scolarité annuelle requis
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full p-3.5 bg-indigo-50 border-2 border-indigo-200 rounded-xl font-black text-sm text-indigo-700 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  value={formatInputDisplay(String(editForm.annual_fee ?? 0))}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\s/g, "");
                    setEditForm({
                      ...editForm,
                      annual_fee: clean ? parseInt(clean, 10) : 0,
                    });
                  }}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-3.5 rounded-xl font-black text-sm hover:shadow-lg active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Save size={16} /> Enregistrer les modifications
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
