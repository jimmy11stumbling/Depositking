import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import NewCasePage from "@/pages/new-case";
import CaseDashboard from "@/pages/case-dashboard";
import CasesListPage from "@/pages/cases-list";
import GenerateLetterPage from "@/pages/generate-letter";
import LetterPreviewPage from "@/pages/letter-preview";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import TermsOfServicePage from "@/pages/terms-of-service";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/new-case" component={NewCasePage} />
      <Route path="/cases" component={CasesListPage} />
      <Route path="/cases/:id" component={CaseDashboard} />
      <Route path="/cases/:id/generate" component={GenerateLetterPage} />
      <Route path="/cases/:id/letter" component={LetterPreviewPage} />
      <Route path="/privacy" component={PrivacyPolicyPage} />
      <Route path="/terms" component={TermsOfServicePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
