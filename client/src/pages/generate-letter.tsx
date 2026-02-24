import { useState, useEffect, useRef } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Case, AgentStatus } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, AlertTriangle,
  Search, Scale, FileText, ShieldCheck, Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/theme-provider";
import { Logo } from "@/components/logo";
import { usePageTitle } from "@/hooks/use-page-title";

const agentMeta: Record<string, { icon: any; label: string; description: string }> = {
  paralegal: { icon: Search, label: "Paralegal Researcher", description: "Researching current statutes and verifying legal information..." },
  attorney: { icon: Scale, label: "Strategy Attorney", description: "Assessing case strength and formulating legal strategy..." },
  drafter: { icon: FileText, label: "Demand Letter Drafter", description: "Drafting authoritative demand letter with verified citations..." },
  reviewer: { icon: ShieldCheck, label: "Quality Reviewer", description: "Reviewing letter for accuracy, tone, and legal soundness..." },
};

const agentOrder = ["paralegal", "attorney", "drafter", "reviewer"];

export default function GenerateLetterPage() {
  const params = useParams<{ id: string }>();
  const caseToken = params.id;
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const sessionId = searchParams.get("session_id");
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const { data: caseData, isLoading } = useQuery<Case>({
    queryKey: ["/api/cases", caseToken],
  });

  const caseId = caseData?.id;

  usePageTitle(caseId ? `AI Demand Letter Generation — Case #${caseId}` : "AI Demand Letter Generation", "Watch as 4 AI legal agents analyze your case, research state statutes, and generate a professional security deposit demand letter in real time.");

  useEffect(() => {
    if (!caseData) return;

    if (caseData.status === "signed") {
      navigate(`/cases/${caseToken}/letter`);
      return;
    }

    if (caseData.status === "generated") {
      navigate(`/cases/${caseToken}/letter`);
      return;
    }

    // TESTING MODE: Skip payment verification
    setPaymentVerified(true);
  }, [caseData, sessionId, paymentVerified, navigate, caseToken]);

  const startGeneration = () => {
    setIsGenerating(true);
    setError(null);
    setIsDone(false);
    setAgentStatuses({});

    const eventSource = new EventSource(`/api/cases/${caseToken}/generate`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.status === "done") {
          setIsDone(true);
          setIsGenerating(false);
          eventSource.close();
          queryClient.invalidateQueries({ queryKey: ["/api/cases", caseToken] });
          return;
        }

        if (data.status === "error") {
          setError(data.message || "An error occurred during generation");
          setIsGenerating(false);
          eventSource.close();
          return;
        }

        if (data.agent) {
          setAgentStatuses((prev) => ({
            ...prev,
            [data.agent]: data as AgentStatus,
          }));
        }
      } catch (e) {
        console.error("SSE parse error:", e);
      }
    };

    eventSource.onerror = () => {
      setError("Connection lost. Please try again.");
      setIsGenerating(false);
      eventSource.close();
    };
  };

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const completedAgents = agentOrder.filter(
    (a) => agentStatuses[a]?.status === "complete"
  ).length;
  const progress = (completedAgents / agentOrder.length) * 100;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center">
            <Skeleton className="h-6 w-48" />
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-96 mb-8" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <button
            onClick={() => navigate(`/cases/${caseToken}`)}
            className="flex items-center gap-2 text-muted-foreground hover-elevate rounded-md px-2 py-1"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            <Logo size="sm" showText={false} />
            <span className="font-serif text-sm font-bold text-foreground">Back to Case</span>
          </button>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Badge variant="secondary">Case #{caseId}</Badge>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#2E5FAA]/10 mb-4">
            <Sparkles className="h-7 w-7 text-[#2E5FAA]" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-2">
            {isDone ? "Your Letter Is Ready" : isGenerating ? "Generating Your Legal Demand Letter" : "Generate Demand Letter"}
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            {isDone
              ? "Our AI legal team has completed the analysis and drafted your letter."
              : isGenerating
              ? "Our team of AI legal agents is working on your case..."
              : "Our AI legal team will research your state's laws, assess your case, and draft a professional demand letter."}
          </p>
        </div>

        {verifyingPayment && (
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-[#2E5FAA] animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Verifying payment...</p>
          </div>
        )}

        {!isGenerating && !isDone && !error && paymentVerified && !verifyingPayment && (
          <div className="text-center">
            <Button
              size="lg"
              onClick={startGeneration}
              data-testid="button-start-generation"
              className="bg-[#C9A84C] text-white border-[#b8963f] text-base px-10"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Letter
            </Button>
          </div>
        )}

        {(isGenerating || isDone) && (
          <div className="space-y-4">
            {isGenerating && (
              <div className="mb-6">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {completedAgents} of {agentOrder.length} agents complete
                </p>
              </div>
            )}

            <AnimatePresence mode="sync">
              {agentOrder.map((agentKey, i) => {
                const status = agentStatuses[agentKey];
                const meta = agentMeta[agentKey];
                const Icon = meta.icon;
                const isActive = status?.status === "running";
                const isComplete = status?.status === "complete";
                const isPending = !status || status.status === "pending";

                return (
                  <motion.div
                    key={agentKey}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                  >
                    <Card
                      className={`p-4 sm:p-5 transition-all ${
                        isActive ? "ring-2 ring-[#2E5FAA] bg-[#2E5FAA]/5" : ""
                      } ${isComplete ? "opacity-100" : isPending ? "opacity-50" : "opacity-100"}`}
                      data-testid={`agent-card-${agentKey}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                          isComplete ? "bg-green-100 dark:bg-green-900/30" : isActive ? "bg-[#2E5FAA]/10" : "bg-muted"
                        }`}>
                          {isComplete ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : isActive ? (
                            <Loader2 className="h-5 w-5 text-[#2E5FAA] animate-spin" />
                          ) : (
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm text-foreground">{meta.label}</h3>
                            {isComplete && status.confidence && (
                              <Badge variant="secondary" className="text-xs">
                                {status.confidence}% confidence
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isComplete
                              ? status.message || "Complete"
                              : isActive
                              ? meta.description
                              : "Waiting..."}
                          </p>
                        </div>

                        <div className="flex-shrink-0">
                          {isComplete && (
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          )}
                          {isActive && (
                            <Loader2 className="h-4 w-4 text-[#2E5FAA] animate-spin" />
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {isDone && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8 text-center"
              >
                <Button
                  size="lg"
                  onClick={() => navigate(`/cases/${caseToken}/letter`)}
                  data-testid="button-view-letter"
                  className="bg-[#C9A84C] text-white border-[#b8963f] text-base px-10"
                >
                  Review & Sign Letter
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </div>
        )}

        {error && (
          <Card className="p-6 text-center mt-6">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-2">Generation Error</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={startGeneration} data-testid="button-retry-generation">
              Try Again
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
