import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Case } from "@shared/schema";
import { STATE_LAWS } from "../../../shared/stateLaws";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, ArrowRight, Plus, FileText, Clock,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-provider";
import { Logo } from "@/components/logo";
import { usePageTitle } from "@/hooks/use-page-title";
import { getCaseTokens } from "@/lib/caseTokens";
import { apiRequest } from "@/lib/queryClient";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const statusColors: Record<string, string> = {
  intake: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  analysis: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  generating: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  generated: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  signed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const statusLabels: Record<string, string> = {
  intake: "Intake",
  analysis: "Analyzed",
  generating: "Generating",
  generated: "Letter Ready",
  signed: "Signed",
};

export default function CasesListPage() {
  const [, navigate] = useLocation();
  usePageTitle("Your Security Deposit Cases — Dashboard", "View and manage all your security deposit recovery cases. Track violations, penalties, demand letter status, and certified mail delivery progress.");

  const tokens = getCaseTokens();

  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases/by-tokens", tokens.length],
    queryFn: async () => {
      if (tokens.length === 0) return [];
      const res = await apiRequest("POST", "/api/cases/by-tokens", { tokens });
      return res.json();
    },
    enabled: true,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
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
            <Button onClick={() => navigate("/new-case")} data-testid="button-new-case">
              <Plus className="mr-1 h-4 w-4" />
              New Case
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-bold text-foreground mb-1">Your Cases</h1>
          <p className="text-sm text-muted-foreground">Track and manage all your deposit recovery cases.</p>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {!isLoading && (!cases || cases.length === 0) && (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-serif text-lg font-bold text-foreground mb-2">No Cases Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Start your first case to analyze your deposit situation and generate a demand letter.
            </p>
            <Button onClick={() => navigate("/new-case")} data-testid="button-start-first-case">
              <Plus className="mr-1 h-4 w-4" />
              Start Your First Case
            </Button>
          </Card>
        )}

        {cases && cases.length > 0 && (
          <div className="space-y-3">
            {cases.map((c) => {
              const law = STATE_LAWS[c.state];
              return (
                <Card
                  key={c.id}
                  className="p-4 sm:p-5 cursor-pointer hover-elevate"
                  onClick={() => navigate(`/cases/${c.accessToken}`)}
                  data-testid={`case-card-${c.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-foreground text-sm">
                          {law?.state || c.state} — {formatCurrency(parseFloat(c.depositAmount))}
                        </h3>
                        <Badge className={`text-xs ${statusColors[c.status] || "bg-muted text-muted-foreground"}`}>
                          {statusLabels[c.status] || c.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Moved out {c.moveOutDate}
                        </span>
                        {c.potentialRecovery && (
                          <span className="text-[#C9A84C] font-medium">
                            Potential: {formatCurrency(parseFloat(c.potentialRecovery))}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
