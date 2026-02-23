import { Component, type ReactNode } from "react";
import { Shield, RefreshCw, Home } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Application error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-6">
              <Shield className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-foreground mb-2">
              Something Went Wrong
            </h1>
            <p className="text-muted-foreground mb-6">
              An unexpected error occurred. Please try refreshing the page or go back to the home page.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
                data-testid="button-refresh-page"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Page
              </button>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium text-foreground"
                data-testid="link-go-home"
              >
                <Home className="h-4 w-4" />
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
