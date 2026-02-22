import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-provider";
import { usePageTitle } from "@/hooks/use-page-title";

export default function NotFound() {
  const [, navigate] = useLocation();
  usePageTitle("Page Not Found");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover-elevate rounded-md px-2 py-1"
            data-testid="button-back-home"
          >
            <ArrowLeft className="h-4 w-4" />
            <Shield className="h-5 w-5 text-[#2E5FAA]" />
            <span className="font-serif text-sm font-bold text-foreground">Deposit Retriever</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <Card className="p-8 text-center max-w-md">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-4">
            <span className="font-serif text-2xl font-bold text-muted-foreground">404</span>
          </div>
          <h1 className="font-serif text-xl font-bold text-foreground mb-2">Page Not Found</h1>
          <p className="text-sm text-muted-foreground mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={() => navigate("/")} data-testid="button-go-home">
              Go Home
            </Button>
            <Button variant="outline" onClick={() => navigate("/new-case")} data-testid="button-start-case">
              Start a Case
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
