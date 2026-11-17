"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { offlineFetch, offlineWrite } from "@/utils/offlineApi";
import { useCacheRefresh } from "@/hooks/useCacheRefresh";
import { useYear } from "@/context/YearContext";
import {
  ArrowLeft,
  Loader2,
  Phone,
  PhoneCall,
  Contact2,
  MapPin,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  Settings2,
  Download,
  MessageSquare,
  AlertCircle,
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

const SCHOOL_MONTHS = [
  "Octobre",
  "Novembre",
  "Décembre",
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
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

  // Navigation par modules
  const [activeTab, setActiveTab] = useState<"finance" | "pedagogy" | "bulletin" | "discipline">("finance");

  // Formulaires d'encaissement
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState("");
  const [paymentMode, setPaymentMode] = useState<"tranche" | "mensualite">("tranche");

  // Modification & Suppression d'un paiement existant
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState<string | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);

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

  // Gestion du contact parent
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [manualPhoneInput, setManualPhoneInput] = useState("");
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
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
        console.error("Erreur de chargement:", error);
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
      `Reçu de paiement scolaire\n\n` +
        `Élève : ${student.first_name} ${student.last_name}\n` +
        `Rubrique : ${type}\n` +
        `Montant : ${new Intl.NumberFormat("fr-FR").format(pAmount)} FCFA\n` +
        `Motif : ${pMonth}\n` +
        `Date : ${dateStr}\n\n` +
        `Paiement bien validé.`,
    );
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, "_blank");
  };

  const saveParentPhone = async (phoneNumber: string) => {
    const cleanPhone = phoneNumber.trim();
    if (!cleanPhone) return;
    setIsSavingPhone(true);

    const backupPhone = student?.parent_phone;
    setStudent((prev: any) => (prev ? { ...prev, parent_phone: cleanPhone } : null));

    const { error } = await offlineWrite({
      table: "students",
      action: "UPDATE",
      payload: { parent_phone: cleanPhone },
      options: { keyColumn: "id", keyValue: Array.isArray(id) ? id[0] : id },
      cacheKey: `student:${id}`,
      optimisticUpdate: () => {},
    });

    setIsSavingPhone(false);
    if (!error) {
      setIsPhoneModalOpen(false);
      setManualPhoneInput("");
      fetchData(true);
    } else {
      setStudent((prev: any) => (prev ? { ...prev, parent_phone: backupPhone } : null));
      alert("Erreur lors de l'enregistrement du numéro.");
    }
  };

  const pickPhoneFromContacts = async () => {
    const nav = typeof navigator !== "undefined" ? (navigator as any) : null;

    if (typeof window !== "undefined" && !window.isSecureContext) {
      alert(
        "Google Chrome exige une connexion HTTPS sécurisée (ou localhost) pour ouvrir le répertoire de contacts.\n\nSi vous êtes sur votre réseau local (ex: http://192.168.x.x), Chrome désactive l'accès au répertoire par sécurité. Saisissez le numéro dans le champ manuel ci-dessous."
      );
      return;
    }

    if (nav && "contacts" in nav && typeof nav.contacts?.select === "function") {
      try {
        const availableProps = typeof nav.contacts.getProperties === "function"
          ? await nav.contacts.getProperties()
          : ["tel"];

        const propsToRequest = availableProps.includes("tel") ? ["tel"] : availableProps;
        const contacts = await nav.contacts.select(propsToRequest, { multiple: false });

        if (contacts && contacts.length > 0 && contacts[0].tel && contacts[0].tel.length > 0) {
          let selectedNumber = contacts[0].tel[0];
          selectedNumber = selectedNumber.replace(/[\u202F\u00A0]/g, " ").trim();
          await saveParentPhone(selectedNumber);
        }
      } catch (err: any) {
        if (err?.name === "AbortError") {
          console.log("Sélection de contact fermée par l'utilisateur.");
        } else {
          console.error("Erreur Contact Picker :", err);
          alert(`Erreur d'accès au répertoire : ${err?.message || "Action interrompue"}`);
        }
      }
    } else {
      alert(
        "La fonctionnalité de sélection directe n'est pas accessible sur ce navigateur.\n\nVeuillez renseigner le numéro dans le champ manuel ci-dessous."
      );
    }
  };

  const bulletinSummary = useMemo(() => {
    if (!student || bulletinSubjects.length === 0) return null;

    let totalPoints = 0;
    let totalCoeffs = 0;
    const notes = bulletinSubjects.map((subject) => {
      const grade =
        bulletinGrades.find((g) => g.subject_name === subject.subject_name) || {};
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
          ? "Général"
          : announce.target_audience === "Classes"
            ? `Classe ${announce.classes?.name || ""}`
            : "Interne",
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
    const defaultMessage = `Bulletin scolaire de ${student.first_name} ${student.last_name} (${bulletinPeriod}).`;
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
        console.error("Échec du partage :", shareError);
      }
    }

    window.open(
      `https://wa.me/${cleanNumber}?text=${encodedMessage}`,
      "_blank",
    );
  };

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

  // Fonction centrale d'enregistrement d'un paiement scolaire (Tranche ou Mois)
  const recordTuitionPayment = async (designation: string, customAmount?: number) => {
    if (isReadOnly || !designation) return;

    const annualFeeVal = Number(student?.scolarite_totale || student?.annual_fee || 0);
    const numTranchesVal = student?.payment_plan_tranches || 1;
    const defaultInstallment = numTranchesVal > 0 ? Math.round(annualFeeVal / numTranchesVal) : 0;

    const rawNumeric = customAmount !== undefined
      ? customAmount
      : parseFloat(amount.replace(/\s/g, ""));

    const payAmount = !isNaN(rawNumeric) && rawNumeric > 0 ? rawNumeric : defaultInstallment;

    if (!payAmount || payAmount <= 0) {
      alert("Veuillez saisir un montant valide avant de sélectionner le paiement.");
      return;
    }

    const currentDesignation = designation;
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
        month: currentDesignation,
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
        month: currentDesignation,
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

      sendReceiptWhatsApp(payAmount, currentDesignation, "SCOLAIRE");
      fetchData(true);
    } else {
      setStudent(backupStudent);
      setPayments(backupPayments);
    }
  };

  const handleBasePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    await recordTuitionPayment(month);
  };

  // Modification d'une somme déjà enregistrée avec historique de l'ancien et du nouveau montant
  const handleUpdatePaymentRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment || isReadOnly) return;

    const newNumericAmount = parseFloat(editPaymentAmount.replace(/\s/g, ""));
    if (isNaN(newNumericAmount) || newNumericAmount < 0) return;

    const isExtra = Boolean(editingPayment.extra_fee_types || editingPayment.fee_type_id);
    const oldAmount = Number(isExtra ? editingPayment.amount_paid : editingPayment.amount);

    if (newNumericAmount === oldAmount) {
      setEditingPayment(null);
      return;
    }

    setIsUpdatingPayment(true);
    const fmtNum = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

    if (!isExtra) {
      const diff = newNumericAmount - oldAmount;
      const updatedTotalPaid = Math.max(0, Number(student?.scolarite_payee || 0) + diff);

      const baseLabel = String(editingPayment.month || "Paiement").split(" (Modifié")[0];
      const updatedMonthLabel = `${baseLabel} (Modifié : ${fmtNum(oldAmount)} F → ${fmtNum(newNumericAmount)} F)`;

      const backupStudent = { ...student };
      const backupPayments = [...payments];

      setStudent((prev: any) => (prev ? { ...prev, scolarite_payee: updatedTotalPaid } : null));
      setPayments((prev) =>
        prev.map((p) =>
          p.id === editingPayment.id
            ? { ...p, amount: newNumericAmount, month: updatedMonthLabel }
            : p
        )
      );

      const { error: payUpdateErr } = await offlineWrite({
        table: "payments",
        action: "UPDATE",
        payload: {
          amount: newNumericAmount,
          month: updatedMonthLabel,
        },
        options: { keyColumn: "id", keyValue: editingPayment.id },
        cacheKey: `payments:${id}`,
        optimisticUpdate: () => {},
      });

      if (!payUpdateErr) {
        await offlineWrite({
          table: "students",
          action: "UPDATE",
          payload: { scolarite_payee: updatedTotalPaid },
          options: { keyColumn: "id", keyValue: Array.isArray(id) ? id[0] : id },
          cacheKey: `student:${id}`,
          optimisticUpdate: () => {},
        });
        setEditingPayment(null);
        fetchData(true);
      } else {
        setStudent(backupStudent);
        setPayments(backupPayments);
        alert("Erreur lors de la modification du paiement.");
      }
    } else {
      const backupExtra = [...extraPayments];
      setExtraPayments((prev) =>
        prev.map((p) =>
          p.id === editingPayment.id
            ? {
                ...p,
                amount_paid: newNumericAmount,
                extra_fee_types: {
                  name: `${String(p.extra_fee_types?.name || "Frais").split(" (Modifié")[0]} (Modifié : ${fmtNum(oldAmount)} F → ${fmtNum(newNumericAmount)} F)`,
                },
              }
            : p
        )
      );

      const { error: exUpdateErr } = await offlineWrite({
        table: "student_extra_payments",
        action: "UPDATE",
        payload: { amount_paid: newNumericAmount },
        options: { keyColumn: "id", keyValue: editingPayment.id },
        cacheKey: `extra_payments:${id}`,
        optimisticUpdate: () => {},
      });

      if (!exUpdateErr) {
        setEditingPayment(null);
        fetchData(true);
      } else {
        setExtraPayments(backupExtra);
        alert("Erreur lors de la modification du reçu annexe.");
      }
    }

    setIsUpdatingPayment(false);
  };

  // Suppression d'un paiement tout en conservant sa trace en rouge dans l'historique
  const handleSoftDeletePayment = async (paymentRecord: any) => {
    if (isReadOnly || !paymentRecord) return;
    setIsDeletingPayment(true);

    const isExtra = Boolean(paymentRecord.extra_fee_types || paymentRecord.fee_type_id);
    const oldAmount = Number(isExtra ? paymentRecord.amount_paid : paymentRecord.amount);
    const fmtNum = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

    if (!isExtra) {
      const updatedTotalPaid = Math.max(0, Number(student?.scolarite_payee || 0) - oldAmount);
      const baseLabel = String(paymentRecord.month || "Paiement").split(" (Modifié")[0].split(" [SUPPRIMÉ")[0];
      const deletedLabel = `${baseLabel} [SUPPRIMÉ - Ancien montant : ${fmtNum(oldAmount)} FCFA]`;

      const backupStudent = { ...student };
      const backupPayments = [...payments];

      setStudent((prev: any) => (prev ? { ...prev, scolarite_payee: updatedTotalPaid } : null));
      setPayments((prev) =>
        prev.map((p) =>
          p.id === paymentRecord.id
            ? { ...p, amount: 0, month: deletedLabel }
            : p
        )
      );

      const { error } = await offlineWrite({
        table: "payments",
        action: "UPDATE",
        payload: {
          amount: 0,
          month: deletedLabel,
        },
        options: { keyColumn: "id", keyValue: paymentRecord.id },
        cacheKey: `payments:${id}`,
        optimisticUpdate: () => {},
      });

      if (!error) {
        await offlineWrite({
          table: "students",
          action: "UPDATE",
          payload: { scolarite_payee: updatedTotalPaid },
          options: { keyColumn: "id", keyValue: Array.isArray(id) ? id[0] : id },
          cacheKey: `student:${id}`,
          optimisticUpdate: () => {},
        });
        setConfirmDeletePaymentId(null);
        fetchData(true);
      } else {
        setStudent(backupStudent);
        setPayments(backupPayments);
        alert("Erreur lors de l'annulation du paiement.");
      }
    } else {
      const backupExtra = [...extraPayments];
      const baseExtraName = String(paymentRecord.extra_fee_types?.name || "Frais").split(" [SUPPRIMÉ")[0];
      const deletedExtraLabel = `${baseExtraName} [SUPPRIMÉ - Ancien montant : ${fmtNum(oldAmount)} FCFA]`;

      setExtraPayments((prev) =>
        prev.map((p) =>
          p.id === paymentRecord.id
            ? {
                ...p,
                amount_paid: 0,
                extra_fee_types: { name: deletedExtraLabel },
              }
            : p
        )
      );

      const { error } = await offlineWrite({
        table: "student_extra_payments",
        action: "UPDATE",
        payload: { amount_paid: 0 },
        options: { keyColumn: "id", keyValue: paymentRecord.id },
        cacheKey: `extra_payments:${id}`,
        optimisticUpdate: () => {},
      });

      if (!error) {
        setConfirmDeletePaymentId(null);
        fetchData(true);
      } else {
        setExtraPayments(backupExtra);
        alert("Erreur lors de l'annulation du reçu annexe.");
      }
    }

    setIsDeletingPayment(false);
  };

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

  // Séparation stricte entre les paiements actifs par Tranche et les paiements actifs par Mois
  const activePayments = useMemo(() => {
    return payments.filter(
      (p) => !String(p.month || "").includes("[SUPPRIMÉ") && Number(p.amount || 0) > 0
    );
  }, [payments]);

  const paidMonthsSet = useMemo(() => {
    const set = new Set<string>();
    activePayments.forEach((p) => {
      const cleanLabel = String(p.month || "").split(" (Modifié")[0].trim();
      if (SCHOOL_MONTHS.includes(cleanLabel)) {
        set.add(cleanLabel);
      }
    });
    return set;
  }, [activePayments]);

  const paidTranchesSet = useMemo(() => {
    const set = new Set<string>();
    activePayments.forEach((p) => {
      const cleanLabel = String(p.month || "").split(" (Modifié")[0].trim();
      if (!SCHOOL_MONTHS.includes(cleanLabel)) {
        set.add(cleanLabel);
      }
    });
    return set;
  }, [activePayments]);

  const totalPaidInTranchesOnly = useMemo(() => {
    return activePayments
      .filter((p) => !SCHOOL_MONTHS.includes(String(p.month || "").split(" (Modifié")[0].trim()))
      .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  }, [activePayments]);

  if (loading && !student)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white text-slate-400 font-sans">
        <Loader2 className="animate-spin text-blue-600" size={26} />
        <span className="text-base font-bold text-slate-700">Ouverture de la fiche élève...</span>
      </div>
    );

  if (!student)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center font-sans">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
          <AlertCircle size={22} />
        </div>
        <p className="text-lg font-bold text-slate-900">Élève non trouvé</p>
        <Link
          href="/students"
          className="mt-3 text-base font-bold text-blue-600 hover:text-blue-700"
        >
          Retourner au registre
        </Link>
      </div>
    );

  const annualFee = Number(student.scolarite_totale || student.annual_fee || 0);
  const totalPaid = Number(student.scolarite_payee || 0);

  const currentYearCoverage = Math.min(totalPaid, annualFee);
  const remaining = Math.max(0, annualFee - totalPaid);
  const isSolded = remaining === 0;
  const paidPct =
    annualFee > 0
      ? Math.min(100, Math.round((currentYearCoverage / annualFee) * 100))
      : 0;

  const numTranches = student.payment_plan_tranches || 1;
  const amountPerTranche = annualFee / numTranches;
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  const dynamicTrancheOptions = Array.from({ length: numTranches }, (_, idx) =>
    idx === 0 ? "1ère Tranche" : `${idx + 1}ème Tranche`
  );

  // Détermine si l'échéancier doit afficher les mois ou les tranches
  const isMonthlySchedule = numTranches === 9 || paidMonthsSet.size > 0;

  const hasParentPhone =
    student.parent_phone &&
    String(student.parent_phone).trim() !== "" &&
    String(student.parent_phone).trim() !== "-";

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased pb-24">
      
      {/* 1. TOP BAR */}
      <nav className="border-b border-slate-200/80 bg-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/students"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-blue-600 transition"
          >
            <ArrowLeft size={16} />
            <span>Élèves</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-md">
              {selectedYear?.label || "Année courante"}
            </span>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 hover:border-slate-400 text-xs font-bold text-slate-800 hover:text-slate-950 transition"
            >
              <Settings2 size={14} className="text-slate-600" />
              <span>Modifier</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-8">

        {/* 2. PROFIL ÉLÈVE */}
        <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-slate-200">
          
          <div className="flex items-start sm:items-center gap-5 sm:gap-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-3xl sm:text-4xl shrink-0 shadow-md">
              {student.first_name?.[0]}{student.last_name?.[0]}
            </div>

            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950 capitalize">
                  {student.first_name} {student.last_name}
                </h1>
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {student.classes?.name || "Classe non définie"}
                </span>
              </div>

              {/* Ligne Coordonnées avec Bouton d'Action Répertoire / Manuel */}
              <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm sm:text-base text-slate-700 font-bold">
                {hasParentPhone ? (
                  <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                    <Phone size={15} className="text-blue-600 shrink-0" />
                    <span className="text-slate-900">{student.parent_phone}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setManualPhoneInput(student.parent_phone);
                        setIsPhoneModalOpen(true);
                      }}
                      className="ml-1 text-slate-400 hover:text-blue-600 transition p-0.5"
                      title="Modifier le contact parent"
                    >
                      <Edit3 size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setManualPhoneInput("");
                      setIsPhoneModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl text-xs font-extrabold transition shadow-xs active:scale-95"
                  >
                    <PhoneCall size={14} className="text-blue-600" />
                    <span>+ Ajouter contact parent</span>
                  </button>
                )}

                <span className="inline-flex items-center gap-2 text-slate-600">
                  <MapPin size={16} className="text-blue-600 shrink-0" />
                  <span>{student.address || "Adresse non renseignée"}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 sm:gap-8 self-start lg:self-auto pt-2 lg:pt-0">
            <div>
              <span className="text-xs sm:text-sm text-slate-500 block font-bold">Scolarité totale</span>
              <span className="text-2xl sm:text-3xl font-black text-slate-950 mt-0.5 block">
                {fmt(annualFee)} <span className="text-xs sm:text-sm font-bold text-slate-500">FCFA</span>
              </span>
            </div>

            <div className="h-10 w-px bg-slate-300" />

            <div>
              <span className="text-xs sm:text-sm text-slate-500 block font-bold">
                {isSolded ? "Statut" : "Reste à payer"}
              </span>
              <span className={`text-2xl sm:text-3xl font-black mt-0.5 block ${isSolded ? "text-emerald-700" : "text-blue-600"}`}>
                {isSolded ? "Soldé ✓" : `${fmt(remaining)} F`}
              </span>
            </div>

            <div className="h-10 w-px bg-slate-300" />

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm text-slate-500 font-bold">Moyenne</span>
                <button
                  onClick={() => setShowAvgForm(!showAvgForm)}
                  className="text-blue-600 hover:text-blue-800 p-0.5"
                  title="Modifier la note"
                >
                  <Edit3 size={13} />
                </button>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-950 mt-0.5 block">
                {student.last_exam_avg !== null && student.last_exam_avg !== undefined
                  ? Number(student.last_exam_avg).toFixed(2)
                  : "—"}
                <span className="text-xs sm:text-sm text-slate-400 font-bold"> /20</span>
              </span>
            </div>
          </div>
        </section>

        {showAvgForm && (
          <form
            onSubmit={handleUpdateAvg}
            className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 max-w-sm"
          >
            <input
              type="number"
              step="0.01"
              min="0"
              max="20"
              placeholder="Ex: 14.5"
              className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold outline-none focus:border-blue-600"
              value={newAvg}
              onChange={(e) => setNewAvg(e.target.value)}
              required
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setShowAvgForm(false)}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </form>
        )}

        {/* 3. SEGMENTED CONTROL */}
        <div className="flex p-1 bg-slate-100 rounded-xl w-full sm:w-max gap-1">
          {[
            { key: "finance", label: "Finances & Tranches" },
            { key: "pedagogy", label: "Horaires & Présence" },
            { key: "bulletin", label: "Relevé de notes" },
            { key: "discipline", label: "Discipline", count: incidents.length },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition ${
                  isActive
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 font-extrabold">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 4. MODULES DE CONTENU */}

        {/* MODULE 1 : FINANCES */}
        {activeTab === "finance" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Formulaires d'encaissement (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              
              <div className="border border-slate-200/80 rounded-2xl p-5 bg-white space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Encaisser la scolarité</h3>
                  <p className="text-xs text-slate-500 font-medium">Choisissez de régler par tranche ou par mensualité</p>
                </div>

                {/* Sélecteur entre Payer une Tranche ou la Mensualité */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode("tranche");
                      setMonth("");
                    }}
                    className={`py-2 rounded-lg text-xs font-bold transition ${
                      paymentMode === "tranche"
                        ? "bg-white text-blue-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Par Tranche ({numTranches})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode("mensualite");
                      setMonth("");
                    }}
                    className={`py-2 rounded-lg text-xs font-bold transition ${
                      paymentMode === "mensualite"
                        ? "bg-white text-blue-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Mensualité (Mois)
                  </button>
                </div>

                <form onSubmit={handleBasePayment} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Montant reçu (FCFA)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={`Ex: ${fmt(Math.round(amountPerTranche))}`}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-600 transition"
                      value={formatInputDisplay(amount)}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={isReadOnly}
                      required={paymentMode === "tranche"}
                    />
                  </div>

                  {paymentMode === "tranche" ? (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Choisir la tranche de l'élève
                        </label>
                        <select
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-600 transition cursor-pointer"
                          value={month}
                          onChange={(e) => setMonth(e.target.value)}
                          disabled={isReadOnly}
                          required
                        >
                          <option value="">Sélectionner la tranche...</option>
                          {dynamicTrancheOptions.map((trLabel) => (
                            <option key={trLabel} value={trLabel}>
                              {trLabel} ({fmt(Math.round(amountPerTranche))} F)
                            </option>
                          ))}
                          <option value="Solde global">Solde global</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={isReadOnly}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-40"
                      >
                        Valider l'encaissement
                      </button>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700">
                        Cliquez sur un mois pour l'enregistrer automatiquement :
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {SCHOOL_MONTHS.map((mName) => {
                          const isAlreadyPaid = paidMonthsSet.has(mName);
                          return (
                            <button
                              key={mName}
                              type="button"
                              disabled={isReadOnly}
                              onClick={() => recordTuitionPayment(mName)}
                              className={`py-2 px-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1 ${
                                isAlreadyPaid
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : "border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-800"
                              }`}
                            >
                              {isAlreadyPaid && <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />}
                              <span className="truncate">{mName}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Astuce : Si aucun montant n'est saisi ci-dessus, le tarif par échéance ({fmt(Math.round(amountPerTranche))} F) est appliqué automatiquement.
                      </p>
                    </div>
                  )}
                </form>
              </div>

              {/* Frais annexes */}
              <div className="border border-slate-200/80 rounded-2xl p-5 bg-white space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Frais divers & annexes</h3>
                  <p className="text-xs text-slate-500 font-medium">Tenues, cantine, activités périscolaires</p>
                </div>

                <form onSubmit={handleExtraPayment} className="space-y-3">
                  <select
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-600 transition"
                    value={selectedExtraType}
                    onChange={(e) => setSelectedExtraType(e.target.value)}
                    disabled={isReadOnly}
                    required
                  >
                    <option value="">Rubrique...</option>
                    {extraFeeTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({fmt(Number(t.default_amount))} F)
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Montant perçu..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition"
                    value={formatInputDisplay(extraAmount)}
                    onChange={(e) => setExtraAmount(e.target.value)}
                    disabled={isReadOnly}
                    required
                  />

                  <button
                    type="submit"
                    disabled={isReadOnly}
                    className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition disabled:opacity-40"
                  >
                    Enregistrer le reçu annexe
                  </button>
                </form>
              </div>

            </div>

            {/* Suivi des Tranches & Journal (7 cols) */}
            <div className="lg:col-span-7 space-y-6">

              {/* Barre de progression & Échéancier sans conflit entre Tranches et Mois */}
              <div className="border border-slate-200/80 rounded-2xl p-5 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Échéancier de scolarité ({isMonthlySchedule ? "Suivi Mensuel" : `${numTranches} ${numTranches > 1 ? "tranches" : "tranche"}`})
                    </h3>
                    <span className="text-xs text-slate-600 font-bold">
                      {fmt(Math.round(amountPerTranche))} FCFA par versement
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                    {paidPct}% couvert
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${isSolded ? "bg-emerald-600" : "bg-blue-600"}`}
                    style={{ width: `${paidPct}%` }}
                  />
                </div>

                {isMonthlySchedule ? (
                  /* Affichage dédié aux mois sans interférer avec les tranches */
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-2">
                    {SCHOOL_MONTHS.slice(0, 9).map((mName) => {
                      const isMonthPaid = paidMonthsSet.has(mName) || isSolded;
                      return (
                        <div
                          key={mName}
                          className={`p-3 rounded-xl border text-xs transition ${
                            isMonthPaid
                              ? "border-emerald-200 bg-emerald-50/30 text-emerald-950 font-bold"
                              : "border-slate-200 bg-slate-50/50 text-slate-600 font-bold"
                          }`}
                        >
                          <span className="text-[11px] block font-extrabold truncate">{mName}</span>
                          <div className="flex items-center gap-1.5 mt-1 font-bold">
                            {isMonthPaid ? (
                              <>
                                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                <span>Réglé</span>
                              </>
                            ) : (
                              <>
                                <span className="w-2 h-2 rounded-full border border-slate-400 shrink-0" />
                                <span>En attente</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Affichage strict par Tranche : uniquement validé par les paiements de type Tranche */
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    {Array.from({ length: numTranches }).map((_, i) => {
                      const trancheLabel = i === 0 ? "1ère Tranche" : `${i + 1}ème Tranche`;
                      const trancheTarget = (i + 1) * amountPerTranche;
                      const isTranchePaid =
                        paidTranchesSet.has(trancheLabel) ||
                        paidTranchesSet.has("Solde global") ||
                        totalPaidInTranchesOnly >= trancheTarget;

                      return (
                        <div
                          key={i}
                          className={`p-3 rounded-xl border text-xs transition ${
                            isTranchePaid
                              ? "border-emerald-200 bg-emerald-50/30 text-emerald-950 font-bold"
                              : "border-slate-200 bg-slate-50/50 text-slate-600 font-bold"
                          }`}
                        >
                          <span className="text-[11px] block font-extrabold truncate">{trancheLabel}</span>
                          <div className="flex items-center gap-1.5 mt-1 font-bold">
                            {isTranchePaid ? (
                              <>
                                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                <span>Réglée</span>
                              </>
                            ) : (
                              <>
                                <span className="w-2 h-2 rounded-full border border-slate-400 shrink-0" />
                                <span>En attente</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Historique des paiements avec modification & suppression traçable en rouge */}
              <div className="border border-slate-200/80 rounded-2xl bg-white overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Historique des transactions</h3>
                  <span className="text-xs text-slate-500 font-bold">
                    {payments.length + extraPayments.length} écritures
                  </span>
                </div>

                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {[...payments, ...extraPayments].length === 0 ? (
                    <p className="p-6 text-center text-xs text-slate-400 font-medium">
                      Aucun versement n'a encore été enregistré.
                    </p>
                  ) : (
                    [...payments, ...extraPayments]
                      .sort(
                        (a, b) =>
                          new Date(b.payment_date || b.created_at).getTime() -
                          new Date(a.payment_date || a.created_at).getTime(),
                      )
                      .map((p, idx) => {
                        const currentAmt = p.amount ?? p.amount_paid ?? 0;
                        const labelDisplay = p.extra_fee_types ? p.extra_fee_types.name : p.month;
                        const isDeleted = String(labelDisplay || "").includes("[SUPPRIMÉ");
                        const isConfirmingDel = confirmDeletePaymentId === String(p.id);

                        return (
                          <div
                            key={p.id || idx}
                            className={`px-4 py-3 flex items-center justify-between gap-3 text-xs transition ${
                              isDeleted
                                ? "bg-rose-50/40 text-rose-700"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isDeleted
                                    ? "bg-rose-600"
                                    : p.extra_fee_types
                                      ? "bg-amber-500"
                                      : "bg-blue-600"
                                }`}
                              />
                              <div className="min-w-0">
                                <span
                                  className={`font-bold block truncate ${
                                    isDeleted ? "text-rose-700 line-through" : "text-slate-900"
                                  }`}
                                >
                                  {labelDisplay}
                                </span>
                                <span
                                  className={`block text-[11px] font-medium mt-0.5 ${
                                    isDeleted ? "text-rose-500" : "text-slate-500"
                                  }`}
                                >
                                  {new Date(p.payment_date || p.created_at).toLocaleDateString("fr-FR")}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`font-extrabold ${
                                  isDeleted ? "text-rose-600" : "text-slate-900"
                                }`}
                              >
                                {isDeleted ? "Supprimé (0 F)" : `${fmt(Number(currentAmt))} FCFA`}
                              </span>

                              {!isReadOnly && !isDeleted && (
                                <>
                                  {isConfirmingDel ? (
                                    <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                                      <button
                                        type="button"
                                        disabled={isDeletingPayment}
                                        onClick={() => handleSoftDeletePayment(p)}
                                        className="text-[10px] font-black text-rose-700 hover:underline px-1"
                                      >
                                        {isDeletingPayment ? "..." : "Confirmer"}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isDeletingPayment}
                                        onClick={() => setConfirmDeletePaymentId(null)}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-1"
                                      >
                                        Non
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingPayment(p);
                                          setEditPaymentAmount(String(currentAmt));
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                        title="Modifier cette somme"
                                      >
                                        <Edit3 size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeletePaymentId(String(p.id))}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                        title="Supprimer ce paiement (avec trace en rouge)"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* MODULE 2 : PÉDAGOGIE */}
        {activeTab === "pedagogy" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Emploi du temps (7 cols) */}
            <div className="lg:col-span-7 border border-slate-200/80 rounded-2xl p-5 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Planning des cours</h3>
                <span className="text-xs font-bold text-slate-700">{student.classes?.name || "Classe"}</span>
              </div>

              {studentTimetable.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8 font-medium">
                  Aucun créneau configuré pour cette classe.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {groupedTimetable.map((group) => (
                    <div key={group.day} className="p-3 bg-slate-50 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 pb-1 border-b border-slate-200/60">
                        <span>{group.day}</span>
                        <span className="text-[11px] text-slate-500 font-bold">{group.slots.length} cours</span>
                      </div>

                      {group.slots.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">Pas de cours.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {group.slots.map((slot) => (
                            <div key={slot.id ?? `${group.day}-${slot.start_time}`} className="p-2 bg-white rounded-lg border border-slate-200/60 text-xs">
                              <span className="font-bold text-slate-900 block truncate">{slot.subject_name}</span>
                              <div className="flex justify-between text-[11px] text-slate-600 font-medium mt-1">
                                <span>{slot.start_time?.substring(0, 5)} - {slot.end_time?.substring(0, 5)}</span>
                                <span>Salle {slot.classroom_number || "—"}</span>
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

            {/* Assiduité & Annonces (5 cols) */}
            <div className="lg:col-span-5 space-y-6">

              <div className="border border-slate-200/80 rounded-2xl p-5 bg-white space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                  Assiduité récente
                </h3>

                {latestAttendance.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6 font-medium">
                    Aucune absence ou retard répertorié.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {latestAttendance.map((log) => (
                      <div key={log.id || `${log.date_checked}-${log.student_id}`} className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-800 block">
                            {log.description || (log.attendance_status === "retard" ? "Retard" : "Absence")}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {new Date(log.date_checked).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          log.attendance_status === "retard"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-700"
                        }`}>
                          {log.attendance_status === "retard" ? "Retard" : "Absence"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-slate-200/80 rounded-2xl p-5 bg-white space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                  Circulaires de l'école
                </h3>

                {announcementsToShow.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6 font-medium">
                    Aucun avis en cours.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {announcementsToShow.map((ann) => (
                      <div key={ann.id} className="p-3 bg-slate-50 rounded-xl space-y-1">
                        <span className="text-[10px] font-extrabold text-blue-600 block uppercase">
                          {ann.type || "Info"}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">{ann.title}</h4>
                        <p className="text-xs text-slate-700 font-medium line-clamp-2">{ann.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* MODULE 3 : RELEVÉ DE NOTES */}
        {activeTab === "bulletin" && (
          <div className="border border-slate-200/80 rounded-2xl p-6 bg-white space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Relevé d'évaluations</h3>
                <p className="text-xs text-slate-500 font-medium">Moyennes et délibérations trimestrielles</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={bulletinPeriod}
                  onChange={(e) => setBulletinPeriod(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-600"
                >
                  {["1er Trimestre", "2ème Trimestre", "3ème Trimestre"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <button
                  onClick={downloadBulletinPDF}
                  disabled={!bulletinSummary || bulletinLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-40"
                >
                  <Download size={13} />
                  <span>PDF</span>
                </button>

                <button
                  onClick={sendBulletinWhatsApp}
                  disabled={!student?.parent_phone || bulletinLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold transition disabled:opacity-40"
                >
                  <MessageSquare size={13} />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>

            {bulletinLoading ? (
              <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="animate-spin text-blue-600" size={16} />
                Calcul des résultats en cours...
              </div>
            ) : bulletinSummary ? (
              <div className="space-y-6">
                
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl text-center">
                  <div>
                    <span className="text-[11px] text-slate-500 block font-bold">Moyenne</span>
                    <span className="text-2xl font-black text-blue-600 mt-0.5 block">
                      {bulletinSummary.moyenne}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block font-bold">Mention</span>
                    <span className="text-sm font-black text-slate-800 mt-2 block">
                      {bulletinSummary.mention}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block font-bold">Total coeff.</span>
                    <span className="text-2xl font-black text-slate-800 mt-0.5 block">
                      {bulletinSummary.totalCoeffs}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500 font-bold">
                        <th className="py-2.5">Matière</th>
                        <th className="py-2.5 text-center">Coeff</th>
                        <th className="py-2.5 text-center">Classe</th>
                        <th className="py-2.5 text-center">Compo</th>
                        <th className="py-2.5 text-right">Moyenne</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bulletinSummary.notes.map((note) => (
                        <tr key={note.name} className="hover:bg-slate-50/50">
                          <td className="py-3 font-bold text-slate-900">{note.name}</td>
                          <td className="py-3 text-center text-slate-600 font-bold">{note.coeff}</td>
                          <td className="py-3 text-center text-slate-700 font-bold">{note.gradeClasse}</td>
                          <td className="py-3 text-center text-slate-700 font-bold">{note.gradeCompo}</td>
                          <td className="py-3 text-right font-black text-blue-600">
                            {note.moyenne}/20
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-8 font-medium">
                Aucun relevé disponible pour cette période.
              </p>
            )}
          </div>
        )}

        {/* MODULE 4 : DISCIPLINE */}
        {activeTab === "discipline" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            <div className="lg:col-span-5 border border-slate-200/80 rounded-2xl p-5 bg-white space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Signaler un incident</h3>
                <p className="text-xs text-slate-500 font-medium">Ajouter une note au dossier de vie scolaire</p>
              </div>

              <form onSubmit={handleAddIncident} className="space-y-3.5">
                <textarea
                  placeholder="Motif de l'avertissement ou observation..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-600 resize-none h-24"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isReadOnly}
                  required
                />

                <div className="grid grid-cols-3 gap-2">
                  {["Bas", "Moyen", "Grave"].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSeverity(lvl)}
                      disabled={isReadOnly}
                      className={`py-2 rounded-xl text-xs font-bold transition ${
                        severity === lvl
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isReadOnly}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition disabled:opacity-40"
                >
                  Enregistrer l'incident
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 border border-slate-200/80 rounded-2xl bg-white overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Dossier disciplinaire</h3>
                <span className="text-xs text-slate-500 font-bold">{incidents.length} rapports</span>
              </div>

              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {incidents.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400 font-medium">
                    Aucun incident enregistré.
                  </p>
                ) : (
                  incidents.map((inc) => (
                    <div key={inc.id} className="p-4 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{inc.reason}</p>
                        <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                          {new Date(inc.incident_date || inc.created_at).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        inc.severity === "Grave"
                          ? "bg-rose-50 text-rose-700"
                          : inc.severity === "Moyen"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                      }`}>
                        {inc.severity || "Bas"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* 5. MODAL DE MODIFICATION D'UNE SOMME ENREGISTRÉE */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Corriger le montant</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {editingPayment.extra_fee_types
                    ? editingPayment.extra_fee_types.name
                    : editingPayment.month}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPayment(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdatePaymentRecord} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-500">Montant initial :</span>
                <span className="font-black text-slate-900">
                  {fmt(Number(editingPayment.amount ?? editingPayment.amount_paid ?? 0))} FCFA
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Nouveau montant corrigé (FCFA)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-blue-600 outline-none focus:bg-white focus:border-blue-600"
                  value={formatInputDisplay(editPaymentAmount)}
                  onChange={(e) => setEditPaymentAmount(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPayment}
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-40"
                >
                  {isUpdatingPayment && <Loader2 size={13} className="animate-spin" />}
                  <span>Enregistrer la correction</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL CONFIGURATION PROFIL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Modifier la fiche</h3>
                <p className="text-xs text-slate-500 font-medium">Mise à jour des coordonnées et scolarité</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Prénom</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:bg-white focus:border-blue-600"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nom</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:bg-white focus:border-blue-600"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Téléphone parent</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:bg-white focus:border-blue-600"
                  value={editForm.parent_phone}
                  onChange={(e) => setEditForm({ ...editForm, parent_phone: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Adresse</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:bg-white focus:border-blue-600"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Scolarité annuelle</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none focus:bg-white focus:border-blue-600 text-blue-600"
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
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tranches</label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:bg-white focus:border-blue-600"
                    value={editForm.payment_plan_tranches}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        payment_plan_tranches: parseInt(e.target.value),
                      })
                    }
                  >
                    <option value={1}>1 versement</option>
                    <option value={2}>2 tranches</option>
                    <option value={3}>3 tranches</option>
                    <option value={4}>4 tranches</option>
                    <option value={9}>9 tranches (Mensuel)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL D'AJOUT RAPIDE DU CONTACT PARENT */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Contact du parent</h3>
                <p className="text-xs text-slate-500 font-medium">Ajouter le numéro pour {student.first_name}</p>
              </div>
              <button 
                onClick={() => {
                  setIsPhoneModalOpen(false);
                  setManualPhoneInput("");
                }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <button
                type="button"
                onClick={pickPhoneFromContacts}
                disabled={isSavingPhone}
                className="w-full py-3 px-4 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-xs"
              >
                <Contact2 size={16} />
                <span>Choisir dans le répertoire</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest absolute">ou</span>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  saveParentPhone(manualPhoneInput);
                }} 
                className="space-y-3"
              >
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Numéro manuel</label>
                  <input
                    type="tel"
                    placeholder="Ex: 70 00 00 00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:bg-white focus:border-blue-600 text-slate-900"
                    value={manualPhoneInput}
                    onChange={(e) => setManualPhoneInput(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPhoneModalOpen(false);
                      setManualPhoneInput("");
                    }}
                    className="px-3.5 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPhone}
                    className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {isSavingPhone && <Loader2 size={13} className="animate-spin" />}
                    <span>Enregistrer</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 8. CONTENEUR CACHÉ POUR L'EXPORT PDF */}
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
          <h1 style={{ fontSize: "24px", fontWeight: 900, margin: 0 }}>
            {student.first_name} {student.last_name}
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#475569" }}>
            Bulletin - {bulletinPeriod}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#6b7280" }}>
            Classe : {student.classes?.name || "Non renseignée"}
          </p>
        </div>
        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "11px", margin: "0 0 4px", fontWeight: 700 }}>
            Moyenne générale
          </p>
          <p style={{ fontSize: "28px", margin: 0, fontWeight: 900 }}>
            {bulletinSummary?.moyenne ?? "0.00"}
          </p>
          <p style={{ fontSize: "11px", margin: "2px 0 0", color: "#6b7280" }}>
            Mention : {bulletinSummary?.mention ?? "N/A"}
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "8px",
          }}
        >
          {bulletinSummary?.notes.map((note) => (
            <div
              key={note.name}
              style={{
                padding: "10px",
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
              }}
            >
              <p style={{ margin: 0, fontSize: "11px", color: "#334155", fontWeight: 800 }}>
                {note.name}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: "10px", color: "#0f172a" }}>
                Classe : {note.gradeClasse}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#0f172a" }}>
                Compo : {note.gradeCompo}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#0284c7", fontWeight: 800 }}>
                Moyenne : {note.moyenne}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}