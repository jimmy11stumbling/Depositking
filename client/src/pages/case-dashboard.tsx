import { useState } from "react";
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
  Shield, ArrowLeft, ArrowRight, AlertTriangle, CheckCircle2, Clock,
  Scale, DollarSign, Plus, Trash2, FileText, Sparkles, CreditCard, Loader2,
  Download, Printer, Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export default function CaseDashboard() {
  const params = useParams<{ id: string }>();
  const caseId = parseInt(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [newDeduction, setNewDeduction] = useState({ description: "", amount: "", disputeReason: "" });

  const { data: caseData, isLoading: caseLoading } = useQuery<Case>({
    queryKey: ["/api/cases", caseId],
  });

  const { data: analysis, isLoading: analysisLoading } = useQuery<CaseAnalysis>({
    queryKey: ["/api/cases", caseId, "analysis"],
  });

  const { data: deductionsData, isLoading: deductionsLoading } = useQuery<Deduction[]>({
    queryKey: ["/api/cases", caseId, "deductions"],
  });

  const addDeduction = useMutation({
    mutationFn: async (data: { description: string; amount: string; disputeReason: string }) => {
      const res = await apiRequest("POST", `/api/cases/${caseId}/deductions`, {
        caseId,
        description: data.description,
        amount: data.amount,
        disputeReason: data.disputeReason,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "deductions"] });
      setNewDeduction({ description: "", amount: "", disputeReason: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteDeduction = useMutation({
    mutationFn: async (deductionId: number) => {
      await apiRequest("DELETE", `/api/cases/${caseId}/deductions/${deductionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "deductions"] });
    },
  });

  const checkout = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/cases/${caseId}/checkout`);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.alreadyPaid) {
        navigate(`/cases/${caseId}/generate`);
      } else if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: Error) => {
      toast({ title: "Payment Error", description: err.message, variant: "destructive" });
    },
  });

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
            <Shield className="h-5 w-5 text-[#2E5FAA]" />
            <span className="font-serif text-sm font-bold text-foreground">Deposit Retriever</span>
          </button>
          <Badge variant="secondary" data-testid="badge-case-status">
            Case #{caseData.id}
          </Badge>
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
            <p className="text-xs text-white/60 mt-1">Fight for it</p>
          </Card>
        </div>

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
                  onClick={() => navigate(`/cases/${caseId}/letter`)}
                  className="bg-[#1E3A5F] text-white"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Letter
                </Button>
                <Button
                  variant="outline"
                  data-testid="button-print-letter"
                  onClick={() => {
                    navigate(`/cases/${caseId}/letter`);
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
                onClick={() => navigate(`/cases/${caseId}/letter`)}
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
              {caseData.paid ? (
                <Button
                  size="lg"
                  data-testid="button-generate-letter"
                  onClick={() => navigate(`/cases/${caseId}/generate`)}
                  className="bg-[#C9A84C] text-white border-[#b8963f] text-base px-8 whitespace-nowrap"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Letter
                </Button>
              ) : (
                <Button
                  size="lg"
                  data-testid="button-pay-generate"
                  onClick={() => checkout.mutate()}
                  disabled={checkout.isPending}
                  className="bg-[#C9A84C] text-white border-[#b8963f] text-base px-8 whitespace-nowrap"
                >
                  {checkout.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  {checkout.isPending ? "Processing..." : "Pay $29 & Generate Letter"}
                </Button>
              )}
            </div>
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
          {stateLaw?.notes && (
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">{stateLaw.notes}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
