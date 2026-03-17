import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { STATE_LAWS } from "../../../shared/stateLaws";
import type { Case, Deduction, CaseAnalysis } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock,
  Scale, DollarSign, Plus, Trash2, FileText, Sparkles, CreditCard, Loader2,
  Printer, Eye, Upload, BadgeCheck, Download, Mail, Gavel, Info, TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-provider";
import { Logo } from "@/components/logo";
import { usePageTitle } from "@/hooks/use-page-title";

interface EvidenceItem {
  id: number;
  filename: string;
  mimeType: string;
  fileSize: number;
  sha256Hash: string;
  metadata: any;
  description: string | null;
  uploadedAt: string;
}

interface DeliveryItem {
  id: number;
  caseId: number;
  provider: string;
  externalId: string | null;
  trackingNumber: string | null;
  status: string;
  recipientName: string | null;
  recipientAddress: string | null;
  certifiedMailNumber: string | null;
  expectedDeliveryDate: string | null;
  statusHistory: any;
  createdAt: string;
}

interface CourtFormItem {
  id: number;
  caseId: number;
  formType: string;
  state: string;
  formData: any;
  generatedAt: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function computeCaseStrength(
  isLate: boolean,
  daysPastDeadline: number,
  penaltyType: string,
  penaltyMultiplier: number | null,
  badFaithPenalty: boolean,
  deductionsCount: number,
): { score: number; label: "Strong" | "Moderate" | "Weak"; verdict: string; colorClass: string; bgBorderClass: string; barClass: string; badgeClass: string } {
  let score = 0;
  if (isLate) {
    score += 5;
    if (daysPastDeadline > 60) score += 2;
    else if (daysPastDeadline > 30) score += 1;
  }
  if (penaltyType === "multiplier") score += (penaltyMultiplier || 1) >= 3 ? 2 : 1;
  else if (penaltyType === "flat") score += 1;
  if (badFaithPenalty) score += 1;
  if (deductionsCount > 0) score += 1;
  score = Math.min(10, score);
  if (!isLate) score = Math.min(4, score);

  const label = score >= 7 ? "Strong" : score >= 4 ? "Moderate" : "Weak";
  const colorClass = score >= 7 ? "text-green-700 dark:text-green-400" : score >= 4 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  const bgBorderClass = score >= 7 ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : score >= 4 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800";
  const barClass = score >= 7 ? "bg-green-500" : score >= 4 ? "bg-amber-500" : "bg-red-500";
  const badgeClass = score >= 7 ? "bg-green-600 text-white hover:bg-green-600" : score >= 4 ? "bg-amber-500 text-white hover:bg-amber-500" : "bg-red-600 text-white hover:bg-red-600";

  let verdict = "";
  if (isLate && score >= 8) verdict = `Your landlord is ${daysPastDeadline} days past the statutory deadline — a clear violation that qualifies for maximum statutory penalties.`;
  else if (isLate && score >= 6) verdict = `Your landlord has missed the ${daysPastDeadline}-day statutory return deadline, establishing a clear legal violation in your favor.`;
  else if (isLate) verdict = `Your landlord is ${daysPastDeadline} days past the return deadline. A formal demand letter establishes your legal position.`;
  else if (deductionsCount > 0) verdict = `The landlord is within the return window, but you have ${deductionsCount} disputed deduction${deductionsCount !== 1 ? "s" : ""} that may be challenged.`;
  else verdict = "The landlord is still within the statutory return period. Keep records and monitor the deadline carefully.";

  return { score, label, verdict, colorClass, bgBorderClass, barClass, badgeClass };
}

export default function CaseDashboard() {
  const params = useParams<{ id: string }>();
  const caseToken = params.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [newDeduction, setNewDeduction] = useState({ description: "", amount: "", disputeReason: "" });
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: caseData, isLoading: caseLoading } = useQuery<Case>({
    queryKey: ["/api/cases", caseToken],
  });

  const caseId = caseData?.id;

  usePageTitle(caseId ? `Case #${caseId} — Security Deposit Recovery Dashboard` : "Security Deposit Recovery Dashboard", "Review your security deposit case: violation detection, penalty calculations, disputed deductions, evidence uploads, and AI-powered demand letter generation.");

  const { data: analysis, isLoading: analysisLoading } = useQuery<CaseAnalysis>({
    queryKey: ["/api/cases", caseToken, "analysis"],
    enabled: !!caseData,
  });

  const { data: deductionsData, isLoading: deductionsLoading } = useQuery<Deduction[]>({
    queryKey: ["/api/cases", caseToken, "deductions"],
    enabled: !!caseData,
  });

  const { data: evidenceData } = useQuery<EvidenceItem[]>({
    queryKey: ["/api/cases", caseToken, "evidence"],
    enabled: !!caseData,
  });

  const isCaseFinalized = !!caseData && (caseData.status === "signed" || caseData.status === "delivered");

