import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import NewCasePage from "@/pages/new-case";
import CaseDashboard from "@/pages/case-dashboard";
import CasesListPage from "@/pages/cases-list";
import GenerateLetterPage from "@/pages/generate-letter";
import LetterPreviewPage from "@/pages/letter-preview";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/new-case" component={NewCasePage} />
      <Route path="/cases" component={CasesListPage} />
      <Route path="/cases/:id" component={CaseDashboard} />
      <Route path="/cases/:id/generate" component={GenerateLetterPage} />
      <Route path="/cases/:id/letter" component={LetterPreviewPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