  const { data: deliveriesData } = useQuery<DeliveryItem[]>({
    queryKey: ["/api/cases", caseToken, "deliveries"],
    enabled: isCaseFinalized,
  });

  const { data: courtFormsData } = useQuery<CourtFormItem[]>({
    queryKey: ["/api/cases", caseToken, "court-forms"],
    enabled: isCaseFinalized,
  });

  const addDeduction = useMutation({
    mutationFn: async (data: { description: string; amount: string; disputeReason: string }) => {
      const res = await apiRequest("POST", `/api/cases/${caseToken}/deductions`, {
        caseId,
        description: data.description,
        amount: data.amount,
        disputeReason: data.disputeReason,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseToken, "deductions"] });
      setNewDeduction({ description: "", amount: "", disputeReason: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteDeduction = useMutation({
    mutationFn: async (deductionId: number) => {
      await apiRequest("DELETE", `/api/cases/${caseToken}/deductions/${deductionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseToken, "deductions"] });
    },
  });

  const uploadEvidence = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (evidenceDescription) formData.append("description", evidenceDescription);
      const res = await fetch(`/api/cases/${caseToken}/evidence?token=${caseToken}`, { method: "POST", body: formData });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseToken, "evidence"] });
      setEvidenceDescription("");
      toast({ title: "Evidence Uploaded", description: "File has been securely stored." });
    },
    onError: (err: Error) => {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteEvidence = useMutation({
    mutationFn: async (evidenceId: number) => {
      await apiRequest("DELETE", `/api/cases/${caseToken}/evidence/${evidenceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseToken, "evidence"] });
      toast({ title: "Evidence Removed" });
    },
  });

  const sendLetter = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/cases/${caseToken}/send-letter`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseToken, "deliveries"] });
      toast({ title: "Letter Sent", description: "Your demand letter has been sent via USPS Certified Mail." });
    },
    onError: (err: Error) => {
      try {
        const body = JSON.parse(err.message.replace(/^\d+:\s*/, ""));
        const details = Array.isArray(body.details) ? body.details.join(" • ") : body.error;
        toast({ title: "Address Error", description: details, variant: "destructive" });
      } catch {
        toast({ title: "Send Failed", description: err.message, variant: "destructive" });
      }
    },
  });

  const prepareCourtForms = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/cases/${caseToken}/court-forms`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseToken, "court-forms"] });
      toast({ title: "Court Forms Prepared", description: "Your small claims filing documents are ready." });
    },
    onError: (err: Error) => {
      toast({ title: "Preparation Failed", description: err.message, variant: "destructive" });
    },
  });

  const checkout = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/cases/${caseToken}/checkout`);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.alreadyPaid) {
        navigate(`/cases/${caseToken}/generate`);
      } else if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: Error) => {
      toast({ title: "Payment Error", description: err.message, variant: "destructive" });
    },
  });

  const mailCheckout = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/cases/${caseToken}/mail-checkout`);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.alreadyPaid) {
        queryClient.invalidateQueries({ queryKey: ["/api/cases", caseToken] });
        toast({ title: "Already Paid", description: "Certified mail payment already received." });
      } else if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: Error) => {
      toast({ title: "Payment Error", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mailSessionId = params.get("mail_session_id");
    if (mailSessionId && caseData && !caseData.mailPaid) {
      apiRequest("POST", `/api/cases/${caseToken}/verify-mail-payment`, { sessionId: mailSessionId })
        .then((res) => res.json())
        .then((data) => {
          if (data.paid) {
            queryClient.invalidateQueries({ queryKey: ["/api/cases", caseToken] });
            toast({ title: "Payment Confirmed", description: "Certified mail payment received. You can now send your letter." });
          }
        })
        .catch(() => {});
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [caseData, caseToken, toast]);

  const handleDownloadReport = async () => {
    if (!caseData || !analysis) return;
    setIsGeneratingReport(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "letter");
      const W = pdf.internal.pageSize.getWidth();
      const H = pdf.internal.pageSize.getHeight();
      const ML = 22;
      const MR = 22;
      const CW = W - ML - MR;
      let y = 28;

      const navy: [number, number, number] = [30, 58, 95];
      const gold: [number, number, number] = [201, 168, 76];
      const white: [number, number, number] = [255, 255, 255];

      const dep = parseFloat(caseData.depositAmount);
      const ret = parseFloat(caseData.amountReturned || "0");
      const withh = dep - ret;
      const deductionsList = deductionsData || [];
      const st = STATE_LAWS[caseData.state];
      const cs = computeCaseStrength(
        analysis.isLate, analysis.daysPastDeadline,
        st?.penaltyType || "none", st?.penaltyMultiplier || null,
        st?.badFaithPenalty || false, deductionsList.length,
      );

      const drawPageHeader = () => {
        pdf.setFillColor(...navy);
        pdf.rect(0, 0, W, 16, "F");
        pdf.setTextColor(...gold);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.text("TenantAdvocate", ML, 10);
        pdf.setTextColor(...white);
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "normal");
        pdf.text("VIOLATION ANALYSIS REPORT — CONFIDENTIAL", W - MR, 10, { align: "right" });
        pdf.setTextColor(0, 0, 0);
      };

      const checkPage = () => {
        if (y > H - 32) {
          pdf.addPage();
          drawPageHeader();
          y = 28;
        }
      };

      const sectionTitle = (title: string) => {
        checkPage();
        y += 2;
        pdf.setFontSize(9.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...navy);
        pdf.text(title, ML, y);
        y += 3;
        pdf.setDrawColor(...navy);
        pdf.setLineWidth(0.4);
        pdf.line(ML, y, ML + 65, y);
        y += 5;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.3);
      };

      const twoCol = (label: string, value: string) => {
        checkPage();
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(80, 80, 80);
        pdf.text(label, ML, y);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "bold");
        const wrapped = pdf.splitTextToSize(value, CW * 0.55);
        pdf.text(wrapped, W - MR, y, { align: "right" });
        pdf.setFont("helvetica", "normal");
        y += Math.max(5, wrapped.length * 4.5);
      };

      drawPageHeader();

      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...navy);
      pdf.text("Security Deposit Violation", ML, y);
      y += 8;
      pdf.text("Analysis Report", ML, y);
      y += 7;
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(130, 130, 130);
      pdf.text(`Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, ML, y);
      pdf.text(`Case #${caseData.id}`, W - MR, y, { align: "right" });
      y += 4;
      pdf.setDrawColor(...navy);
      pdf.setLineWidth(0.8);
      pdf.line(ML, y, W - MR, y);
      y += 8;
      pdf.setTextColor(0, 0, 0);

      sectionTitle("CASE PARTIES");
      twoCol("Tenant", caseData.tenantName || "—");
      twoCol("Tenant Address", caseData.tenantAddress || "—");
      twoCol("Landlord", caseData.landlordName || "—");
      twoCol("Landlord Address", caseData.landlordAddress || "—");
      twoCol("Rental Property", caseData.propertyAddress || "—");
      twoCol("State", st?.state || caseData.state);
      y += 4;

      sectionTitle("VIOLATION STATUS");
      if (analysis.isLate) {
        pdf.setFillColor(254, 226, 226);
        pdf.roundedRect(ML, y - 2, CW, 26, 2, 2, "F");
        pdf.setTextColor(153, 27, 27);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text("⚠  VIOLATION CONFIRMED — LANDLORD PAST STATUTORY DEADLINE", ML + 4, y + 5);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.text(`${analysis.daysPastDeadline} days past the ${st?.returnDeadlineDays}-day deadline per ${st?.citation}`, ML + 4, y + 11);
        pdf.text(`Required return by: ${formatDate(analysis.deadlineDate)}`, ML + 4, y + 17);
        pdf.setTextColor(0, 0, 0);
        y += 32;
      } else {
        pdf.setFillColor(255, 251, 235);
        pdf.roundedRect(ML, y - 2, CW, 14, 2, 2, "F");
        pdf.setTextColor(120, 53, 15);
        pdf.setFontSize(8.5);
        const dlText = pdf.splitTextToSize(`Deadline not yet passed. Landlord has until ${formatDate(analysis.deadlineDate)} per ${st?.citation}`, CW - 8);
        pdf.text(dlText, ML + 4, y + 5);
        pdf.setTextColor(0, 0, 0);
        y += 20;
      }
      y += 4;

      sectionTitle("CASE STRENGTH ASSESSMENT");
      const strengthRGB: Record<string, [number, number, number]> = { Strong: [22, 163, 74], Moderate: [245, 158, 11], Weak: [220, 38, 38] };
      const sc2 = strengthRGB[cs.label];
      pdf.setFillColor(...sc2);
      pdf.roundedRect(ML, y - 2, 26, 14, 3, 3, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.text(`${cs.score}`, ML + 5, y + 7);
      pdf.setFontSize(7.5);
      pdf.text("/10", ML + 15, y + 7);
      pdf.setTextColor(...sc2);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text(cs.label.toUpperCase(), ML + 32, y + 4);
      pdf.setFontSize(8.5);
      pdf.setTextColor(80, 80, 80);
      pdf.setFont("helvetica", "normal");
      const vLines = pdf.splitTextToSize(cs.verdict, CW - 36);
      pdf.text(vLines, ML + 32, y + 9);
      y += Math.max(18, vLines.length * 5 + 12);
      y += 4;

      sectionTitle("FINANCIAL BREAKDOWN");
      const finRows: [string, string][] = [
        ["Security Deposit Paid", formatCurrency(dep)],
        ["Amount Returned by Landlord", formatCurrency(ret)],
        ["Amount Withheld", formatCurrency(withh)],
      ];
      if (analysis.penaltyBreakdown?.items) {
        analysis.penaltyBreakdown.items.forEach((item: any) => finRows.push([item.label, formatCurrency(item.amount)]));
      }
      finRows.forEach(([label, value], i) => {
        checkPage();
        pdf.setFillColor(i % 2 === 0 ? 248 : 253, 248, 248);
        pdf.rect(ML, y - 3.5, CW, 7.5, "F");
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(60, 60, 60);
        pdf.text(label, ML + 3, y + 0.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text(value, W - MR - 3, y + 0.5, { align: "right" });
        y += 7.5;
      });
      checkPage();
      pdf.setFillColor(...navy);
      pdf.rect(ML, y - 3.5, CW, 10, "F");
      pdf.setTextColor(...gold);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.text("TOTAL POTENTIAL RECOVERY", ML + 3, y + 2.5);
      pdf.text(formatCurrency(analysis.totalPotentialRecovery), W - MR - 3, y + 2.5, { align: "right" });
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(8.5);
      y += 15;

      if (deductionsList.length > 0) {
        sectionTitle(`DISPUTED DEDUCTIONS (${deductionsList.length})`);
        deductionsList.forEach((d, i) => {
          checkPage();
          const hasReason = !!d.disputeReason;
          const rowH = hasReason ? 13 : 7.5;
          pdf.setFillColor(i % 2 === 0 ? 248 : 253, 248, 248);
          pdf.rect(ML, y - 3, CW, rowH, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(0, 0, 0);
          pdf.text(d.description, ML + 3, y + 0.5);
          pdf.text(formatCurrency(parseFloat(d.amount)), W - MR - 3, y + 0.5, { align: "right" });
          if (hasReason) {
            pdf.setFont("helvetica", "italic");
            pdf.setTextColor(100, 100, 100);
            pdf.setFontSize(8);
            const rLines = pdf.splitTextToSize(`Dispute: ${d.disputeReason}`, CW - 6);
            pdf.text(rLines, ML + 3, y + 5.5);
            pdf.setFontSize(8.5);
            pdf.setTextColor(0, 0, 0);
          }
          y += rowH + 1;
        });
        y += 4;
      }

      sectionTitle("STATE LAW REFERENCE");
      twoCol("Statute", st?.citation || "—");
      twoCol("Return Deadline", `${st?.returnDeadlineDays} calendar days from move-out`);
      twoCol("Penalty", st?.penaltyType === "multiplier" ? `${st.penaltyMultiplier}× withheld amount` : st?.penaltyType === "flat" ? `$${st.penaltyFlatFee} flat fee` : "No statutory penalty");
      twoCol("Bad Faith Penalty", st?.badFaithPenalty ? "Available in this state" : "Not available");
      twoCol("Itemized Notice Required", st?.itemizedNoticeRequired ? "Yes" : "No");
      if (st?.smallClaimsCourtName) {
        twoCol("Small Claims Court", st.smallClaimsCourtName);
        twoCol("Small Claims Limit", `$${st.smallClaimsLimit?.toLocaleString()}`);
        twoCol("Est. Filing Fee", `~$${st.smallClaimsFilingFee}`);
      }
      if (st?.specialPenaltyRules) {
        y += 2;
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(60, 60, 60);
        const spLines = pdf.splitTextToSize(`Note: ${st.specialPenaltyRules}`, CW);
        pdf.text(spLines, ML, y);
        y += spLines.length * 4.8;
        pdf.setTextColor(0, 0, 0);
      }
      y += 6;

      checkPage();
      pdf.setDrawColor(210, 210, 210);
      pdf.setLineWidth(0.3);
      pdf.line(ML, y, W - MR, y);
      y += 5;
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(150, 150, 150);
      const disc = "DISCLAIMER: This report was generated by TenantAdvocate, an AI-powered legal technology platform. TenantAdvocate is not a law firm and does not provide legal advice. This analysis is based on publicly available statutes and the facts you provided. Penalty calculations are estimates; actual recovery may vary. Consult a licensed attorney for complex legal matters.";
      const discLines = pdf.splitTextToSize(disc, CW);
      pdf.text(discLines, ML, y);

      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(170, 170, 170);
        pdf.text(`TenantAdvocate.com  ·  Case #${caseData.id}  ·  Page ${i} of ${pageCount}`, W / 2, H - 8, { align: "center" });
      }

      pdf.save(`violation-report-case-${caseData.id}.pdf`);
      toast({ title: "Report Downloaded", description: "Your free violation analysis report has been saved as a PDF." });
    } catch (err) {
      console.error("Report generation error:", err);
      toast({ title: "Error", description: "Could not generate the report. Please try again.", variant: "destructive" });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File Too Large", description: "Maximum file size is 10MB.", variant: "destructive" });
        return;
      }
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/gif", "application/pdf"];
      if (!allowed.includes(file.type)) {
        toast({ title: "Invalid File Type", description: "Upload images (JPG, PNG, WebP, HEIC, GIF) or PDF documents.", variant: "destructive" });
        return;
      }
      uploadEvidence.mutate(file);
    }
  }, [uploadEvidence, toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File Too Large", description: "Maximum file size is 10MB.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/gif", "application/pdf"];
      if (!allowed.includes(file.type)) {
        toast({ title: "Invalid File Type", description: "Upload images (JPG, PNG, WebP, HEIC, GIF) or PDF documents.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      uploadEvidence.mutate(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [uploadEvidence, toast]);

  if (caseLoading || analysisLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center">
            <Skeleton className="h-6 w-48" />
          </div>
        </header>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!caseData || !analysis) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="font-serif text-xl font-bold mb-2">Case Not Found</h2>
          <p className="text-muted-foreground mb-4">This case doesn't exist or has been removed.</p>
          <Button onClick={() => navigate("/")} data-testid="button-back-to-home">Go Home</Button>
        </Card>
      </div>
    );
  }

  const stateLaw = STATE_LAWS[caseData.state];
  const depositAmount = parseFloat(caseData.depositAmount);
  const amountReturned = parseFloat(caseData.amountReturned || "0");
  const withheld = depositAmount - amountReturned;
  const deductions = deductionsData || [];
  const evidenceList = evidenceData || [];
  const deliveries = deliveriesData || [];
  const courtForms = courtFormsData || [];
  const breakdown = analysis.penaltyBreakdown;
  const caseStrength = computeCaseStrength(
    analysis.isLate,
    analysis.daysPastDeadline,
    stateLaw?.penaltyType || "none",
    stateLaw?.penaltyMultiplier || null,
    stateLaw?.badFaithPenalty || false,
    deductions.length,
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover-elevate rounded-md px-2 py-1"
            data-testid="button-back-home"
          >
            <ArrowLeft className="h-4 w-4" />
            <Logo size="sm" />
          </button>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Badge variant="secondary" data-testid="badge-case-status">
              Case #{caseData.id}
            </Badge>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {analysis.isLate && (
          <Card className="p-4 sm:p-5 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-red-900 dark:text-red-200 text-lg" data-testid="text-violation-header">
                  LANDLORD IS {analysis.daysPastDeadline} DAYS LATE — THIS IS ILLEGAL IN {stateLaw?.state?.toUpperCase()}
                </h2>
                <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                  Required return by: {formatDate(analysis.deadlineDate)} | Today: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
            </div>
          </Card>
        )}

        {!analysis.isLate && (
          <Card className="p-4 sm:p-5 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="font-bold text-amber-900 dark:text-amber-200 text-lg">
                  Deadline Not Yet Passed
                </h2>
                <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
                  Your landlord has until {formatDate(analysis.deadlineDate)} to return your deposit ({stateLaw?.returnDeadlineDays} days per {stateLaw?.citation}).
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Deposit Withheld</span>
            </div>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-deposit-withheld">
              {formatCurrency(withheld)}
            </p>
            {amountReturned > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(amountReturned)} returned of {formatCurrency(depositAmount)}
              </p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Potential Penalty</span>
            </div>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#2E5FAA]" data-testid="text-penalty-amount">
              + {formatCurrency(analysis.penaltyAmount)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stateLaw?.penaltyType === "multiplier" && stateLaw.penaltyMultiplier
                ? `${stateLaw.penaltyMultiplier}x rule per ${stateLaw.citation}`
                : stateLaw?.penaltyType === "flat" && stateLaw.penaltyFlatFee
                ? `$${stateLaw.penaltyFlatFee} flat fee per ${stateLaw.citation}`
                : `Per ${stateLaw?.citation || "state law"}`}
            </p>
          </Card>

          <Card className="p-5 bg-[#1E3A5F] text-white">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-[#C9A84C]" />
              <span className="text-sm font-medium text-white/70 uppercase tracking-wider">Total You're Owed</span>
            </div>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#C9A84C]" data-testid="text-total-recovery">
              {formatCurrency(analysis.totalPotentialRecovery)}
            </p>
            {breakdown && breakdown.items.length > 0 && (
              <div className="mt-4 space-y-2">
                <Separator className="bg-white/20" />
                <div className="space-y-1.5">
                  {breakdown.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 text-sm" data-testid={`breakdown-item-${idx}`}>
                      <div className="flex-1 min-w-0">
                        <span className="text-white/80">{item.label}</span>
                        {item.description && (
                          <p className="text-white/50 text-xs truncate">{item.description}</p>
                        )}
                      </div>
                      <span className="font-medium text-[#C9A84C] whitespace-nowrap">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
                <Separator className="bg-white/20" />
                <div className="flex items-center justify-between gap-2 text-sm font-bold">
                  <span className="text-white">Total Recovery</span>
                  <span className="text-[#C9A84C]">{formatCurrency(breakdown.totalPotentialRecovery)}</span>
                </div>
              </div>
            )}
            {stateLaw?.specialPenaltyRules && (
              <div className="mt-3 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-white/60">{stateLaw.specialPenaltyRules}</p>
              </div>
            )}
          </Card>
        </div>

        <Card className={`p-5 sm:p-6 border-2 ${caseStrength.bgBorderClass}`} data-testid="card-case-strength">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-5 w-5 ${caseStrength.colorClass}`} />
              <h3 className="font-serif text-lg font-bold text-foreground">Case Strength Assessment</h3>
            </div>
            <Badge variant="secondary" className="text-xs">Free Analysis</Badge>
          </div>

          <div className="flex items-start gap-5 sm:gap-8">
            <div className="flex-shrink-0 flex flex-col items-center">
              <div className={`w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center ${
                caseStrength.score >= 7 ? "border-green-500 bg-green-50 dark:bg-green-950/40" :
                caseStrength.score >= 4 ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40" :
                "border-red-500 bg-red-50 dark:bg-red-950/40"
              }`}>
                <span className={`font-serif text-3xl font-bold leading-none ${caseStrength.colorClass}`} data-testid="text-strength-score">{caseStrength.score}</span>
                <span className="text-xs text-muted-foreground">/10</span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={caseStrength.badgeClass} data-testid="badge-strength-label">
                  {caseStrength.label.toUpperCase()} CASE
                </Badge>
              </div>
              <p className="text-sm text-foreground leading-relaxed" data-testid="text-strength-verdict">{caseStrength.verdict}</p>
              <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${caseStrength.barClass}`}
                  style={{ width: `${(caseStrength.score / 10) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {caseStrength.score}/10 — based on statutory deadline, penalty provisions, and documented disputes
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-5 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadReport}
              disabled={isGeneratingReport}
              data-testid="button-download-report"
            >
              {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isGeneratingReport ? "Generating PDF..." : "Download Free Violation Report"}
            </Button>
            <p className="text-xs text-muted-foreground">Full case analysis, penalty breakdown, and state law reference — no cost, no sign-up required</p>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#2E5FAA]" />
              <h3 className="font-serif text-lg font-bold text-foreground">Disputed Deductions</h3>
            </div>
            <Badge variant="secondary">{deductions.length} item{deductions.length !== 1 ? "s" : ""}</Badge>
          </div>

          {deductions.length > 0 && (
            <div className="space-y-3 mb-5">
              {deductions.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md bg-card border"
                  data-testid={`deduction-item-${d.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">{d.description}</span>
                      <Badge variant="secondary" className="text-xs">{formatCurrency(parseFloat(d.amount))}</Badge>
                    </div>
                    {d.disputeReason && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{d.disputeReason}</p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteDeduction.mutate(d.id)}
                    data-testid={`button-delete-deduction-${d.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator className="my-4" />

          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Add a deduction to dispute</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                placeholder="e.g., Carpet cleaning"
                value={newDeduction.description}
                onChange={(e) => setNewDeduction((prev) => ({ ...prev, description: e.target.value }))}
                data-testid="input-deduction-description"
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Amount ($)"
                value={newDeduction.amount}
                onChange={(e) => setNewDeduction((prev) => ({ ...prev, amount: e.target.value }))}
                data-testid="input-deduction-amount"
              />
              <Input
                placeholder="Why you're disputing"
                value={newDeduction.disputeReason}
                onChange={(e) => setNewDeduction((prev) => ({ ...prev, disputeReason: e.target.value }))}
                data-testid="input-deduction-reason"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (newDeduction.description && newDeduction.amount) {
                  addDeduction.mutate(newDeduction);
                }
              }}
              disabled={!newDeduction.description || !newDeduction.amount || addDeduction.isPending}
              data-testid="button-add-deduction"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Deduction
            </Button>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-[#2E5FAA]" />
              <h3 className="font-serif text-lg font-bold text-foreground">Evidence Vault</h3>
            </div>
            <div className="flex items-center gap-2">
              {evidenceList.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(`/api/cases/${caseToken}/evidence/manifest?token=${caseToken}`, "_blank");
                  }}
                  data-testid="button-download-manifest"
                >
                  <Download className="mr-1 h-4 w-4" />
                  Manifest
                </Button>
              )}
              <Badge variant="secondary">{evidenceList.length} file{evidenceList.length !== 1 ? "s" : ""}</Badge>
            </div>
          </div>

          <div
            className={`border-2 border-dashed rounded-md p-6 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-[#2E5FAA] bg-[#2E5FAA]/5 dark:bg-[#2E5FAA]/10"
                : "border-muted-foreground/25 hover:border-[#2E5FAA]/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-evidence"
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,image/heic,image/gif,application/pdf"
              onChange={handleFileSelect}
              data-testid="input-evidence-file"
            />
            {uploadEvidence.isPending ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 text-[#2E5FAA] animate-spin" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Drop files here or click to upload</p>
                <p className="text-xs text-muted-foreground">Images (JPG, PNG, WebP, GIF, HEIC) or PDF — Max 10MB</p>
              </div>
            )}
          </div>

          <div className="mt-3">
            <Input
              placeholder="Optional description for next upload"
              value={evidenceDescription}
              onChange={(e) => setEvidenceDescription(e.target.value)}
              data-testid="input-evidence-description"
            />
          </div>

          {evidenceList.length > 0 && (
            <div className="mt-4 space-y-3">
              <Separator />
              {evidenceList.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md bg-card border"
                  data-testid={`evidence-item-${ev.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground truncate">{ev.filename}</span>
                      <Badge variant="secondary" className="text-xs">{formatFileSize(ev.fileSize)}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <div className="flex items-center gap-1">
                        <BadgeCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        <span className="text-xs font-mono text-muted-foreground">{ev.sha256Hash.substring(0, 12)}...</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDateTime(ev.uploadedAt)}</span>
                    </div>
                    {ev.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{ev.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); window.open(`/api/cases/${caseToken}/evidence/${ev.id}/download`, "_blank"); }}
                      data-testid={`button-download-evidence-${ev.id}`}
                    >
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); deleteEvidence.mutate(ev.id); }}
                      data-testid={`button-delete-evidence-${ev.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {caseData.status === "signed" ? (
          <Card className="p-5 sm:p-6 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-green-900 dark:text-green-200 mb-1">
                    Case Finalized
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Your demand letter has been signed. View, download, or print it to send to your landlord.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  data-testid="button-view-signed-letter"
                  onClick={() => navigate(`/cases/${caseToken}/letter`)}
                  className="bg-[#1E3A5F] text-white"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Letter
                </Button>
                <Button
                  variant="outline"
                  data-testid="button-print-letter"
                  onClick={() => {
                    navigate(`/cases/${caseToken}/letter`);
                    setTimeout(() => window.print(), 500);
                  }}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
              </div>
            </div>
          </Card>
        ) : caseData.status === "generated" ? (
          <Card className="p-5 sm:p-6 bg-[#2E5FAA]/5 border-[#2E5FAA]/20">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <FileText className="h-6 w-6 text-[#2E5FAA] flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-foreground mb-1">
                    Letter Ready for Review
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Your demand letter has been generated. Review it and sign to finalize.
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                data-testid="button-review-sign-letter"
                onClick={() => navigate(`/cases/${caseToken}/letter`)}
                className="bg-[#C9A84C] text-white border-[#b8963f] text-base px-8 whitespace-nowrap"
              >
                <FileText className="mr-2 h-4 w-4" />
                Review & Sign Letter
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <h3 className="font-serif text-lg font-bold text-foreground mb-1">
                  {caseData.paid ? "Ready to Generate" : "Generate Your Demand Letter"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {caseData.paid
                    ? "Payment received. Generate your AI-powered demand letter now."
                    : "Our AI legal team will research, analyze, and draft your letter for $29."}
                </p>
              </div>
              <Button
                size="lg"
                data-testid="button-generate-letter"
                onClick={() => navigate(`/cases/${caseToken}/generate`)}
                disabled={false} // ⚠️ TEST MODE
                className="bg-[#C9A84C] text-white border-[#b8963f] text-base px-8 whitespace-nowrap"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {caseData.paid ? "Generate Letter" : "Generate Letter (Test Mode)"}
              </Button>
            </div>
          </Card>
        )}

        {isCaseFinalized && (
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5 text-[#2E5FAA]" />
              <h3 className="font-serif text-lg font-bold text-foreground">Certified Mail Delivery</h3>
            </div>

            {deliveries.length === 0 ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-md bg-[#2E5FAA]/5 dark:bg-[#2E5FAA]/10 border border-[#2E5FAA]/20">
                  <Mail className="h-5 w-5 text-[#2E5FAA] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground text-sm mb-1">We Handle Everything</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      We print, mail, and track your demand letter via USPS Certified Mail with return receipt — legal proof your landlord received it. Includes postage, printing, and tracking.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {caseData.mailPaid && (
                      <Badge className="bg-green-600 text-white" data-testid="badge-mail-paid">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Paid
                      </Badge>
                    )}
                  </div>
                  {/* ⚠️ TEST MODE — restore mailPaid check before going live */}
                  <Button
                    onClick={() => sendLetter.mutate()}
                    disabled={sendLetter.isPending}
                    className="bg-[#2E5FAA] text-white whitespace-nowrap"
                    data-testid="button-send-certified-mail"
                  >
                    {sendLetter.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    {sendLetter.isPending ? "Sending..." : "Send Now (Test Mode)"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {deliveries.map((del) => (
                  <div key={del.id} className="p-4 rounded-md bg-card border space-y-2" data-testid={`delivery-item-${del.id}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={del.status === "delivered" ? "default" : "secondary"}
                          className={del.status === "delivered" ? "bg-green-600 text-white" : ""}
                          data-testid={`delivery-status-${del.id}`}
                        >
                          {del.status.charAt(0).toUpperCase() + del.status.slice(1)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{del.provider.toUpperCase()}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDateTime(del.createdAt)}</span>
                    </div>
                    {del.trackingNumber && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Tracking: </span>
                        <span className="font-mono font-medium text-foreground" data-testid={`delivery-tracking-${del.id}`}>{del.trackingNumber}</span>
                      </div>
                    )}
                    {del.certifiedMailNumber && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Certified Mail #: </span>
                        <span className="font-mono font-medium text-foreground">{del.certifiedMailNumber}</span>
                      </div>
                    )}
                    {del.expectedDeliveryDate && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Expected Delivery: </span>
                        <span className="font-medium text-foreground" data-testid={`delivery-expected-${del.id}`}>{formatDate(del.expectedDeliveryDate)}</span>
                      </div>
                    )}
                    {del.recipientName && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Recipient: </span>
                        <span className="text-foreground">{del.recipientName}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {isCaseFinalized && (
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Gavel className="h-5 w-5 text-[#2E5FAA]" />
              <h3 className="font-serif text-lg font-bold text-foreground">Small Claims Court Filing</h3>
            </div>

            {courtForms.length === 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  {stateLaw?.smallClaimsCourtName && (
                    <div>
                      <span className="text-xs text-muted-foreground block">Court</span>
                      <span className="font-medium text-foreground">{stateLaw.smallClaimsCourtName}</span>
                    </div>
                  )}
                  {stateLaw?.smallClaimsFilingFee != null && (
                    <div>
                      <span className="text-xs text-muted-foreground block">Filing Fee</span>
                      <span className="font-medium text-foreground">{formatCurrency(stateLaw.smallClaimsFilingFee)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-muted-foreground block">Max Claim Amount</span>
                    <span className="font-medium text-foreground">{formatCurrency(stateLaw?.smallClaimsLimit || 0)}</span>
                  </div>
                </div>
                <Separator />
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    Generate pre-filled small claims court forms for your state.
                  </p>
                  <Button
                    onClick={() => prepareCourtForms.mutate()}
                    disabled={prepareCourtForms.isPending}
                    className="bg-[#2E5FAA] text-white whitespace-nowrap"
                    data-testid="button-prepare-court-forms"
                  >
                    {prepareCourtForms.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Gavel className="mr-2 h-4 w-4" />
                    )}
                    {prepareCourtForms.isPending ? "Preparing..." : "Prepare Small Claims Filing"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {courtForms.map((form) => (
                  <div key={form.id} className="p-4 rounded-md bg-card border space-y-3" data-testid={`court-form-${form.id}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{form.formType}</Badge>
                        <span className="text-sm font-medium text-foreground">{form.state}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDateTime(form.generatedAt)}</span>
                    </div>
                    {form.formData && typeof form.formData === "object" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {Object.entries(form.formData as Record<string, any>).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-xs text-muted-foreground block">
                              {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                            </span>
                            <span className="font-medium text-foreground text-sm">
                              {typeof value === "object" ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {stateLaw && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t flex-wrap">
                        <span>{stateLaw.smallClaimsCourtName}</span>
                        {stateLaw.smallClaimsFilingFee != null && (
                          <span>Filing Fee: {formatCurrency(stateLaw.smallClaimsFilingFee)}</span>
                        )}
                        <span>Max: {formatCurrency(stateLaw.smallClaimsLimit)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <Card className="p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Scale className="h-4 w-4" />
            State Law Reference
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground block">State</span>
              <span className="font-medium" data-testid="text-state-name">{stateLaw?.state}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Return Deadline</span>
              <span className="font-medium">{stateLaw?.returnDeadlineDays} days</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Citation</span>
              <span className="font-medium font-mono text-xs">{stateLaw?.citation}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Small Claims Limit</span>
              <span className="font-medium">{formatCurrency(stateLaw?.smallClaimsLimit || 0)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mt-3">
            <div>
              <span className="text-xs text-muted-foreground block">Court Name</span>
              <span className="font-medium">{stateLaw?.smallClaimsCourtName || "N/A"}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Filing Fee</span>
              <span className="font-medium">{stateLaw?.smallClaimsFilingFee != null ? formatCurrency(stateLaw.smallClaimsFilingFee) : "N/A"}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Interest Rate</span>
              <span className="font-medium">
                {stateLaw?.interestRate != null ? `${stateLaw.interestRate}% (${stateLaw.interestType})` : "None"}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Bad Faith Fee</span>
              <span className="font-medium">
                {stateLaw?.badFaithFlatFee != null ? formatCurrency(stateLaw.badFaithFlatFee) : stateLaw?.badFaithPenalty ? "Yes (see penalty)" : "None"}
              </span>
            </div>
          </div>
          {stateLaw?.specialPenaltyRules && (
            <div className="mt-3 pt-3 border-t">
              <span className="text-xs text-muted-foreground block mb-1">Special Penalty Rules</span>
              <p className="text-sm font-medium text-foreground">{stateLaw.specialPenaltyRules}</p>
            </div>
          )}
          {stateLaw?.notes && (
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">{stateLaw.notes}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
